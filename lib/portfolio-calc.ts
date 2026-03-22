import type { PortfolioData, PortfolioSummary, AssetSummary } from "./types";
import { FALLBACK_RATES } from "./constants";

function toEur(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return amount / rate;
}

export function calcPortfolioSummary(
  portfolio: PortfolioData,
  prices: {
    gold: number;
    silver: number;
    crypto: { id: string; current_price: number }[];
    rates: Record<string, number>;
  }
): PortfolioSummary {
  const assets: AssetSummary[] = [];

  // Commodities
  for (const c of portfolio.commodities) {
    let pricePerOz = 0;
    if (c.symbol === "XAU") pricePerOz = prices.gold;
    else if (c.symbol === "XAG") pricePerOz = prices.silver;

    // Convert amount to oz if needed
    let amountOz = c.amount;
    if (c.unit === "g") amountOz = c.amount / 31.1035;
    else if (c.unit === "kg") amountOz = c.amount * 32.1507;

    const valueEur = pricePerOz > 0
      ? pricePerOz * amountOz
      : toEur(c.amount * c.purchasePrice, c.currency, prices.rates);

    assets.push({ label: c.name, valueEur, category: "commodity" });
  }

  // Cash
  for (const c of portfolio.cash) {
    assets.push({
      label: c.label,
      valueEur: toEur(c.amount, c.currency, prices.rates),
      category: "cash",
    });
  }

  // Pension
  for (const p of portfolio.pension) {
    assets.push({
      label: p.provider,
      valueEur: toEur(p.value, p.currency, prices.rates),
      category: "pension",
    });
  }

  // Bank accounts
  for (const b of portfolio.bankAccounts) {
    assets.push({
      label: `${b.bank} – ${b.name}`,
      valueEur: toEur(b.balance, b.currency, prices.rates),
      category: "bank",
    });
  }

  // Crypto
  for (const h of portfolio.crypto) {
    const price = prices.crypto.find((p) => p.id === h.coinId);
    const valueEur = price ? price.current_price * h.amount : 0;
    assets.push({
      label: `${h.name} (${h.symbol})`,
      valueEur,
      category: "crypto",
    });
  }

  const totalEur = assets.reduce((sum, a) => sum + a.valueEur, 0);

  return {
    totalEur,
    assets,
    lastUpdated: portfolio.updatedAt,
  };
}

export function groupByCategory(summary: PortfolioSummary): Record<string, number> {
  return summary.assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + a.valueEur;
    return acc;
  }, {});
}
