// Google Drive sync via Google Identity Services (GIS) + Drive REST API
// Uses appDataFolder scope — backup file is hidden from user's Drive, only this app can see it.

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const BACKUP_FILENAME = "wealth-management-backup.json";
export const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const LAST_SYNC_KEY = "wm_gdrive_last_sync";

// ── GIS script loading ────────────────────────────────────────────────────────

let gisLoaded = false;

export function loadGIS(): Promise<void> {
  if (gisLoaded || (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).google)) {
    gisLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Nepodarilo sa načítať Google Identity Services."));
    document.head.appendChild(script);
  });
}

// ── OAuth2 token request (opens Google popup) ────────────────────────────────

export function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services nie je načítané."));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GDRIVE_SCOPE,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.error) reject(new Error(`Google auth chyba: ${response.error}`));
        else if (response.access_token) resolve(response.access_token);
        else reject(new Error("Google nevrátil access token."));
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

// ── Drive file helpers ────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

async function listBackupFiles(token: string): Promise<DriveFile[]> {
  const url = `${DRIVE_FILES_API}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=name%3D'${BACKUP_FILENAME}'`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive API chyba: ${res.status}`);
  const data = await res.json();
  return (data.files ?? []) as DriveFile[];
}

// ── Upload (create or update) ─────────────────────────────────────────────────

export async function uploadToDrive(token: string, content: string): Promise<string> {
  const files = await listBackupFiles(token);
  const isUpdate = files.length > 0;

  const metadata = isUpdate
    ? { name: BACKUP_FILENAME }
    : { name: BACKUP_FILENAME, parents: ["appDataFolder"] };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([content], { type: "application/json" }));

  const url = isUpdate
    ? `${UPLOAD_API}/${files[0].id}?uploadType=multipart&fields=modifiedTime`
    : `${UPLOAD_API}?uploadType=multipart&fields=modifiedTime`;

  const res = await fetch(url, {
    method: isUpdate ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Nahrávanie zlyhalo: ${res.status}`);

  const data = await res.json();
  const ts = data.modifiedTime ?? new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, ts);
  return ts;
}

// ── Download ──────────────────────────────────────────────────────────────────

export async function downloadFromDrive(token: string): Promise<{ content: string; modifiedTime: string } | null> {
  const files = await listBackupFiles(token);
  if (files.length === 0) return null;

  const file = files[0];
  const res = await fetch(`${DRIVE_FILES_API}/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Sťahovanie zlyhalo: ${res.status}`);

  const content = await res.text();
  localStorage.setItem(LAST_SYNC_KEY, file.modifiedTime);
  return { content, modifiedTime: file.modifiedTime };
}

// ── Last sync timestamp ───────────────────────────────────────────────────────

export function getLastSync(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}
