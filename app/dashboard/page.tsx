"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { FALLBACK_RATES, CURRENCY_SYMBOLS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Coins, Wallet, Building2, Bitcoin, PiggyBank, LineChart, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function fmtNum(val: number, currency = "EUR", rates: Record<string, number> = {}) {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(val * rate);
}

export default function DashboardPage() {
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

  const chartData = snapshots.slice(-30).map((s) => ({
    date: s.date.slice(5),
    total: Math.round(s.totalEur * displayRate),
  }));

  const firstSnap = chartData[0]?.total ?? 0;
  const lastSnap = chartData[chartData.length - 1]?.total ?? 0;
  const snapshotGain = lastSnap - firstSnap;
  const snapshotGainPct = firstSnap > 0 ? ((snapshotGain / firstSnap) * 100).toFixed(1) : null;

  const isLoading = (portfolioLoading || pricesLoading) && !summary;

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
      <div className="p-6 space-y-6">
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

        {/* Total balance — gradient hero card */}
        <div
          className="rounded-2xl p-6 text-white relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 60%, #9333ea 100%)",
            boxShadow: "0 8px 32px rgba(99,102,241,0.35)",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, white, transparent)" }} />
          <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, white, transparent)" }} />

          <div className="relative">
            <p className="text-white/65 text-sm font-medium">Celkový majetok</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">
              {summary
                ? `${displaySymbol}${Math.round(summary.totalEur * displayRate).toLocaleString("sk-SK")}`
                : "—"}
            </p>
            {displayCurrency !== "EUR" && summary && (
              <p className="text-white/50 text-sm mt-1">
                ≈ {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(summary.totalEur)}
              </p>
            )}
            {snapshotGainPct && chartData.length > 1 && (
              <div className="flex items-center gap-1.5 mt-3">
                {snapshotGain >= 0
                  ? <TrendingUp className="w-4 h-4 text-green-300" />
                  : <TrendingDown className="w-4 h-4 text-red-300" />}
                <span className={`text-sm font-medium ${snapshotGain >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {snapshotGain >= 0 ? "+" : ""}{displaySymbol}{Math.abs(Math.round(snapshotGain)).toLocaleString("sk-SK")} ({snapshotGainPct}%)
                </span>
                <span className="text-white/40 text-xs">posledných 30 dní</span>
              </div>
            )}
          </div>
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
          {/* Pie chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Alokácia</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                      }}
                      formatter={(v) => fmtNum(Number(v), displayCurrency)}
                    />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                  Pridaj aktíva pre zobrazenie grafu
                </div>
              )}
            </CardContent>
          </Card>

          {/* Asset list */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Aktíva</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {summary && summary.assets.length > 0 ? (
                  summary.assets.map((a, i) => (
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
                  <p className="text-muted-foreground text-sm">
                    Žiadne aktíva. Pridaj ich v jednotlivých sekciách.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History chart */}
        {chartData.length > 1 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Vývoj majetku (30 dní)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
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
      </div>
    </AppShell>
  );
}
