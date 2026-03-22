// Google Drive sync via GIS (OAuth token) + GAPI client (API requests)
// GAPI client routes calls through apis.google.com proxy frame — bypasses CORS preflight issues
// that direct fetch() to googleapis.com encounters from github.io origin.
// Uses appDataFolder scope — backup file is hidden from user's Drive, only this app can see it.

const BACKUP_FILENAME = "wealth-management-backup.json";
export const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const LAST_SYNC_KEY = "wm_gdrive_last_sync";

// ── GAPI client loading ───────────────────────────────────────────────────────

let gapiReady = false;

function loadGapiClient(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (gapiReady || (window as any).gapi?.client) { gapiReady = true; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="apis.google.com/js/api"]');
    if (existing) {
      // Already injected — poll until gapi.client is ready
      const t = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).gapi?.client) { clearInterval(t); gapiReady = true; resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(t); reject(new Error("GAPI timeout")); }, 10_000);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gapi.load("client", () => { gapiReady = true; resolve(); });
    };
    script.onerror = () => reject(new Error("Nepodarilo sa načítať GAPI klient."));
    document.head.appendChild(script);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gapiReq<T>(token: string, method: string, path: string, params?: Record<string, string>, body?: unknown): Promise<T> {
  await loadGapiClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gapi = (window as any).gapi;
  gapi.client.setToken({ access_token: token });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp: any = await gapi.client.request({ path, method, params, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (resp.status >= 400) throw new Error(`Drive API ${resp.status}: ${JSON.stringify(resp.result)}`);
  return resp.result as T;
}

/** Verifies token has drive.appdata scope; throws with helpful message if not. */
async function assertDriveScope(token: string): Promise<void> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return; // tokeninfo unreachable — proceed anyway
    const info = await res.json();
    const scopes: string = info.scope ?? "";
    if (!scopes.includes("drive.appdata")) {
      throw new Error(
        `Token nemá drive.appdata scope. Scopes: ${scopes || "(žiadne)"}. ` +
        `Odhlásiť sa z Google a skúsiť znova.`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("drive.appdata")) throw e;
    // network error on tokeninfo — proceed, Drive API will 403 if truly missing
  }
}

// ── GIS script loading ────────────────────────────────────────────────────────

let gisLoaded = false;

export function loadGIS(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (gisLoaded || (window as any).google?.accounts) {
    gisLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
    if (existing) { existing.addEventListener("load", () => { gisLoaded = true; resolve(); }); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Nepodarilo sa načítať Google Identity Services."));
    document.head.appendChild(script);
  });
}

// ── OAuth2 token request ──────────────────────────────────────────────────────

export function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) { reject(new Error("Google Identity Services nie je načítané.")); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GDRIVE_SCOPE,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.error) reject(new Error(`Google auth chyba: ${response.error}`));
        else if (response.access_token) resolve(response.access_token);
        else reject(new Error("Google nevrátil access token."));
      },
    });
    // prompt:'consent' forces fresh consent screen so token always includes drive.appdata scope
    client.requestAccessToken({ prompt: "consent" });
  });
}

// ── Drive helpers (via GAPI client) ──────────────────────────────────────────

interface DriveFile { id: string; modifiedTime: string; }

async function findBackupFile(token: string): Promise<DriveFile | null> {
  const data = await gapiReq<{ files: DriveFile[] }>(token, "GET", "/drive/v3/files", {
    spaces: "appDataFolder",
    fields: "files(id,modifiedTime)",
    q: `name = '${BACKUP_FILENAME}'`,
  });
  return data.files?.[0] ?? null;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadToDrive(token: string, content: string): Promise<string> {
  await assertDriveScope(token);
  const existing = await findBackupFile(token);

  if (existing) {
    const data = await gapiReq<{ modifiedTime?: string }>(
      token, "PATCH",
      `/upload/drive/v3/files/${existing.id}`,
      { uploadType: "media", fields: "modifiedTime" },
      content
    );
    const ts = data.modifiedTime ?? new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, ts);
    return ts;
  }

  // Create new file — step 1: metadata
  const meta = await gapiReq<{ id: string }>(token, "POST", "/drive/v3/files", { fields: "id" }, {
    name: BACKUP_FILENAME,
    parents: ["appDataFolder"],
  });
  const { id } = meta;

  // Step 2: upload content
  const uploadData = await gapiReq<{ modifiedTime?: string }>(
    token, "PATCH",
    `/upload/drive/v3/files/${id}`,
    { uploadType: "media", fields: "modifiedTime" },
    content
  );
  const ts = uploadData.modifiedTime ?? new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, ts);
  return ts;
}

// ── Download ──────────────────────────────────────────────────────────────────

export async function downloadFromDrive(token: string): Promise<{ content: string; modifiedTime: string } | null> {
  const file = await findBackupFile(token);
  if (!file) return null;

  // For media download, use fetch directly (GAPI client doesn't handle binary responses well)
  // At this point the CORS preflight is already done via GAPI for list; media download
  // is a simple GET with auth header — try GAPI first, fall back to direct fetch.
  try {
    const content = await gapiReq<string>(token, "GET", `/drive/v3/files/${file.id}`, { alt: "media" });
    localStorage.setItem(LAST_SYNC_KEY, file.modifiedTime);
    return { content: typeof content === "string" ? content : JSON.stringify(content), modifiedTime: file.modifiedTime };
  } catch {
    // fallback: direct fetch with Authorization header
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Sťahovanie zlyhalo ${res.status}`);
    const content = await res.text();
    localStorage.setItem(LAST_SYNC_KEY, file.modifiedTime);
    return { content, modifiedTime: file.modifiedTime };
  }
}

// ── Last sync ─────────────────────────────────────────────────────────────────

export function getLastSync(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}
