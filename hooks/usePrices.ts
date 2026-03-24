"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchCryptoPrices, fetchCommodityPrices, fetchExchangeRates, fetchStockPrices } from "@/lib/coingecko";
import type { CryptoPrice } from "@/lib/types";

interface Prices {
  crypto: CryptoPrice[];
  gold: number;     // EUR per oz
  silver: number;   // EUR per oz
  platinum: number; // EUR per oz
  palladium: number; // EUR per oz
  stockPrices: Record<string, number>; // ticker → USD price
  rates: Record<string, number>;
  lastUpdated: string | null;
  loading: boolean;
  error: string | null;
}

export function usePrices(
  symbols: string[],          // uppercase crypto symbols: ["BTC", "ETH", ...]
  coingeckoApiKey?: string | null,
  stockTickers: string[] = []
) {
  const [prices, setPrices] = useState<Prices>({
    crypto: [],
    gold: 0,
    silver: 0,
    platinum: 0,
    palladium: 0,
    stockPrices: {},
    rates: { EUR: 1 },
    lastUpdated: null,
    loading: false,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    setPrices((p) => ({ ...p, loading: true, error: null }));
    try {
      const [rates, crypto, commodities, stockPrices] = await Promise.all([
        fetchExchangeRates(),
        fetchCryptoPrices(symbols, 1),
        fetchCommodityPrices(coingeckoApiKey),
        stockTickers.length > 0 ? fetchStockPrices(stockTickers) : Promise.resolve({}),
      ]);
      setPrices({
        crypto,
        gold: commodities.gold,
        silver: commodities.silver,
        platinum: commodities.platinum,
        palladium: commodities.palladium,
        stockPrices,
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
  }, [symbols, coingeckoApiKey, stockTickers]);

  useEffect(() => {
    fetchAll();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { ...prices, refresh: fetchAll };
}
