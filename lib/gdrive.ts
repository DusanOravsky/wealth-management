// Google Drive sync via Google Identity Services (GIS) + Drive REST API
// Uses appDataFolder scope — backup file is hidden from user's Drive, only this app can see it.

// content.googleapis.com is the CORS-friendly endpoint used by Google's GAPI client library
const DRIVE_API = "https://content.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://content.googleapis.com/upload/drive/v3/files";
const BACKUP_FILENAME = "wealth-management-backup.json";
export const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const LAST_SYNC_KEY = "wm_gdrive_last_sync";

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

// ── Drive helpers ─────────────────────────────────────────────────────────────

interface DriveFile { id: string; modifiedTime: string; }

async function driveGet<T>(url: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new Error(`Sieťová chyba pri GET: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function findBackupFile(token: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name = '${BACKUP_FILENAME}'`);
  const url = `${DRIVE_API}?spaces=appDataFolder&fields=files(id,modifiedTime)&q=${q}`;
  const data = await driveGet<{ files: DriveFile[] }>(url, token);
  return data.files?.[0] ?? null;
}

// ── Upload (simple media upload — avoids multipart CORS issues) ───────────────

export async function uploadToDrive(token: string, content: string): Promise<string> {
  await assertDriveScope(token);
  const existing = await findBackupFile(token);
  const auth = { Authorization: `Bearer ${token}` };

  if (existing) {
    let res: Response;
    try {
      res = await fetch(`${UPLOAD_API}/${existing.id}?uploadType=media&fields=modifiedTime`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: content,
      });
    } catch (e) {
      throw new Error(`Sieťová chyba pri update: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Aktualizácia zlyhala ${res.status}: ${JSON.stringify(err)}`);
    }
    const data = await res.json();
    const ts = data.modifiedTime ?? new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, ts);
    return ts;
  }

  // Create new file — step 1: metadata
  let metaRes: Response;
  try {
    metaRes = await fetch(`${DRIVE_API}?fields=id`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: BACKUP_FILENAME, parents: ["appDataFolder"] }),
    });
  } catch (e) {
    throw new Error(`Sieťová chyba pri vytváraní súboru: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(`Vytvorenie súboru zlyhalo ${metaRes.status}: ${JSON.stringify(err)}`);
  }
  const { id } = await metaRes.json();

  // Step 2: upload content
  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${UPLOAD_API}/${id}?uploadType=media&fields=modifiedTime`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: content,
    });
  } catch (e) {
    throw new Error(`Sieťová chyba pri nahrávaní obsahu: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(`Nahrávanie zlyhalo ${uploadRes.status}: ${JSON.stringify(err)}`);
  }
  const data = await uploadRes.json();
  const ts = data.modifiedTime ?? new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, ts);
  return ts;
}

// ── Download ──────────────────────────────────────────────────────────────────

export async function downloadFromDrive(token: string): Promise<{ content: string; modifiedTime: string } | null> {
  const file = await findBackupFile(token);
  if (!file) return null;

  const res = await fetch(`${DRIVE_API}/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sťahovanie zlyhalo ${res.status}: ${JSON.stringify(err)}`);
  }

  const content = await res.text();
  localStorage.setItem(LAST_SYNC_KEY, file.modifiedTime);
  return { content, modifiedTime: file.modifiedTime };
}

// ── Last sync ─────────────────────────────────────────────────────────────────

export function getLastSync(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}
