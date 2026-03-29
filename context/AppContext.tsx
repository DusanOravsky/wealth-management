"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { usePIN } from "@/hooks/usePIN";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/usePrices";
import { loadApiKey, loadGoals, saveGoals, loadSnapshots, saveSnapshot, loadAlerts, saveAlerts } from "@/lib/store";
import { DEFAULT_CRYPTO_SYMBOLS } from "@/lib/constants";
import { calcPortfolioSummary, groupByCategory } from "@/lib/portfolio-calc";
import type {
  AppSettings,
  PortfolioData,
  FinancialGoal,
  PortfolioSnapshot,
  PortfolioSummary,
  CryptoPrice,
} from "@/lib/types";

interface AppContextValue {
  // PIN / auth
  pinState: "loading" | "setup" | "locked" | "unlocked";
  pin: string | null;
  settings: AppSettings | null;
  pinError: string | null;
  lockoutRemaining: number;
  setupPIN: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  changePIN: (current: string, newPin: string) => Promise<boolean>;
  updateSettings: (s: AppSettings) => void;

  // Portfolio
  portfolio: PortfolioData | null;
  portfolioLoading: boolean;
  portfolioSummary: PortfolioSummary | null;
  savePortfolio: (p: PortfolioData) => Promise<void>;
  reloadPortfolio: () => Promise<void>;

  // Prices
  cryptoPrices: CryptoPrice[];
  goldPrice: number;
  silverPrice: number;
  platinumPrice: number;
  palladiumPrice: number;
  stockPrices: Record<string, number>;
  rates: Record<string, number>;
  pricesLoading: boolean;
  pricesError: string | null;
  refreshPrices: () => Promise<void>;

  // Goals
  goals: FinancialGoal[];
  saveGoalsData: (goals: FinancialGoal[]) => void;

  // Snapshots
  snapshots: PortfolioSnapshot[];
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const {
    state: pinState,
    settings,
    pin,
    error: pinError,
    lockoutRemaining,
    setupPIN,
    unlock,
    lock,
    changePIN,
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

  // Goals & snapshots (plain JSON, no PIN needed)
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);

  // Decrypted CoinGecko API key (loaded once after unlock)
  const [coingeckoKey, setCoingeckoKey] = useState<string | null>(null);
  useEffect(() => {
    if (!pin || !settings) { setCoingeckoKey(null); return; }
    loadApiKey("coingeckoKey", pin, settings).then(setCoingeckoKey).catch(() => setCoingeckoKey(null));
  }, [pin, settings?.coingeckoKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setGoals(loadGoals());
    setSnapshots(loadSnapshots());
  }, []);

  const saveGoalsData = useCallback((newGoals: FinancialGoal[]) => {
    saveGoals(newGoals);
    setGoals(newGoals);
  }, []);

  // Gather unique symbols from holdings (CoinCap matches by symbol)
  const cryptoSymbols = useMemo(
    () => [...new Set(portfolio?.crypto.map((h) => h.symbol.toUpperCase()) ?? [])],
    [portfolio]
  );

  const stockTickers = useMemo(
    () => [...new Set(portfolio?.stocks?.map((s) => s.ticker.toUpperCase()) ?? [])],
    [portfolio]
  );

  const {
    crypto: cryptoPrices,
    gold: goldPrice,
    silver: silverPrice,
    platinum: platinumPrice,
    palladium: palladiumPrice,
    stockPrices,
    rates,
    loading: pricesLoading,
    error: pricesError,
    refresh: refreshPrices,
  } = usePrices(cryptoSymbols.length > 0 ? cryptoSymbols : DEFAULT_CRYPTO_SYMBOLS, coingeckoKey, stockTickers);

  // Compute portfolio summary
  const portfolioSummary = useMemo(() => {
    if (!portfolio) return null;
    return calcPortfolioSummary(portfolio, {
      gold: goldPrice,
      silver: silverPrice,
      platinum: platinumPrice,
      palladium: palladiumPrice,
      crypto: cryptoPrices,
      stockPrices,
      rates,
    });
  }, [portfolio, goldPrice, silverPrice, platinumPrice, palladiumPrice, cryptoPrices, stockPrices, rates]);

  // Save daily snapshot when summary is ready
  const snapshotDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!portfolioSummary || pricesLoading) return;
    const today = new Date().toISOString().split("T")[0];
    if (snapshotDateRef.current === today) return;
    snapshotDateRef.current = today;
    const breakdown = groupByCategory(portfolioSummary);
    saveSnapshot({ date: today, totalEur: portfolioSummary.totalEur, breakdown });
    setSnapshots(loadSnapshots());
  }, [portfolioSummary, pricesLoading]);

  // Check price alerts whenever prices update
  useEffect(() => {
    if (pricesLoading) return;
    if (goldPrice === 0 && silverPrice === 0 && cryptoPrices.length === 0) return;
    const alerts = loadAlerts();
    let changed = false;
    for (const alert of alerts) {
      if (alert.triggered) continue;
      let currentPrice = 0;
      if (alert.assetType === "gold") currentPrice = goldPrice;
      else if (alert.assetType === "silver") currentPrice = silverPrice;
      else if (alert.assetType === "platinum") currentPrice = platinumPrice;
      else if (alert.assetType === "palladium") currentPrice = palladiumPrice;
      else if (alert.assetType === "crypto" && alert.coinId) {
        const found = cryptoPrices.find((p) => p.id === alert.coinId);
        currentPrice = found?.current_price ?? 0;
      } else if (alert.assetType === "stock" && alert.ticker) {
        const priceUsd = stockPrices[alert.ticker.toUpperCase()];
        if (priceUsd) currentPrice = priceUsd / (rates["USD"] ?? 1.09);
      }
      if (currentPrice === 0) continue;
      const hit = alert.condition === "above"
        ? currentPrice >= alert.targetPrice
        : currentPrice <= alert.targetPrice;
      if (hit) {
        alert.triggered = true;
        changed = true;
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(`Alert: ${alert.label}`, {
            body: `Cena ${alert.condition === "above" ? "prekročila" : "klesla pod"} ${alert.targetPrice} € (aktuálne: ${currentPrice.toFixed(2)} €)`,
            icon: "/wealth-management/icon-192.png",
          });
        }
      }
    }
    if (changed) saveAlerts(alerts);
  }, [goldPrice, silverPrice, platinumPrice, palladiumPrice, cryptoPrices, stockPrices, rates, pricesLoading]);

  const value: AppContextValue = useMemo(
    () => ({
      pinState,
      pin,
      settings,
      pinError,
      lockoutRemaining,
      setupPIN,
      unlock,
      lock,
      changePIN,
      updateSettings,
      portfolio,
      portfolioLoading,
      portfolioSummary,
      savePortfolio,
      reloadPortfolio,
      cryptoPrices,
      goldPrice,
      silverPrice,
      platinumPrice,
      palladiumPrice,
      stockPrices,
      rates,
      pricesLoading,
      pricesError,
      refreshPrices,
      goals,
      saveGoalsData,
      snapshots,
    }),
    [
      pinState, pin, settings, pinError, lockoutRemaining,
      setupPIN, unlock, lock, changePIN, updateSettings,
      portfolio, portfolioLoading, portfolioSummary,
      savePortfolio, reloadPortfolio,
      cryptoPrices, goldPrice, silverPrice, platinumPrice, palladiumPrice, stockPrices, rates,
      pricesLoading, pricesError, refreshPrices,
      goals, saveGoalsData, snapshots,
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
