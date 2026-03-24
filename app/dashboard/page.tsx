"use client";

import React, { useState } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { FALLBACK_RATES, CURRENCY_SYMBOLS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Coins, Wallet, Building2, Bitcoin, PiggyBank, LineChart, Home, LayoutDashboard, CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { loadRecurringExpenses } from "@/lib/store";
import type { RecurringExpense } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  commodity: "#fbbf24",
  cash: "#34d399",
  pension: "#a78bfa",
  bank: "#38bdf8",
  crypto: "#fb923c",
  stock: "#60a5fa",
  realestate: "#10b981",
};

const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Komodity",
  cash: "Hotovosť",
  pension: "II. Pilier",
  bank: "Bankové účty",
  crypto: "Krypto",
  stock: "Akcie",
  realestate: "Nehnuteľnosti",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  commodity: Coins,
  cash: Wallet,
  pension: PiggyBank,
  bank: Building2,
  crypto: Bitcoin,
  stock: LineChart,
  realestate: Home,
};

function groupByCategory(assets: { category: string; valueEur: number }[]) {
  return assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + a.valueEur;
    return acc;
  }, {});
}

function pct(val: number, total: number) {
  if (total === 0) return "0%";
  return ((val / total) * 100).toFixed(1) + "%";
}

function getUpcomingRecurring(days = 7): Array<RecurringExpense & { dueDate: Date; daysLeft: number }> {
  const recurring = loadRecurringExpenses();
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);
  const results: Array<RecurringExpense & { dueDate: Date; daysLeft: number }> = [];
  for (const r of recurring) {
    if (!r.active || r.type === "income") continue;
    const year = now.getFullYear();
    const month = now.getMonth();
    // monthly: check this month and next
    const candidates: Date[] = [];
    if (r.frequency === "monthly") {
      candidates.push(new Date(year, month, r.dayOfMonth));
      candidates.push(new Date(year, month + 1, r.dayOfMonth));
    } else if (r.frequency === "annual") {
      const rMonth = r.month ?? new Date(r.startDate).getMonth();
      candidates.push(new Date(year, rMonth, r.dayOfMonth));
      candidates.push(new Date(year + 1, rMonth, r.dayOfMonth));
    }
    for (const d of candidates) {
      if (d >= now && d <= horizon) {
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
        results.push({ ...r, dueDate: d, daysLeft });
        break;
      }
    }
  }
  return results.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function fmtNum(val: number, currency = "EUR", rates: Record<string, number> = {}) {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(val * rate);
}

const CHART_RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1r", days: 365 },
] as const;

