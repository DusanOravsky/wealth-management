export type Currency = "EUR" | "USD" | "CZK" | "GBP";

export interface Commodity {
  id: string;
  name: string;
  symbol: "XAU" | "XAG" | "XPT" | "XPD" | string;
  unit: "oz" | "g" | "kg";
  amount: number;
  purchasePrice: number;
  currency: Currency;
  note?: string;
}

export interface CashEntry {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
  note?: string;
}

export interface PensionEntry {
  id: string;
  provider: string;
  value: number;
  currency: Currency;
  updatedAt: string;
  note?: string;
}

export interface BankAccount {
  id: string;
  bank: string;
  name: string;
  iban?: string;
  balance: number;
  currency: Currency;
  note?: string;
}

export interface CryptoHolding {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  exchange: "binance" | "other";
  purchasePrice?: number;
  purchaseCurrency?: Currency;
  note?: string;
}

export interface StockHolding {
  id: string;
  ticker: string;       // e.g. "AAPL"
  name: string;         // e.g. "Apple Inc."
  amount: number;       // number of shares
  purchasePrice: number; // price per share at purchase
  currentPrice?: number; // manually updated current price
  currency: Currency;
  exchange?: string;    // e.g. "NASDAQ", "Bratislavská burza"
  note?: string;
}

export interface RealEstateHolding {
  id: string;
  name: string;         // e.g. "Byt Bratislava"
  type: "apartment" | "house" | "cottage" | "land" | "commercial" | "other";
  estimatedValue: number; // current estimated market value
  currency: Currency;
  purchasePrice?: number;
  purchaseYear?: number;
  area?: number;        // m²
  note?: string;
}

export interface PortfolioData {
  commodities: Commodity[];
  cash: CashEntry[];
  pension: PensionEntry[];
  bankAccounts: BankAccount[];
  crypto: CryptoHolding[];
  stocks: StockHolding[];
  realestate: RealEstateHolding[];
  updatedAt: string;
}

export interface AppSettings {
  pinHash: string;
  salt: string;
  pinAttempts?: number;
  pinLockedUntil?: number; // timestamp ms
  binanceKey?: string;
  binanceSecret?: string;
  coingeckoKey?: string;
  claudeKey?: string;
  baseCurrency: Currency;
  displayCurrency?: Currency;
  autoLockMinutes?: number;
  // Personal profile
  birthYear?: number;
  retirementAge?: number; // target retirement age, default 65
  monthlyIncome?: number; // net monthly income in baseCurrency
}

export interface StoredData {
  settings: AppSettings | null;
  portfolio: PortfolioData | null;
}

// Portfolio snapshot for history chart
export interface PortfolioSnapshot {
  date: string; // YYYY-MM-DD
  totalEur: number;
  breakdown: Record<string, number>; // category -> EUR value
}

// Financial goal
export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currency: Currency;
  deadline?: string; // ISO date
  color?: string;
  note?: string;
}

// Price data from CoinGecko
export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

export interface CommodityPrice {
  symbol: string;
  priceUsd: number;
  priceEur: number;
  change24h: number;
}

// Portfolio value summary
export interface AssetSummary {
  label: string;
  valueEur: number;
  category: "commodity" | "cash" | "pension" | "bank" | "crypto" | "stock" | "realestate";
}

export interface PortfolioSummary {
  totalEur: number;
  assets: AssetSummary[];
  lastUpdated: string;
}

// AI Recommendation
export interface Recommendation {
  category: "allocation" | "risk" | "opportunity" | "warning";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}
