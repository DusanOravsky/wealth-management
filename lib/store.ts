import type {
  AppSettings, PortfolioData, PortfolioSnapshot, FinancialGoal,
  PriceAlert, Insurance, BudgetCategory, Expense, RecurringExpense, Recommendation, StockWatchItem, Trip,
} from "./types";
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

// ---------- Price alerts (plain JSON) ----------

export function loadAlerts(): PriceAlert[] {
  const raw = rawGet(STORE_KEYS.ALERTS);
  if (!raw) return [];
  try { return JSON.parse(raw) as PriceAlert[]; } catch { return []; }
}

export function saveAlerts(alerts: PriceAlert[]): void {
  rawSet(STORE_KEYS.ALERTS, JSON.stringify(alerts));
}

// ---------- Insurance (plain JSON) ----------

export function loadInsurance(): Insurance[] {
  const raw = rawGet(STORE_KEYS.INSURANCE);
  if (!raw) return [];
  try { return JSON.parse(raw) as Insurance[]; } catch { return []; }
}

export function saveInsurance(items: Insurance[]): void {
  rawSet(STORE_KEYS.INSURANCE, JSON.stringify(items));
}

// ---------- Budget categories (plain JSON) ----------

export function loadBudgetCategories(): BudgetCategory[] {
  const raw = rawGet(STORE_KEYS.BUDGET_CATEGORIES);
  if (!raw) return [];
  try { return JSON.parse(raw) as BudgetCategory[]; } catch { return []; }
}

export function saveBudgetCategories(cats: BudgetCategory[]): void {
  rawSet(STORE_KEYS.BUDGET_CATEGORIES, JSON.stringify(cats));
}

// ---------- Expenses (plain JSON) ----------

export function loadExpenses(): Expense[] {
  const raw = rawGet(STORE_KEYS.EXPENSES);
  if (!raw) return [];
  try { return JSON.parse(raw) as Expense[]; } catch { return []; }
}

export function saveExpenses(expenses: Expense[]): void {
  rawSet(STORE_KEYS.EXPENSES, JSON.stringify(expenses));
}

// ---------- Recurring expenses (plain JSON) ----------

export function loadRecurringExpenses(): RecurringExpense[] {
  const raw = rawGet(STORE_KEYS.RECURRING_EXPENSES);
  if (!raw) return [];
  try { return JSON.parse(raw) as RecurringExpense[]; } catch { return []; }
}

export function saveRecurringExpenses(items: RecurringExpense[]): void {
  rawSet(STORE_KEYS.RECURRING_EXPENSES, JSON.stringify(items));
}

// ---------- Recommendations (plain JSON) ----------

export function loadRecommendations(): Recommendation[] {
  const raw = rawGet(STORE_KEYS.RECOMMENDATIONS);
  if (!raw) return [];
  try { return JSON.parse(raw) as Recommendation[]; } catch { return []; }
}

export function saveRecommendations(items: Recommendation[]): void {
  rawSet(STORE_KEYS.RECOMMENDATIONS, JSON.stringify(items));
}

// ---------- Stock Watchlist ----------

export function loadWatchlist(): StockWatchItem[] {
  const raw = rawGet(STORE_KEYS.WATCHLIST);
  if (!raw) return [];
  try { return JSON.parse(raw) as StockWatchItem[]; } catch { return []; }
}

export function saveWatchlist(items: StockWatchItem[]): void {
  rawSet(STORE_KEYS.WATCHLIST, JSON.stringify(items));
}

// ---------- Trips (plain JSON) ----------

export function loadTrips(): Trip[] {
  const raw = rawGet(STORE_KEYS.TRIPS);
  if (!raw) return [];
  try { return JSON.parse(raw) as Trip[]; } catch { return []; }
}

export function saveTrips(items: Trip[]): void {
  rawSet(STORE_KEYS.TRIPS, JSON.stringify(items));
}

// ---------- Session (sessionStorage + in-memory fallback) ----------
// sessionStorage survives page reloads within the same tab (e.g. hard navigation
// in static-export PWA on mobile), but is cleared when the tab is closed.

const SESSION_KEY = "wm_session_pin";
let _sessionPin: string | null = null;

export function setSession(pin: string): void {
  _sessionPin = pin;
  try { sessionStorage.setItem(SESSION_KEY, pin); } catch { /* private mode */ }
}
export function getSession(): string | null {
  if (_sessionPin) return _sessionPin;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) { _sessionPin = stored; return stored; }
  } catch { /* private mode */ }
  return null;
}
export function clearSession(): void {
  _sessionPin = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
}

