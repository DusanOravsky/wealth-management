"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchCryptoPrices, fetchCommodityPrices, fetchExchangeRates } from "@/lib/coingecko";
import type { CryptoPrice } from "@/lib/types";

interface Prices {
  crypto: CryptoPrice[];
  gold: number; // EUR per oz
  silver: number; // EUR per oz
  rates: Record<string, number>;
  lastUpdated: string | null;
  loading: boolean;
  error: string | null;
}

export function usePrices(
  symbols: string[],          // uppercase symbols: ["BTC", "ETH", ...]
  coingeckoApiKey?: string | null
) {
  const [prices, setPrices] = useState<Prices>({
    crypto: [],
    gold: 0,
    silver: 0,
    rates: { EUR: 1 },
    lastUpdated: null,
    loading: false,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    setPrices((p) => ({ ...p, loading: true, error: null }));
    try {
      // Fetch rates first — needed for USD→EUR conversion in fetchCryptoPrices
      const rates = await fetchExchangeRates();
      const usdToEur = 1 / (rates.USD ?? 1.09);
      const [crypto, commodities] = await Promise.all([
        fetchCryptoPrices(symbols, usdToEur),
        fetchCommodityPrices(coingeckoApiKey),
      ]);
      setPrices({
        crypto,
        gold: commodities.gold,
        silver: commodities.silver,
        rates,
        lastUpdated: new Date().toISOString(),
        loading: false,
        error: null,
      });

    } catch (e) {
      setPrices((p) => ({
        ...p,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to fetch prices",
      }));
    }
  }, [symbols, coingeckoApiKey]);

  useEffect(() => {
    fetchAll();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { ...prices, refresh: fetchAll };
}
