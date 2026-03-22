"use client";

import { useState, useCallback } from "react";
import { loadPortfolio, savePortfolio } from "@/lib/store";
import type { PortfolioData } from "@/lib/types";

const DEFAULT_PORTFOLIO: PortfolioData = {
  commodities: [],
  cash: [],
  pension: [],
  bankAccounts: [],
  crypto: [],
  stocks: [],
  realestate: [],
  updatedAt: new Date().toISOString(),
};

export function usePortfolio(pin: string | null, salt: string | undefined) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!pin || !salt) return;
    setLoading(true);
    try {
      const data = await loadPortfolio(pin, salt);
      setPortfolio(data ?? DEFAULT_PORTFOLIO);
    } finally {
      setLoading(false);
    }
  }, [pin, salt]);

  const save = useCallback(
    async (updated: PortfolioData) => {
      if (!pin || !salt) return;
      const withDate = { ...updated, updatedAt: new Date().toISOString() };
      await savePortfolio(withDate, pin, salt);
      setPortfolio(withDate);
    },
    [pin, salt]
  );

  return { portfolio, loading, load, save };
}
