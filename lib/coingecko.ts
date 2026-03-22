import { COINGECKO_BASE } from "./constants";
import type { CryptoPrice } from "./types";

interface GeckoSimplePrice {
  [coinId: string]: {
    eur: number;
    usd: number;
    eur_24h_change?: number;
  };
}

export async function fetchCryptoPrices(
  coinIds: string[],
  apiKey?: string | null
): Promise<CryptoPrice[]> {
  if (coinIds.length === 0) return [];

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const ids = coinIds.join(",");
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=eur&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();
  return data.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    current_price: coin.current_price,
    price_change_percentage_24h: coin.price_change_percentage_24h ?? 0,
    market_cap: coin.market_cap,
  }));
}

export async function fetchSimplePrices(
  coinIds: string[],
  apiKey?: string | null
): Promise<GeckoSimplePrice> {
  if (coinIds.length === 0) return {};

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const ids = coinIds.join(",");
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=eur,usd&include_24hr_change=true`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  return res.json();
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
