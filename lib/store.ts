import type { AppSettings, PortfolioData, PortfolioSnapshot, FinancialGoal } from "./types";
import { STORE_KEYS, MAX_SNAPSHOTS } from "./constants";
import { encrypt, decrypt } from "./crypto";

// ---------- Raw localStorage helpers ----------

function rawGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function rawSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function rawRemove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

// ---------- Settings ----------

export function loadSettings(): AppSettings | null {
  const raw = rawGet(STORE_KEYS.SETTINGS);
  if (!raw) return null;
  try { return JSON.parse(raw) as AppSettings; } catch { return null; }
}

export function saveSettings(settings: AppSettings): void {
  rawSet(STORE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ---------- Portfolio (encrypted) ----------

export async function loadPortfolio(pin: string, salt: string): Promise<PortfolioData | null> {
  const raw = rawGet(STORE_KEYS.PORTFOLIO);
  if (!raw) return null;
  try {
    const json = await decrypt(raw, pin, salt);
    return JSON.parse(json) as PortfolioData;
  } catch { return null; }
}

export async function savePortfolio(portfolio: PortfolioData, pin: string, salt: string): Promise<void> {
  const encrypted = await encrypt(JSON.stringify(portfolio), pin, salt);
  rawSet(STORE_KEYS.PORTFOLIO, encrypted);
}

// ---------- API key helpers ----------

export async function saveApiKey(
  field: "binanceKey" | "binanceSecret" | "coingeckoKey" | "claudeKey",
  value: string,
  pin: string,
  settings: AppSettings
): Promise<AppSettings> {
  const encrypted = await encrypt(value, pin, settings.salt);
  const updated: AppSettings = { ...settings, [field]: encrypted };
  saveSettings(updated);
  return updated;
}

export async function loadApiKey(
  field: "binanceKey" | "binanceSecret" | "coingeckoKey" | "claudeKey",
  pin: string,
  settings: AppSettings
): Promise<string | null> {
  const encrypted = settings[field];
  if (!encrypted) return null;
  try { return await decrypt(encrypted, pin, settings.salt); } catch { return null; }
}

// ---------- Portfolio snapshots (plain JSON — no personal amounts, just aggregates) ----------

export function loadSnapshots(): PortfolioSnapshot[] {
  const raw = rawGet(STORE_KEYS.SNAPSHOTS);
  if (!raw) return [];
  try { return JSON.parse(raw) as PortfolioSnapshot[]; } catch { return []; }
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  const existing = loadSnapshots();
  // Replace today's snapshot if it already exists
  const filtered = existing.filter((s) => s.date !== snapshot.date);
  const updated = [...filtered, snapshot]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SNAPSHOTS);
  rawSet(STORE_KEYS.SNAPSHOTS, JSON.stringify(updated));
}

// ---------- Financial goals (plain JSON) ----------

export function loadGoals(): FinancialGoal[] {
  const raw = rawGet(STORE_KEYS.GOALS);
  if (!raw) return [];
  try { return JSON.parse(raw) as FinancialGoal[]; } catch { return []; }
}

export function saveGoals(goals: FinancialGoal[]): void {
  rawSet(STORE_KEYS.GOALS, JSON.stringify(goals));
}

// ---------- Session (in-memory only) ----------

let _sessionPin: string | null = null;

export function setSession(pin: string): void { _sessionPin = pin; }
export function getSession(): string | null { return _sessionPin; }
export function clearSession(): void { _sessionPin = null; }

// ---------- Export / Import ----------

export async function exportBackup(pin: string, salt: string): Promise<string> {
  // Export decrypted portfolio + settings (minus PIN hash) as JSON
  const portfolio = await loadPortfolio(pin, salt);
  const goals = loadGoals();
  const snapshots = loadSnapshots();
  return JSON.stringify({ portfolio, goals, snapshots, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importBackup(json: string, pin: string, salt: string): Promise<void> {
  const data = JSON.parse(json);
  if (data.portfolio) await savePortfolio(data.portfolio as PortfolioData, pin, salt);
  if (data.goals) saveGoals(data.goals as FinancialGoal[]);
  if (data.snapshots) rawSet(STORE_KEYS.SNAPSHOTS, JSON.stringify(data.snapshots));
}

// ---------- Full wipe ----------

export function wipeAll(): void {
  rawRemove(STORE_KEYS.SETTINGS);
  rawRemove(STORE_KEYS.PORTFOLIO);
  rawRemove(STORE_KEYS.SNAPSHOTS);
  rawRemove(STORE_KEYS.GOALS);
  clearSession();
}
