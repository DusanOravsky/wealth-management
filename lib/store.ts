import type { AppSettings, PortfolioData } from "./types";
import { STORE_KEYS } from "./constants";
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

// ---------- Settings (stored as JSON, sensitive fields encrypted) ----------

export function loadSettings(): AppSettings | null {
  const raw = rawGet(STORE_KEYS.SETTINGS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppSettings;
  } catch {
    return null;
  }
}

export function saveSettings(settings: AppSettings): void {
  rawSet(STORE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function clearSettings(): void {
  rawRemove(STORE_KEYS.SETTINGS);
}

// ---------- Portfolio (stored encrypted as JSON) ----------

export async function loadPortfolio(
  pin: string,
  salt: string
): Promise<PortfolioData | null> {
  const raw = rawGet(STORE_KEYS.PORTFOLIO);
  if (!raw) return null;
  try {
    const json = await decrypt(raw, pin, salt);
    return JSON.parse(json) as PortfolioData;
  } catch {
    return null;
  }
}

export async function savePortfolio(
  portfolio: PortfolioData,
  pin: string,
  salt: string
): Promise<void> {
  const json = JSON.stringify(portfolio);
  const encrypted = await encrypt(json, pin, salt);
  rawSet(STORE_KEYS.PORTFOLIO, encrypted);
}

export function clearPortfolio(): void {
  rawRemove(STORE_KEYS.PORTFOLIO);
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
  try {
    return await decrypt(encrypted, pin, settings.salt);
  } catch {
    return null;
  }
}

// ---------- Session (in-memory only — PIN never written to storage) ----------
// We use a module-level variable so the PIN survives React re-renders but
// is cleared on page reload, requiring re-authentication.

let _sessionPin: string | null = null;

export function setSession(pin: string): void {
  _sessionPin = pin;
}

export function getSession(): string | null {
  return _sessionPin;
}

export function clearSession(): void {
  _sessionPin = null;
}

// ---------- Full wipe ----------

export function wipeAll(): void {
  rawRemove(STORE_KEYS.SETTINGS);
  rawRemove(STORE_KEYS.PORTFOLIO);
  clearSession();
}
