"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { calcPortfolioSummary, groupByCategory } from "@/lib/portfolio-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const TARGET_ALLOCATION: Record<string, number> = {
  cash: 10,
  bank: 15,
  pension: 20,
  commodity: 20,
  crypto: 35,
};

const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Komodity", cash: "Hotovosť", pension: "II. Pilier", bank: "Banka", crypto: "Krypto",
};

const CATEGORY_COLORS: Record<string, string> = {
  commodity: "#f59e0b", cash: "#10b981", pension: "#6366f1", bank: "#3b82f6", crypto: "#f97316",
};

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function PlanningPage() {
  const { portfolio, goldPrice, silverPrice, cryptoPrices, rates } = useApp();

  const summary = useMemo(() => {
    if (!portfolio) return null;
    return calcPortfolioSummary(portfolio, { gold: goldPrice, silver: silverPrice, crypto: cryptoPrices, rates });
  }, [portfolio, goldPrice, silverPrice, cryptoPrices, rates]);

  const grouped = useMemo(() => summary ? groupByCategory(summary) : {}, [summary]);
  const total = summary?.totalEur ?? 0;

  const chartData = Object.keys(TARGET_ALLOCATION).map((key) => {
    const current = total > 0 ? ((grouped[key] ?? 0) / total) * 100 : 0;
    const target = TARGET_ALLOCATION[key];
    return {
      name: CATEGORY_LABELS[key] ?? key,
      key,
      current: parseFloat(current.toFixed(1)),
      target,
      diff: parseFloat((current - target).toFixed(1)),
      valueEur: grouped[key] ?? 0,
    };
  });

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Plánovanie</h1>
          <p className="text-muted-foreground text-sm mt-1">Analýza alokácie a odchýlky od cieľa</p>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celkový majetok</p>
            <p className="text-3xl font-bold mt-1">{fmt(total)}</p>
          </CardContent>
        </Card>

        {/* Allocation vs target chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Aktuálna vs. cieľová alokácia (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="current" name="Aktuálne" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? "#888"} />
                  ))}
                </Bar>
                <Bar dataKey="target" name="Cieľ" fill="#d1d5db" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Deviation table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Odchýlky od cieľa</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chartData.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[d.key] }} />
                      <span className="text-sm font-medium">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{fmt(d.valueEur)}</span>
                      <Badge variant={Math.abs(d.diff) <= 5 ? "secondary" : d.diff > 0 ? "default" : "destructive"}>
                        {d.diff >= 0 ? "+" : ""}{d.diff}%
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 relative">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(d.current, 100)}%`,
                        background: CATEGORY_COLORS[d.key],
                      }}
                    />
                    {/* Target marker */}
                    <div
                      className="absolute top-0 w-0.5 h-2 bg-foreground/50"
                      style={{ left: `${d.target}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Aktuálne: {d.current}%</span>
                    <span>Cieľ: {d.target}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rebalancing suggestions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Návrhy na rebalancovanie</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chartData
                .filter((d) => Math.abs(d.diff) > 5)
                .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                .map((d) => (
                  <div key={d.key} className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                    <Badge variant={d.diff > 0 ? "default" : "destructive"} className="shrink-0 mt-0.5">
                      {d.diff > 0 ? "Nadváha" : "Podváha"}
                    </Badge>
                    <p className="text-sm">
                      <span className="font-medium">{d.name}</span>:{" "}
                      {d.diff > 0
                        ? `Zníž alokáciu o ${fmt(Math.abs(d.diff / 100) * total)} (${Math.abs(d.diff)}%)`
                        : `Navýš alokáciu o ${fmt(Math.abs(d.diff / 100) * total)} (${Math.abs(d.diff)}%)`}
                    </p>
                  </div>
                ))}
              {chartData.every((d) => Math.abs(d.diff) <= 5) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Portfólio je dobre vybalancované. Všetky odchýlky sú do 5%.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
