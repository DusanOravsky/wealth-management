import { COINGECKO_BASE, COINCAP_BASE } from "./constants";
import type { CryptoPrice } from "./types";

// Fetch crypto prices from CoinCap (free, no API key, CORS enabled)
// Matches holdings by symbol (uppercase) — no CoinGecko ID mapping needed.
export async function fetchCryptoPrices(
  symbols: string[],   // uppercase symbols: ["BTC", "ETH", ...]
  usdToEur: number,    // conversion factor: 1 / rates.USD
): Promise<CryptoPrice[]> {
  if (symbols.length === 0) return [];

  const res = await fetch(`${COINCAP_BASE}/assets?limit=250`);
  if (!res.ok) throw new Error(`CoinCap error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets: any[] = data.data ?? [];

  const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));
  return assets
    .filter((a) => symbolSet.has((a.symbol ?? "").toUpperCase()))
    .map((a) => ({
      id: (a.symbol ?? "").toUpperCase(),  // use symbol as id for matching
      symbol: (a.symbol ?? "").toUpperCase(),
      name: a.name ?? "",
      current_price: parseFloat(a.priceUsd ?? "0") * usdToEur,
      price_change_percentage_24h: parseFloat(a.changePercent24Hr ?? "0"),
      market_cap: parseFloat(a.marketCapUsd ?? "0") * usdToEur,
    }));
}

// Fetch physical gold & silver spot prices.
// Primary: fawazahmed0 currency API (GitHub CDN, free, CORS, no key needed)
//   XAU = troy oz of gold per 1 EUR → gold price = 1/xau EUR/oz
//   XAG = troy oz of silver per 1 EUR → silver price = 1/xag EUR/oz
// Fallback: PAX Gold (PAXG) on CoinGecko for gold; silver stays 0.
export async function fetchCommodityPrices(
  apiKey?: string | null,
): Promise<{ gold: number; silver: number }> {
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json"
    );
    if (res.ok) {
      const data = await res.json();
      const rates = data?.eur ?? {};
      const xau: number = rates.xau ?? 0;
      const xag: number = rates.xag ?? 0;
      if (xau > 0) {
        return { gold: 1 / xau, silver: xag > 0 ? 1 / xag : 0 };
      }
    }
  } catch {
    // fall through to CoinGecko fallback
  }

  // Fallback: PAX Gold (PAXG) tracks 1 troy oz of physical gold closely
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=pax-gold&vs_currencies=eur`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        gold: data["pax-gold"]?.eur ?? 0,
        silver: 0,
      };
    }
  } catch {
    // ignore
  }

  return { gold: 0, silver: 0 };
}

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Use CoinGecko to get approximate rates via stablecoin prices is unreliable.
  // Use a free ECB-based endpoint instead.
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR");
    if (!res.ok) throw new Error("rates fetch failed");
    const data = await res.json();
    return {
      EUR: 1,
      USD: data.rates?.USD ?? 1.09,
      CZK: data.rates?.CZK ?? 25.3,
      GBP: data.rates?.GBP ?? 0.85,
    };
  } catch {
    return { EUR: 1, USD: 1.09, CZK: 25.3, GBP: 0.85 };
  }
}
