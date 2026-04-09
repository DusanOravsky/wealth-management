export type Currency = "EUR" | "USD" | "CZK" | "GBP";

export interface Commodity {
  id: string;
  name: string;
  symbol: "XAU" | "XAG" | "XPT" | "XPD" | string;
  unit: "oz" | "g" | "kg";
  amount: number;
  purchasePrice: number;
  purchaseTotalEur?: number; // total EUR paid at purchase
  purchaseDate?: string;     // YYYY-MM-DD
  currency: Currency;
  note?: string;
  sold?: boolean;
  soldDate?: string;         // YYYY-MM-DD
  soldTotalEur?: number;     // total EUR received at sale
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
  annualDividendYield?: number; // % e.g. 2.5 for 2.5%
  note?: string;
}

export interface StockWatchItem {
  id: string;
  ticker: string;
  name: string;
  targetPrice?: number; // EUR — alert when price drops to this (buy signal)
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
  annualRent?: number;  // annual rental income in currency
  // Mortgage / loan
  loanAmount?: number;          // original loan amount
  loanInterestRate?: number;    // annual % e.g. 2.5
  loanTermYears?: number;       // total term in years
  loanStartDate?: string;       // YYYY-MM-DD
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
  pinHashVersion?: 1 | 2; // 1 = SHA-256 (legacy), 2 = PBKDF2 (current)
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
  // Progress tracking: if linkedCategory set, uses that portfolio category value.
  // If currentAmount set, uses that. Otherwise falls back to total portfolio.
  linkedCategory?: "commodity" | "cash" | "pension" | "bank" | "crypto" | "stock" | "realestate";
  currentAmount?: number; // manually specified current saved amount in `currency`
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

// Trip / event (groups expenses across months)
export interface Trip {
  id: string;
  name: string;
  icon: string; // emoji
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  note?: string;
}

// Expense entry
export interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  currency: Currency;
  date: string; // YYYY-MM-DD
  description: string;
  tripId?: string;
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
  assetType: "gold" | "silver" | "platinum" | "palladium" | "stock" | "crypto";
  coinId?: string;   // for crypto — CoinGecko ID
  ticker?: string;   // for stock — Yahoo Finance ticker
  label: string;     // display name, e.g. "Bitcoin", "Zlato"
  condition: "above" | "below";
  targetPrice: number; // EUR
  triggered: boolean;
  createdAt: string;
}

// Bank transaction history
export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;         // YYYY-MM-DD
  amount: number;       // always positive
  type: "credit" | "debit";
  description: string;
  note?: string;
}

// Pension contribution history
export interface PensionContribution {
  id: string;
  pensionId: string;
  date: string;         // YYYY-MM-DD
  amount: number;
  currency: Currency;
  note?: string;
}

// Crypto transaction history
export interface CryptoTransaction {
  id: string;
  coinId: string;
  symbol: string;
  type: "buy" | "sell" | "transfer_in" | "transfer_out";
  amount: number;       // coin amount
  pricePerCoin: number; // EUR price at time of transaction
  totalEur: number;
  date: string;         // YYYY-MM-DD
  fee?: number;         // EUR
  note?: string;
}

// Stock transaction history
export interface StockTransaction {
  id: string;
  ticker: string;
  type: "buy" | "sell";
  amount: number;       // number of shares
  pricePerShare: number;
  totalEur: number;
  date: string;         // YYYY-MM-DD
  fee?: number;         // EUR
  note?: string;
}

// Goal milestone
export interface GoalMilestone {
  id: string;
  goalId: string;
  name: string;
  targetAmount?: number;
  completedAt?: string; // ISO date when reached
}

// Alert trigger history entry
export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  label: string;
  condition: "above" | "below";
  targetPrice: number;
  priceAtTrigger: number;
  triggeredAt: string; // ISO timestamp
}

// Insurance claim
export interface InsuranceClaim {
  id: string;
  insuranceId: string;
  date: string;         // YYYY-MM-DD
  amount: number;
  currency: Currency;
  description: string;
  status: "open" | "paid" | "rejected";
  note?: string;
}

// AI Recommendation
export interface Recommendation {
  category: "allocation" | "risk" | "opportunity" | "warning" | "budget";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}
