"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, Legend,
} from "recharts";
import type { BudgetCategory, Expense, RecurringExpense } from "@/lib/types";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Máj","Jún","Júl","Aug","Sep","Okt","Nov","Dec"];
const MONTH_NAMES_FULL = ["Január","Február","Marec","Apríl","Máj","Jún","Júl","August","September","Október","November","December"];

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function fmtDec(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function getMonthTotal(expenses: Expense[], recurring: RecurringExpense[], year: number, month: number): number {
  const mk = `${year}-${String(month + 1).padStart(2, "0")}`;
  const manual = expenses.filter((e) => e.date.startsWith(mk)).reduce((s, e) => s + e.amount, 0);
  const rec = recurring
    .filter((r) => {
      if (!r.active || r.type === "income") return false;
      const rStart = new Date(r.startDate);
      if (rStart > new Date(year, month + 1, 0)) return false;
      if (r.frequency === "monthly") return true;
      if (r.frequency === "annual") return (r.month ?? new Date(r.startDate).getMonth()) === month;
      return false;
    })
    .reduce((s, r) => s + r.amount, 0);
  return manual + rec;
}

function getCatTotalForPeriod(
  expenses: Expense[], recurring: RecurringExpense[],
  catId: string, months: { year: number; month: number }[]
): number {
  return months.reduce((s, { year, month }) => {
    const mk = `${year}-${String(month + 1).padStart(2, "0")}`;
    const manual = expenses.filter((e) => e.date.startsWith(mk) && e.categoryId === catId).reduce((sum, e) => sum + e.amount, 0);
    const rec = recurring
      .filter((r) => {
        if (!r.active || r.type === "income" || r.categoryId !== catId) return false;
        const rStart = new Date(r.startDate);
        if (rStart > new Date(year, month + 1, 0)) return false;
        if (r.frequency === "monthly") return true;
        if (r.frequency === "annual") return (r.month ?? new Date(r.startDate).getMonth()) === month;
        return false;
      })
      .reduce((sum, r) => sum + r.amount, 0);
    return s + manual + rec;
  }, 0);
}

function getPeriodMonths(period: string, today: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  if (period === "3m") {
    for (let i = 2; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  } else if (period === "6m") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  } else if (period === "12m") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  } else if (period === "thisYear") {
    for (let m = 0; m <= today.getMonth(); m++) {
      months.push({ year: today.getFullYear(), month: m });
    }
  } else if (period === "lastYear") {
    const y = today.getFullYear() - 1;
    for (let m = 0; m < 12; m++) {
      months.push({ year: y, month: m });
    }
  } else {
    // all time — derive from expenses
    return []; // handled separately
  }
  return months;
}

interface Props {
  expenses: Expense[];
  recurring: RecurringExpense[];
  categories: BudgetCategory[];
}

