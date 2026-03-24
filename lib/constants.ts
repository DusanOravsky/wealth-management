export const STORE_KEYS = {
  SETTINGS: "wm_settings",
  PORTFOLIO: "wm_portfolio",
  SNAPSHOTS: "wm_snapshots",
  GOALS: "wm_goals",
  ALERTS: "wm_alerts",
  INSURANCE: "wm_insurance",
  BUDGET_CATEGORIES: "wm_budget_categories",
  EXPENSES: "wm_expenses",
  RECURRING_EXPENSES: "wm_recurring_expenses",
  RECOMMENDATIONS: "wm_recommendations",
  TARGET_ALLOCATION: "wm_target_allocation",
  FIRE_SETTINGS: "wm_fire_settings",
} as const;

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
export const COINCAP_BASE = "https://api.coincap.io/v2";
export const BINANCE_BASE = "https://api.binance.com";

// Default crypto symbols to show if no holdings (used with CoinCap)
export const DEFAULT_CRYPTO_SYMBOLS = ["BTC", "ETH", "BNB", "SOL"];

export const CURRENCIES = ["EUR", "USD", "CZK", "GBP"] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  CZK: "Kč",
  GBP: "£",
};

// Approximate exchange rates as "1 EUR = X currency" (same format as open.er-api.com)
export const FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.09,
  CZK: 25.3,
  GBP: 0.85,
};

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 30_000; // 30 seconds
export const AUTO_LOCK_DEFAULT_MINUTES = 10;

// Commodity symbols with metadata
export const COMMODITY_META: Record<string, { name: string; metals_live_id?: string }> = {
  XAU: { name: "Zlato", metals_live_id: "gold" },
  XAG: { name: "Striebro", metals_live_id: "silver" },
  XPT: { name: "Platina", metals_live_id: "platinum" },
  XPD: { name: "Paládium", metals_live_id: "palladium" },
  RE: { name: "Nehnuteľnosť" },
  OTHER: { name: "Iné" },
};

export const MAX_SNAPSHOTS = 365; // keep 1 year of daily snapshots