// ---------- Merge helpers ----------

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  existing.forEach(item => map.set(item.id, item));
  incoming.forEach(item => map.set(item.id, item)); // incoming wins on conflict
  return Array.from(map.values());
}

function mergeSnapshots(existing: PortfolioSnapshot[], incoming: PortfolioSnapshot[]): PortfolioSnapshot[] {
  const map = new Map<string, PortfolioSnapshot>();
  existing.forEach(s => map.set(s.date, s));
  incoming.forEach(s => map.set(s.date, s));
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_SNAPSHOTS);
}

async function mergeAndSavePortfolio(incoming: PortfolioData, pin: string, salt: string): Promise<void> {
  const existing = await loadPortfolio(pin, salt);
  if (!existing) {
    await savePortfolio(incoming, pin, salt);
    return;
  }
  const merged: PortfolioData = {
    commodities: mergeById(existing.commodities, incoming.commodities),
    cash: mergeById(existing.cash, incoming.cash),
    pension: mergeById(existing.pension, incoming.pension),
    bankAccounts: mergeById(existing.bankAccounts, incoming.bankAccounts),
    crypto: mergeById(existing.crypto, incoming.crypto),
    stocks: mergeById(existing.stocks, incoming.stocks),
    realestate: mergeById(existing.realestate, incoming.realestate),
    updatedAt: incoming.updatedAt > existing.updatedAt ? incoming.updatedAt : existing.updatedAt,
  };
  await savePortfolio(merged, pin, salt);
}

// ---------- Export / Import ----------

export async function exportBackup(pin: string, salt: string): Promise<string> {
  const portfolio = await loadPortfolio(pin, salt);
  const settings = loadSettings();
  // Export only non-sensitive settings fields (no PIN hash, salt, or encrypted API keys)
  const settingsSnapshot = settings ? {
    displayCurrency: settings.displayCurrency,
    baseCurrency: settings.baseCurrency,
    autoLockMinutes: settings.autoLockMinutes,
    birthYear: settings.birthYear,
    retirementAge: settings.retirementAge,
    monthlyIncome: settings.monthlyIncome,
    googleClientId: settings.googleClientId,
  } : undefined;
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settingsSnapshot,
    portfolio,
    goals: loadGoals(),
    snapshots: loadSnapshots(),
    alerts: loadAlerts(),
    insurance: loadInsurance(),
    budgetCategories: loadBudgetCategories(),
    expenses: loadExpenses(),
    recurringExpenses: loadRecurringExpenses(),
    trips: loadTrips(),
  }, null, 2);
}

export async function importBackup(json: string, pin: string, salt: string): Promise<void> {
  const data = JSON.parse(json);
  if (!data || typeof data !== "object") throw new Error("Neplatný formát zálohy.");
  if (!data.version || typeof data.version !== "number") throw new Error("Chýba verzia zálohy.");
  if (data.portfolio && (typeof data.portfolio !== "object" || !Array.isArray(data.portfolio.commodities)))
    throw new Error("Poškodené dáta portfólia.");
  if (data.portfolio) await mergeAndSavePortfolio(data.portfolio as PortfolioData, pin, salt);
  if (data.goals) saveGoals(mergeById(loadGoals(), data.goals as FinancialGoal[]));
  if (data.snapshots) rawSet(STORE_KEYS.SNAPSHOTS, JSON.stringify(mergeSnapshots(loadSnapshots(), data.snapshots as PortfolioSnapshot[])));
  if (data.alerts) saveAlerts(mergeById(loadAlerts(), data.alerts as PriceAlert[]));
  if (data.insurance) saveInsurance(mergeById(loadInsurance(), data.insurance as Insurance[]));
  if (data.budgetCategories) saveBudgetCategories(mergeById(loadBudgetCategories(), data.budgetCategories as BudgetCategory[]));
  if (data.expenses) saveExpenses(mergeById(loadExpenses(), data.expenses as Expense[]));
  if (data.recurringExpenses) saveRecurringExpenses(mergeById(loadRecurringExpenses(), data.recurringExpenses as RecurringExpense[]));
  if (data.trips) saveTrips(mergeById(loadTrips(), data.trips as Trip[]));
  // Merge non-sensitive settings (preserve PIN/salt/API keys from current device)
  if (data.settings) {
    const current = loadSettings();
    if (current) {
      saveSettings({
        ...current,
        displayCurrency: data.settings.displayCurrency ?? current.displayCurrency,
        baseCurrency: data.settings.baseCurrency ?? current.baseCurrency,
        autoLockMinutes: data.settings.autoLockMinutes ?? current.autoLockMinutes,
        birthYear: data.settings.birthYear ?? current.birthYear,
        retirementAge: data.settings.retirementAge ?? current.retirementAge,
        monthlyIncome: data.settings.monthlyIncome ?? current.monthlyIncome,
        googleClientId: data.settings.googleClientId ?? current.googleClientId,
      });
    }
  }
}

