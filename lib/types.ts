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
  googleClientId?: string;
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

// Budget category
export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  monthlyLimit: number; // EUR
  icon: string; // emoji
}

// Expense entry
export interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  currency: Currency;
  date: string; // YYYY-MM-DD
  description: string;
  note?: string;
}

// Recurring expense or income (monthly rent, annual insurance, salary, etc.)
export interface RecurringExpense {
  id: string;
  type: "expense" | "income";  // income = salary, etc.
  categoryId: string;
  amount: number;
  currency: Currency;
  description: string;
  frequency: "monthly" | "annual";
  dayOfMonth: number;   // 1-28, day of month it's due
  month?: number;       // 0-11, for annual: which month it's due
  startDate: string;    // YYYY-MM-DD
  active: boolean;
  note?: string;
}

// Insurance policy
export interface Insurance {
  id: string;
  name: string;            // e.g. "Povinné ručenie Škoda Octavia"
  type: "car_liability" | "car_comprehensive" | "property" | "life" | "health" | "travel" | "other";
  provider: string;        // e.g. "Allianz"
  policyNumber?: string;
  annualPremium: number;
  currency: Currency;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  autoRenewal: boolean;
  note?: string;
}

// Price alert
export interface PriceAlert {
  id: string;
  assetType: "gold" | "silver" | "crypto";
  coinId?: string;   // for crypto — CoinGecko ID
  label: string;     // display name, e.g. "Bitcoin", "Zlato"
  condition: "above" | "below";
  targetPrice: number; // EUR
  triggered: boolean;
  createdAt: string;
}

// AI Recommendation
export interface Recommendation {
  category: "allocation" | "risk" | "opportunity" | "warning";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}