export default function DashboardPage() {
  const [assetFilter, setAssetFilter] = React.useState("all");
  const [chartRange, setChartRange] = useState<30 | 90 | 365>(30);
  const {
    portfolioSummary,
    portfolioLoading,
    goldPrice,
    silverPrice,
    cryptoPrices,
    rates,
    pricesLoading,
    refreshPrices,
    snapshots,
    settings,
  } = useApp();

  const displayCurrency = settings?.displayCurrency ?? settings?.baseCurrency ?? "EUR";
  const displayRate = rates[displayCurrency] ?? FALLBACK_RATES[displayCurrency] ?? 1;
  const displaySymbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;

  const summary = portfolioSummary;
  const grouped = summary ? groupByCategory(summary.assets) : {};

  const pieData = Object.entries(grouped).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] ?? key,
    value: Math.round(value),
    color: CATEGORY_COLORS[key] ?? "#888",
  }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const chartData = snapshots.slice(-chartRange).map((s) => ({
    date: s.date.slice(5),
    total: Math.round(s.totalEur * displayRate),
  }));

  const firstSnap = chartData[0]?.total ?? 0;
  const lastSnap = chartData[chartData.length - 1]?.total ?? 0;
  const snapshotGain = lastSnap - firstSnap;
  const snapshotGainPct = firstSnap > 0 ? ((snapshotGain / firstSnap) * 100).toFixed(1) : null;

  const totalRaw = Math.round((summary?.totalEur ?? 0) * displayRate);
  const animatedTotal = useCountUp(totalRaw);
  const isLoading = (portfolioLoading || pricesLoading) && !summary;
  const upcomingPayments = React.useMemo(() => getUpcomingRecurring(7), []);

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Prehľad tvojho majetku</p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshPrices} disabled={pricesLoading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${pricesLoading ? "animate-spin" : ""}`} />
            Aktualizovať
          </Button>
        </div>

        {/* Total balance — clean hero */}
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Celkový majetok
          </p>
          <p className="mt-2 text-5xl font-normal tracking-tight leading-none tabular-nums"
            style={{ fontFamily: "var(--font-display, inherit)" }}>
            {summary
              ? `${displaySymbol}${animatedTotal.toLocaleString("sk-SK")}`
              : "—"}
          </p>
          {displayCurrency !== "EUR" && summary && (
            <p className="text-muted-foreground text-sm mt-2">
              ≈ {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(summary.totalEur)}
            </p>
          )}
          {snapshotGainPct && chartData.length > 1 && (
            <div className="flex items-center gap-2 mt-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                ${snapshotGain >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"}`}>
                {snapshotGain >= 0
                  ? <TrendingUp className="w-3.5 h-3.5" />
                  : <TrendingDown className="w-3.5 h-3.5" />}
                {snapshotGain >= 0 ? "+" : ""}{displaySymbol}{Math.abs(Math.round(snapshotGain)).toLocaleString("sk-SK")} ({snapshotGainPct}%)
              </span>
              <span className="text-muted-foreground text-xs">posledných {chartRange} dní</span>
            </div>
          )}
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const value = grouped[key] ?? 0;
            const Icon = CATEGORY_ICONS[key];
            const color = CATEGORY_COLORS[key];
            return (
              <Card key={key} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {pct(value, summary?.totalEur ?? 0)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-base font-bold mt-0.5">
                    {displaySymbol}{Math.round(value * displayRate).toLocaleString("sk-SK")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Allocation bars */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Alokácia</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="space-y-3">
                  {[...pieData]
                    .sort((a, b) => b.value - a.value)
                    .map((item) => {
                      const pct = pieTotal > 0 ? (item.value / pieTotal) * 100 : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="flex items-center gap-2 text-sm">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                                style={{ background: item.color }} />
                              {item.name}
                            </span>
                            <span className="font-semibold tabular-nums text-sm">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: item.color }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 text-right">
                            {fmtNum(item.value, displayCurrency)}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <EmptyState
                  icon={LayoutDashboard}
                  title="Žiadne aktíva"
                  description="Pridaj aktíva v jednotlivých sekciách pre zobrazenie alokácie."
                />
              )}
            </CardContent>
          </Card>

          {/* Asset list */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Aktíva</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Category filter chips */}
              {summary && summary.assets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => setAssetFilter("all")}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${assetFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
                  >
                    Všetky
                  </button>
                  {Object.keys(grouped).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setAssetFilter(cat)}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${assetFilter === cat ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
                      style={assetFilter === cat ? {} : { borderColor: CATEGORY_COLORS[cat] ?? "#888", color: CATEGORY_COLORS[cat] ?? "#888" }}
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2.5">
                {summary && summary.assets.length > 0 ? (
                  summary.assets
                    .filter((a) => assetFilter === "all" || a.category === assetFilter)
                    .map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-2 h-8 rounded-full shrink-0"
                            style={{ background: CATEGORY_COLORS[a.category] ?? "#888" }}
                          />
                          <span className="text-sm truncate">{a.label}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {fmtNum(a.valueEur, displayCurrency, rates)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pct(a.valueEur, summary.totalEur)}
                          </p>
                        </div>
                      </div>
                    ))
                ) : (
                  <EmptyState
                    icon={LayoutDashboard}
                    title="Prázdne portfólio"
                    description="Pridaj aktíva v jednotlivých sekciách aplikácie."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History chart */}
        {chartData.length > 1 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold">Vývoj majetku</CardTitle>
              <div className="flex gap-1">
                {CHART_RANGES.map((r) => (
                  <button
                    key={r.days}
                    onClick={() => setChartRange(r.days as 30 | 90 | 365)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      chartRange === r.days
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${displaySymbol}${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                    formatter={(v) => [`${displaySymbol}${Number(v).toLocaleString("sk-SK")}`, "Majetok"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    fill="url(#totalGrad)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Zlato (XAU)",
              value: goldPrice > 0 ? `€${goldPrice.toFixed(0)}` : "—",
              sub: "za oz",
              color: "#fbbf24",
            },
            {
              label: "Striebro (XAG)",
              value: silverPrice > 0 ? `€${silverPrice.toFixed(2)}` : "—",
              sub: "za oz",
              color: "#94a3b8",
            },
            {
              label: "Bitcoin",
              value: cryptoPrices.find((p) => p.id === "bitcoin")
                ? `€${cryptoPrices.find((p) => p.id === "bitcoin")!.current_price.toLocaleString("sk-SK")}`
                : "—",
              sub: "aktuálna cena",
              color: "#fb923c",
            },
            {
              label: "Krypto",
              value: grouped["crypto"]
                ? `${displaySymbol}${Math.round(grouped["crypto"] * displayRate).toLocaleString("sk-SK")}`
                : `${displaySymbol}0`,
              sub: pct(grouped["crypto"] ?? 0, summary?.totalEur ?? 0),
              color: "#fb923c",
            },
          ].map((stat) => (
            <Card key={stat.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: stat.color }} />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <p className="text-lg font-bold">{stat.value}</p>
                {stat.sub && <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Upcoming payments */}
        {upcomingPayments.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                Nadchádzajúce platby (7 dní)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingPayments.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-8 rounded-full bg-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.dueDate.toLocaleDateString("sk-SK")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={r.daysLeft === 0 ? "destructive" : r.daysLeft <= 2 ? "secondary" : "outline"} className="text-xs">
                      {r.daysLeft === 0 ? "Dnes" : `${r.daysLeft}d`}
                    </Badge>
                    <span className="text-sm font-semibold">{r.amount.toLocaleString("sk-SK")} {r.currency}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
