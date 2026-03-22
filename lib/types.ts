export type Currency = "EUR" | "USD" | "CZK" | "GBP";

export interface Commodity {
  id: string;
  name: string;
  symbol: "XAU" | "XAG" | string;
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
  updatedAt: string; // ISO date string
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
  coinId: string; // CoinGecko coin ID e.g. "bitcoin"
  symbol: string; // e.g. "BTC"
  name: string;
  amount: number;
  exchange: "binance" | "other";
  purchasePrice?: number;
  purchaseCurrency?: Currency;
  note?: string;
}

export interface PortfolioData {
  commodities: Commodity[];
  cash: CashEntry[];
  pension: PensionEntry[];
  bankAccounts: BankAccount[];
  crypto: CryptoHolding[];
  updatedAt: string;
}

export interface AppSettings {
  pinHash: string; // SHA-256 hex of PIN
  salt: string; // base64 salt for key derivation
  binanceKey?: string; // encrypted base64
  binanceSecret?: string; // encrypted base64
  coingeckoKey?: string; // encrypted base64
  claudeKey?: string; // encrypted base64
  baseCurrency: Currency;
}

export interface StoredData {
  settings: AppSettings | null;
  portfolio: PortfolioData | null;
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
  category: "commodity" | "cash" | "pension" | "bank" | "crypto";
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
