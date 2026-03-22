import type {
  AppSettings, PortfolioData, PortfolioSnapshot, FinancialGoal,
  PriceAlert, Insurance, BudgetCategory, Expense,
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

// ---------- Session (in-memory only) ----------

let _sessionPin: string | null = null;

export function setSession(pin: string): void { _sessionPin = pin; }
export function getSession(): string | null { return _sessionPin; }
export function clearSession(): void { _sessionPin = null; }

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
  }, null, 2);
}

export async function importBackup(json: string, pin: string, salt: string): Promise<void> {
  const data = JSON.parse(json);
  if (data.portfolio) await savePortfolio(data.portfolio as PortfolioData, pin, salt);
  if (data.goals) saveGoals(data.goals as FinancialGoal[]);
  if (data.snapshots) rawSet(STORE_KEYS.SNAPSHOTS, JSON.stringify(data.snapshots));
  if (data.alerts) saveAlerts(data.alerts as PriceAlert[]);
  if (data.insurance) saveInsurance(data.insurance as Insurance[]);
  if (data.budgetCategories) saveBudgetCategories(data.budgetCategories as BudgetCategory[]);
  if (data.expenses) saveExpenses(data.expenses as Expense[]);
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
  clearSession();
}