// ---------- QR Transfer (compact payload, portfolio only) ----------

async function compressB64(data: string): Promise<string> {
  const encoder = new TextEncoder();
  // Wrap the entire compression pipeline in a timeout race
  // writer.close() can hang on some browsers — must be inside the race
  const compress = async () => {
    const stream = new CompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    await writer.write(encoder.encode(data));
    await writer.close();
    const buf = await new Response(stream.readable).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("compression timeout")), 4000)
  );
  return Promise.race([compress(), timeout]);
}

export async function decompressB64(b64: string): Promise<string> {
  const standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(standard);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const buf = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}

export async function exportQRPayload(pin: string, salt: string): Promise<string> {
  const portfolio = await loadPortfolio(pin, salt);
  const settings = loadSettings();
  const payload = {
    v: 3,
    portfolio,
    s: settings ? {
      displayCurrency: settings.displayCurrency,
      birthYear: settings.birthYear,
      retirementAge: settings.retirementAge,
      monthlyIncome: settings.monthlyIncome,
    } : undefined,
    goals: loadGoals(),
    alerts: loadAlerts(),
    ins: loadInsurance(),
    cats: loadBudgetCategories(),
    exp: loadExpenses(),
    rec: loadRecurringExpenses(),
    trips: loadTrips(),
  };
  const json = JSON.stringify(payload);
  try {
    return await compressB64(json);
  } catch {
    // Fallback: plain base64url (no compression) — works for small portfolios
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return "0" + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
}

export async function importQRPayload(encoded: string, pin: string, salt: string): Promise<void> {
  // Detect fallback encoding (prefixed with "0")
  let json: string;
  if (encoded.startsWith("0")) {
    const standard = encoded.slice(1).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(standard);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    json = new TextDecoder().decode(bytes);
  } else {
    json = await decompressB64(encoded);
  }
  const data = JSON.parse(json);
  if (data.portfolio) await mergeAndSavePortfolio(data.portfolio as PortfolioData, pin, salt);
  if (data.s) {
    const current = loadSettings();
    if (current) saveSettings({ ...current, ...data.s });
  }
  if (data.goals) saveGoals(mergeById(loadGoals(), data.goals as FinancialGoal[]));
  if (data.alerts) saveAlerts(mergeById(loadAlerts(), data.alerts as PriceAlert[]));
  if (data.ins) saveInsurance(mergeById(loadInsurance(), data.ins as Insurance[]));
  if (data.cats) saveBudgetCategories(mergeById(loadBudgetCategories(), data.cats as BudgetCategory[]));
  if (data.exp) saveExpenses(mergeById(loadExpenses(), data.exp as Expense[]));
  if (data.rec) saveRecurringExpenses(mergeById(loadRecurringExpenses(), data.rec as RecurringExpense[]));
  if (data.trips) saveTrips(mergeById(loadTrips(), data.trips as Trip[]));
}

// ---------- Full wipe ----------

export function wipeAll(): void {
  rawRemove(STORE_KEYS.SETTINGS);
  rawRemove(STORE_KEYS.PORTFOLIO);
  rawRemove(STORE_KEYS.SNAPSHOTS);
  rawRemove(STORE_KEYS.GOALS);
  rawRemove(STORE_KEYS.ALERTS);
  rawRemove(STORE_KEYS.INSURANCE);
  rawRemove(STORE_KEYS.BUDGET_CATEGORIES);
  rawRemove(STORE_KEYS.EXPENSES);
  rawRemove(STORE_KEYS.RECURRING_EXPENSES);
  rawRemove(STORE_KEYS.RECOMMENDATIONS);
  rawRemove(STORE_KEYS.TARGET_ALLOCATION);
  rawRemove(STORE_KEYS.FIRE_SETTINGS);
  clearSession();
}
