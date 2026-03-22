"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { calcPortfolioSummary, groupByCategory } from "@/lib/portfolio-calc";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_COLORS: Record<string, string> = {
  commodity: "#f59e0b",
  cash: "#10b981",
  pension: "#6366f1",
  bank: "#3b82f6",
  crypto: "#f97316",
};

const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Komodity",
  cash: "Hotovosť",
  pension: "II. Pilier",
  bank: "Bankové účty",
  crypto: "Krypto",
};

function fmt(val: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
}

function pct(val: number, total: number) {
  if (total === 0) return "0%";
  return ((val / total) * 100).toFixed(1) + "%";
}

export default function DashboardPage() {
  const { portfolio, goldPrice, silverPrice, cryptoPrices, rates, pricesLoading, refreshPrices } = useApp();

  const summary = useMemo(() => {
    if (!portfolio) return null;
    return calcPortfolioSummary(portfolio, { gold: goldPrice, silver: silverPrice, crypto: cryptoPrices, rates });
  }, [portfolio, goldPrice, silverPrice, cryptoPrices, rates]);

  const grouped = useMemo(() => summary ? groupByCategory(summary) : {}, [summary]);

  const pieData = Object.entries(grouped).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] ?? key,
    value: Math.round(value),
    color: CATEGORY_COLORS[key] ?? "#888",
  }));

  if (!portfolio) {
    return (
      <AppShell>
        <div className="p-8 text-muted-foreground">Načítavam portfólio...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Prehľad tvojho majetku
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshPrices} disabled={pricesLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${pricesLoading ? "animate-spin" : ""}`} />
            Aktualizovať
          </Button>
        </div>

        {/* Total */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="pt-6">
            <p className="text-primary-foreground/70 text-sm">Celkový majetok</p>
            <p className="text-4xl font-bold mt-1">
              {summary ? fmt(summary.totalEur) : "—"}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {Object.entries(grouped).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0">
                  {CATEGORY_LABELS[key]}: {fmt(value)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alokácia majetku</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  Pridaj aktíva pre zobrazenie grafu
                </div>
              )}
            </CardContent>
          </Card>

          {/* Asset breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rozpad majetku</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary && summary.assets.length > 0 ? (
                  summary.assets.map((a, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: CATEGORY_COLORS[a.category] ?? "#888" }}
                        />
                        <span className="text-sm truncate max-w-[180px]">{a.label}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-medium">{fmt(a.valueEur)}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {pct(a.valueEur, summary.totalEur)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">Žiadne aktíva. Pridaj ich v jednotlivých sekciách.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Zlato (XAU/EUR)" value={goldPrice > 0 ? `${CURRENCY_SYMBOLS["EUR"]}${goldPrice.toFixed(0)}` : "—"} sub="za oz" />
          <StatCard label="Striebro (XAG/EUR)" value={silverPrice > 0 ? `${CURRENCY_SYMBOLS["EUR"]}${silverPrice.toFixed(2)}` : "—"} sub="za oz" />
          <StatCard label="Bitcoin" value={cryptoPrices.find(p => p.id === "bitcoin") ? fmt(cryptoPrices.find(p => p.id === "bitcoin")!.current_price) : "—"} sub="aktuálna cena" />
          <StatCard
            label="Krypto portfólio"
            value={grouped["crypto"] ? fmt(grouped["crypto"]) : "€0"}
            sub={pct(grouped["crypto"] ?? 0, summary?.totalEur ?? 0)}
          />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
