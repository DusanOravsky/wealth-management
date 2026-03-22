"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { groupByCategory } from "@/lib/portfolio-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
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

function calcMonthsToFIRE(
  currentSavings: number,
  monthlyContrib: number,
  fireNumber: number,
  annualRate: number
): number {
  if (currentSavings >= fireNumber) return 0;
  const r = annualRate / 100 / 12;
  if (r <= 0) {
    if (monthlyContrib <= 0) return Infinity;
    return (fireNumber - currentSavings) / monthlyContrib;
  }
  const denom = currentSavings * r + monthlyContrib;
  if (denom <= 0) return Infinity;
  const numer = fireNumber * r + monthlyContrib;
  if (numer <= denom) return 0;
  return Math.log(numer / denom) / Math.log(1 + r);
}

export default function PlanningPage() {
  const { portfolioSummary } = useApp();

  const grouped = useMemo(
    () => (portfolioSummary ? groupByCategory(portfolioSummary) : {}),
    [portfolioSummary]
  );
  const total = portfolioSummary?.totalEur ?? 0;

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

  // FIRE calculator state
  const [monthlyExpenses, setMonthlyExpenses] = useState(2000);
  const [monthlyContrib, setMonthlyContrib] = useState(500);
  const [annualReturn, setAnnualReturn] = useState(7);
  const [swr, setSwr] = useState(4);

  const fireNumber = useMemo(
    () => (monthlyExpenses * 12) / (swr / 100),
    [monthlyExpenses, swr]
  );

  const months = useMemo(
    () => calcMonthsToFIRE(total, monthlyContrib, fireNumber, annualReturn),
    [total, monthlyContrib, fireNumber, annualReturn]
  );

  const years = isFinite(months) ? months / 12 : null;
  const targetYear = years != null ? new Date().getFullYear() + Math.ceil(years) : null;
  const progressPct = Math.min(100, (total / fireNumber) * 100);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Plánovanie</h1>
          <p className="text-muted-foreground text-sm mt-1">Alokácia portfólia a FIRE kalkulátor</p>
        </div>

        <Tabs defaultValue="allocation">
          <TabsList>
            <TabsTrigger value="allocation">Alokácia</TabsTrigger>
            <TabsTrigger value="fire">FIRE kalkulátor</TabsTrigger>
          </TabsList>

          {/* ── Allocation tab ── */}
          <TabsContent value="allocation" className="space-y-6 mt-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Celkový majetok</p>
                <p className="text-3xl font-bold mt-1">{fmt(total)}</p>
              </CardContent>
            </Card>

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
                          style={{ width: `${Math.min(d.current, 100)}%`, background: CATEGORY_COLORS[d.key] }}
                        />
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

            <Card>
              <CardHeader><CardTitle className="text-base">Návrhy na rebalancovanie</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {chartData.filter((d) => Math.abs(d.diff) > 5)
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
          </TabsContent>

          {/* ── FIRE calculator tab ── */}
          <TabsContent value="fire" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">FIRE kalkulátor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Mesačné výdavky (€)</label>
                    <Input
                      type="number"
                      value={monthlyExpenses}
                      onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Mesačná investícia (€)</label>
                    <Input
                      type="number"
                      value={monthlyContrib}
                      onChange={(e) => setMonthlyContrib(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Očakávaný ročný výnos (%)</label>
                    <Input
                      type="number"
                      value={annualReturn}
                      onChange={(e) => setAnnualReturn(Number(e.target.value))}
                      min={0}
                      max={30}
                      step={0.5}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Safe Withdrawal Rate (%)</label>
                    <Input
                      type="number"
                      value={swr}
                      onChange={(e) => setSwr(Number(e.target.value))}
                      min={1}
                      max={10}
                      step={0.5}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="pt-6">
                  <p className="text-primary-foreground/70 text-sm">FIRE číslo</p>
                  <p className="text-2xl font-bold mt-1">{fmt(fireNumber)}</p>
                  <p className="text-primary-foreground/60 text-xs mt-1">pri SWR {swr}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">Aktuálny majetok</p>
                  <p className="text-2xl font-bold mt-1">{fmt(total)}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {progressPct.toFixed(1)}% z FIRE čísla
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">Zostatok do FIRE</p>
                  <p className="text-2xl font-bold mt-1">
                    {years != null
                      ? `${years.toFixed(1)} r.`
                      : "∞"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {targetYear ? `cca rok ${targetYear}` : "Navýš mesačnú investíciu"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progress bar */}
            <Card>
              <CardHeader><CardTitle className="text-base">Postup k FIRE</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{fmt(total)}</span>
                    <span className="text-muted-foreground">{fmt(fireNumber)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-4">
                    <div
                      className="h-4 rounded-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {progressPct.toFixed(1)}% dosiahnuté
                  </p>
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                  <p>
                    <strong>Vzorec:</strong> FIRE číslo = ročné výdavky ÷ SWR
                    ({fmt(monthlyExpenses * 12)} ÷ {swr / 100} = {fmt(fireNumber)})
                  </p>
                  <p className="mt-1">
                    Aktuálny majetok rastie o {annualReturn}%/rok + {fmt(monthlyContrib)}/mesiac investície.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
