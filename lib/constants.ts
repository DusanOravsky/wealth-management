export const STORE_KEYS = {
  SETTINGS: "wm_settings",
  PORTFOLIO: "wm_portfolio",
  SNAPSHOTS: "wm_snapshots",
  GOALS: "wm_goals",
  ALERTS: "wm_alerts",
  INSURANCE: "wm_insurance",
} as const;

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
export const BINANCE_BASE = "https://api.binance.com";

// Default crypto coins to show if no holdings
export const DEFAULT_CRYPTO_IDS = [
  "bitcoin",
  "ethereum",
  "binancecoin",
  "solana",
];

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