export function BudgetStats({ expenses, recurring, categories }: Props) {
  const [today] = useState(() => new Date());
  const [statsYear, setStatsYear] = useState(today.getFullYear());
  const [compareYearA, setCompareYearA] = useState(today.getFullYear());
  const [compareYearB, setCompareYearB] = useState(today.getFullYear() - 1);
  const [catPeriod, setCatPeriod] = useState("thisYear");
  const [avgPeriod, setAvgPeriod] = useState("6m");
  const [topPeriod, setTopPeriod] = useState("thisYear");

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    expenses.forEach((e) => years.add(parseInt(e.date.slice(0, 4))));
    years.add(today.getFullYear());
    years.add(today.getFullYear() - 1);
    return [...years].sort((a, b) => b - a);
  }, [expenses, today]);

  const totalBudget = useMemo(() => categories.reduce((s, c) => s + c.monthlyLimit, 0), [categories]);

  // ── Section 1: Ročný prehľad ──────────────────────────────────────────────
  const yearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const total = getMonthTotal(expenses, recurring, statsYear, m);
      const isFuture = statsYear === today.getFullYear() && m > today.getMonth();
      return {
        name: MONTH_NAMES[m],
        spent: isFuture ? 0 : parseFloat(total.toFixed(2)),
        budget: totalBudget,
        isFuture,
      };
    });
  }, [expenses, recurring, statsYear, totalBudget, today]);

  const yearTotal = yearlyData.reduce((s, d) => s + d.spent, 0);
  const monthsWithData = yearlyData.filter((d) => d.spent > 0);
  const yearAvg = monthsWithData.length > 0 ? yearTotal / monthsWithData.length : 0;
  const bestMonth = monthsWithData.reduce((best, d) => d.spent < best.spent ? d : best, monthsWithData[0] ?? { name: "—", spent: 0 });
  const worstMonth = monthsWithData.reduce((worst, d) => d.spent > worst.spent ? d : worst, monthsWithData[0] ?? { name: "—", spent: 0 });

  // ── Section 2: Kategórie za obdobie ──────────────────────────────────────
  const catPeriodMonths = useMemo(() => {
    if (catPeriod === "all") {
      const allMonths = new Set<string>();
      expenses.forEach((e) => allMonths.add(e.date.slice(0, 7)));
      return [...allMonths].map((mk) => ({
        year: parseInt(mk.slice(0, 4)),
        month: parseInt(mk.slice(5, 7)) - 1,
      }));
    }
    return getPeriodMonths(catPeriod, today);
  }, [catPeriod, expenses, today]);

  const catPeriodData = useMemo(() => {
    return categories
      .map((cat) => ({
        name: `${cat.icon} ${cat.name}`,
        value: parseFloat(getCatTotalForPeriod(expenses, recurring, cat.id, catPeriodMonths).toFixed(2)),
        color: cat.color,
        id: cat.id,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, expenses, recurring, catPeriodMonths]);

  const catPeriodTotal = catPeriodData.reduce((s, d) => s + d.value, 0);

  // ── Section 3: Ročné porovnanie ───────────────────────────────────────────
  const compareData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const a = getMonthTotal(expenses, recurring, compareYearA, m);
      const b = getMonthTotal(expenses, recurring, compareYearB, m);
      return {
        name: MONTH_NAMES[m],
        [compareYearA]: parseFloat(a.toFixed(2)),
        [compareYearB]: parseFloat(b.toFixed(2)),
      };
    });
  }, [expenses, recurring, compareYearA, compareYearB]);

  const compareTotalA = compareData.reduce((s, d) => s + (d[compareYearA] as number), 0);
  const compareTotalB = compareData.reduce((s, d) => s + (d[compareYearB] as number), 0);
  const compareDelta = compareTotalA - compareTotalB;

  // ── Section 4: Priemer na mesiac ─────────────────────────────────────────
  const avgMonths = useMemo(() => getPeriodMonths(avgPeriod, today), [avgPeriod, today]);

  const avgData = useMemo(() => {
    if (avgMonths.length === 0) return [];
    return categories
      .map((cat) => {
        const total = getCatTotalForPeriod(expenses, recurring, cat.id, avgMonths);
        const avg = total / avgMonths.length;
        return { cat, avg: parseFloat(avg.toFixed(2)), total: parseFloat(total.toFixed(2)) };
      })
      .filter((d) => d.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [categories, expenses, recurring, avgMonths]);

  // ── Section 5: Top výdavky ────────────────────────────────────────────────
  const topMonths = useMemo(() => getPeriodMonths(topPeriod, today), [topPeriod, today]);

  const topExpenses = useMemo(() => {
    const mks = new Set(topMonths.map(({ year, month }) => `${year}-${String(month + 1).padStart(2, "0")}`));
    return [...expenses]
      .filter((e) => mks.has(e.date.slice(0, 7)))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [expenses, topMonths]);

  const PERIOD_LABELS: Record<string, string> = {
    "3m": "Posledné 3 mesiace",
    "6m": "Posledných 6 mesiacov",
    "12m": "Posledných 12 mesiacov",
    "thisYear": `Tento rok (${today.getFullYear()})`,
    "lastYear": `Minulý rok (${today.getFullYear() - 1})`,
    "all": "Všetky časy",
  };

  return (
    <div className="space-y-6 mt-4">

      {/* ── 1. Ročný prehľad ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ročný prehľad výdavkov</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setStatsYear((y) => y - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-sm font-semibold w-12 text-center">{statsYear}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setStatsYear((y) => y + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Spolu za rok</p>
              <p className="text-lg font-bold mt-0.5">{fmt(yearTotal)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Priemer / mesiac</p>
              <p className="text-lg font-bold mt-0.5">{fmt(yearAvg)}</p>
            </div>
            {bestMonth && (
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Najlacnejší mesiac</p>
                <p className="text-lg font-bold mt-0.5 text-green-600 dark:text-green-400">{bestMonth.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(bestMonth.spent)}</p>
              </div>
            )}
            {worstMonth && (
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Najdrahší mesiac</p>
                <p className="text-lg font-bold mt-0.5 text-red-600 dark:text-red-400">{worstMonth.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(worstMonth.spent)}</p>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yearlyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v) => [`${v} €`, "Výdavky"]} />
              {totalBudget > 0 && (
                <ReferenceLine y={totalBudget} stroke="#94a3b8" strokeDasharray="4 4"
                  label={{ value: "Limit", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
              )}
              <Bar dataKey="spent" name="Výdavky" radius={[4, 4, 0, 0]}>
                {yearlyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isFuture ? "#e2e8f0" : entry.spent > entry.budget && entry.budget > 0 ? "#ef4444" : "#6366f1"}
                    opacity={entry.isFuture ? 0.4 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── 2. Kategórie za obdobie ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Výdavky podľa kategórií</CardTitle>
            <Select value={catPeriod} onValueChange={(v) => setCatPeriod(v ?? "thisYear")}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue>{PERIOD_LABELS[catPeriod]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Posledné 3 mesiace</SelectItem>
                <SelectItem value="6m">Posledných 6 mesiacov</SelectItem>
                <SelectItem value="12m">Posledných 12 mesiacov</SelectItem>
                <SelectItem value="thisYear">Tento rok ({today.getFullYear()})</SelectItem>
                <SelectItem value="lastYear">Minulý rok ({today.getFullYear() - 1})</SelectItem>
                <SelectItem value="all">Všetky časy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {catPeriodData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Žiadne dáta za zvolené obdobie.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {catPeriodData.map((d) => {
                  const pct = catPeriodTotal > 0 ? (d.value / catPeriodTotal) * 100 : 0;
                  return (
                    <div key={d.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{d.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                          <span className="text-sm font-semibold tabular-nums">{fmt(d.value)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: d.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                <span>Spolu</span>
                <span>{fmt(catPeriodTotal)}</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={catPeriodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                    {catPeriodData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${fmtDec(v as number)}`, ""]} />
                  <Legend iconType="circle" iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Ročné porovnanie ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Ročné porovnanie</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={String(compareYearA)} onValueChange={(v) => setCompareYearA(parseInt(v ?? String(today.getFullYear())))}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue>{compareYearA}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">vs</span>
              <Select value={String(compareYearB)} onValueChange={(v) => setCompareYearB(parseInt(v ?? String(today.getFullYear() - 1)))}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue>{compareYearB}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{compareYearA}</p>
              <p className="text-lg font-bold mt-0.5">{fmt(compareTotalA)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{compareYearB}</p>
              <p className="text-lg font-bold mt-0.5">{fmt(compareTotalB)}</p>
            </div>
            <div className={`rounded-lg p-3 ${compareDelta > 0 ? "bg-red-50 dark:bg-red-950" : "bg-green-50 dark:bg-green-950"}`}>
              <p className="text-xs text-muted-foreground">Rozdiel</p>
              <div className="flex items-center gap-1 mt-0.5">
                {compareDelta > 0 ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
                <p className={`text-lg font-bold ${compareDelta > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {compareDelta > 0 ? "+" : ""}{fmt(compareDelta)}
                </p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compareData} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v, name) => [`${v} €`, String(name)]} />
              <Bar dataKey={compareYearA} name={String(compareYearA)} fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey={compareYearB} name={String(compareYearB)} fill="#6366f140" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── 4. Priemer na mesiac ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Priemerné výdavky na mesiac</CardTitle>
            <Select value={avgPeriod} onValueChange={(v) => setAvgPeriod(v ?? "6m")}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue>{PERIOD_LABELS[avgPeriod]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Posledné 3 mesiace</SelectItem>
                <SelectItem value="6m">Posledných 6 mesiacov</SelectItem>
                <SelectItem value="12m">Posledných 12 mesiacov</SelectItem>
                <SelectItem value="thisYear">Tento rok ({today.getFullYear()})</SelectItem>
                <SelectItem value="lastYear">Minulý rok ({today.getFullYear() - 1})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {avgData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Žiadne dáta za zvolené obdobie.</p>
          ) : (
            <div className="space-y-2">
              {avgData.map(({ cat, avg }) => {
                const overLimit = cat.monthlyLimit > 0 && avg > cat.monthlyLimit;
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="text-sm w-4 shrink-0">{cat.icon}</span>
                    <span className="text-sm flex-1 min-w-0 truncate">{cat.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {cat.monthlyLimit > 0 ? `limit: ${fmt(cat.monthlyLimit)}` : ""}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${overLimit ? "text-red-500" : ""}`}>
                      {fmtDec(avg)}
                    </span>
                    {overLimit && <Badge variant="destructive" className="text-xs shrink-0">nad limitom</Badge>}
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t pt-2 mt-1">
                <span className="text-sm font-semibold">Priemerný mesiac spolu</span>
                <span className="text-sm font-bold">{fmtDec(avgData.reduce((s, d) => s + d.avg, 0))}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Top výdavky ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Top 10 najväčších výdavkov</CardTitle>
            <Select value={topPeriod} onValueChange={(v) => setTopPeriod(v ?? "thisYear")}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue>{PERIOD_LABELS[topPeriod]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Posledné 3 mesiace</SelectItem>
                <SelectItem value="6m">Posledných 6 mesiacov</SelectItem>
                <SelectItem value="12m">Posledných 12 mesiacov</SelectItem>
                <SelectItem value="thisYear">Tento rok ({today.getFullYear()})</SelectItem>
                <SelectItem value="lastYear">Minulý rok ({today.getFullYear() - 1})</SelectItem>
                <SelectItem value="all">Všetky časy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {topExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Žiadne výdavky za zvolené obdobie.</p>
          ) : (
            <div className="space-y-2">
              {topExpenses.map((e, i) => {
                const cat = categories.find((c) => c.id === e.categoryId);
                return (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                    <span className="text-base shrink-0">{cat?.icon ?? "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name ?? "—"} · {new Date(e.date).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0">{fmtDec(e.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
