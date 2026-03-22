"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { usePIN } from "@/hooks/usePIN";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/usePrices";
import { loadApiKey, loadGoals, saveGoals, loadSnapshots, saveSnapshot } from "@/lib/store";
import { DEFAULT_CRYPTO_IDS } from "@/lib/constants";
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

  useEffect(() => {
    setGoals(loadGoals());
    setSnapshots(loadSnapshots());
  }, []);

  const saveGoalsData = useCallback((newGoals: FinancialGoal[]) => {
    saveGoals(newGoals);
    setGoals(newGoals);
  }, []);

  // Gather unique coin IDs from holdings
  const coinIds = useMemo(
    () => [...new Set(portfolio?.crypto.map((h) => h.coinId) ?? [])],
    [portfolio]
  );

  const {
    crypto: cryptoPrices,
    gold: goldPrice,
    silver: silverPrice,
    rates,
    loading: pricesLoading,
    error: pricesError,
    refresh: refreshPrices,
  } = usePrices(coinIds.length > 0 ? coinIds : DEFAULT_CRYPTO_IDS);

  // Compute portfolio summary
  const portfolioSummary = useMemo(() => {
    if (!portfolio) return null;
    return calcPortfolioSummary(portfolio, {
      gold: goldPrice,
      silver: silverPrice,
      crypto: cryptoPrices,
      rates,
    });
  }, [portfolio, goldPrice, silverPrice, cryptoPrices, rates]);

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
      cryptoPrices, goldPrice, silverPrice, rates,
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
