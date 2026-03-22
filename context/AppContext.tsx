"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { usePIN } from "@/hooks/usePIN";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/usePrices";
import { loadApiKey } from "@/lib/store";
import { DEFAULT_CRYPTO_IDS } from "@/lib/constants";
import type { AppSettings, PortfolioData } from "@/lib/types";
import type { CryptoPrice } from "@/lib/types";

interface AppContextValue {
  // PIN / auth
  pinState: "loading" | "setup" | "locked" | "unlocked";
  pin: string | null;
  settings: AppSettings | null;
  pinError: string | null;
  setupPIN: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  updateSettings: (s: AppSettings) => void;

  // Portfolio
  portfolio: PortfolioData | null;
  portfolioLoading: boolean;
  savePortfolio: (p: PortfolioData) => Promise<void>;
  reloadPortfolio: () => Promise<void>;

  // Prices
  cryptoPrices: CryptoPrice[];
  goldPrice: number;
  silverPrice: number;
  rates: Record<string, number>;
  pricesLoading: boolean;
  pricesError: string | null;
  refreshPrices: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const {
    state: pinState,
    settings,
    pin,
    error: pinError,
    setupPIN,
    unlock,
    lock,
    updateSettings,
  } = usePIN();

  const { portfolio, loading: portfolioLoading, load: reloadPortfolio, save: savePortfolio } =
    usePortfolio(pin, settings?.salt);

  // Load portfolio once unlocked
  useEffect(() => {
    if (pinState === "unlocked" && pin) {
      reloadPortfolio();
    }
  }, [pinState, pin, reloadPortfolio]);

  // Gather unique coin IDs from holdings
  const coinIds = useMemo(
    () => [...new Set(portfolio?.crypto.map((h) => h.coinId) ?? [])],
    [portfolio]
  );

  // Get CoinGecko key from settings (decrypt on the fly — async, so we pass null initially)
  // We load it separately in a useEffect or pass null; prices refresh every 5min so it's fine
  const {
    crypto: cryptoPrices,
    gold: goldPrice,
    silver: silverPrice,
    rates,
    loading: pricesLoading,
    error: pricesError,
    refresh: refreshPrices,
  } = usePrices(coinIds.length > 0 ? coinIds : DEFAULT_CRYPTO_IDS);

  const value: AppContextValue = useMemo(
    () => ({
      pinState,
      pin,
      settings,
      pinError,
      setupPIN,
      unlock,
      lock,
      updateSettings,
      portfolio,
      portfolioLoading,
      savePortfolio,
      reloadPortfolio,
      cryptoPrices,
      goldPrice,
      silverPrice,
      rates,
      pricesLoading,
      pricesError,
      refreshPrices,
    }),
    [
      pinState, pin, settings, pinError, setupPIN, unlock, lock, updateSettings,
      portfolio, portfolioLoading, savePortfolio, reloadPortfolio,
      cryptoPrices, goldPrice, silverPrice, rates, pricesLoading, pricesError, refreshPrices,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Helper to load a decrypted API key
export async function getDecryptedKey(
  field: "binanceKey" | "binanceSecret" | "coingeckoKey" | "claudeKey",
  pin: string,
  settings: AppSettings
): Promise<string | null> {
  return loadApiKey(field, pin, settings);
}
