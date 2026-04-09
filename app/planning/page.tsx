"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { groupByCategory } from "@/lib/portfolio-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Check, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { loadTargetAllocation, saveTargetAllocation, loadFireSettings, saveFireSettings, loadRecurringExpenses } from "@/lib/store";

const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Komodity", cash: "Hotovosť", pension: "II. Pilier", bank: "Banka", crypto: "Krypto",
  stock: "Akcie", realestate: "Nehnuteľnosti",
};

const CATEGORY_COLORS: Record<string, string> = {
  commodity: "#f59e0b", cash: "#10b981", pension: "#6366f1", bank: "#3b82f6", crypto: "#f97316",
  stock: "#60a5fa", realestate: "#34d399",
};

const LIQUIDITY_GROUPS: { label: string; color: string; categories: string[] }[] = [
  { label: "Likvidné (okamžite)", color: "#10b981", categories: ["cash", "bank"] },
  { label: "Pololikvidné (dni–týždne)", color: "#f59e0b", categories: ["stock", "crypto", "commodity"] },
  { label: "Nelikvidné (mesiace+)", color: "#6366f1", categories: ["pension", "realestate"] },
];

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function calcFV(pv: number, monthlyPMT: number, annualRatePct: number, months: number): number {
  if (months <= 0) return pv;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return pv + monthlyPMT * months;
  return pv * Math.pow(1 + r, months) + monthlyPMT * (Math.pow(1 + r, months) - 1) / r;
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

function calcMonthlyPayment(loanAmount: number, annualRate: number, termYears: number): number {
  if (annualRate === 0) return loanAmount / (termYears * 12);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function toEurSimple(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === "EUR") return amount;
  const rate = rates[currency];
  return rate ? amount / rate : amount;
}

export default function PlanningPage() {
  const { portfolioSummary, settings, portfolio, rates } = useApp();

  const grouped = useMemo(
    () => (portfolioSummary ? groupByCategory(portfolioSummary) : {}),
    [portfolioSummary]
  );
  const total = portfolioSummary?.totalEur ?? 0;

  // User-editable target allocation
  const [targetAllocation, setTargetAllocation] = useState<Record<string, number>>(loadTargetAllocation);
  const [editingAllocation, setEditingAllocation] = useState(false);
  const [allocationDraft, setAllocationDraft] = useState<Record<string, number>>(targetAllocation);

  const chartData = Object.keys(targetAllocation).map((key) => {
    const current = total > 0 ? ((grouped[key] ?? 0) / total) * 100 : 0;
    const target = targetAllocation[key];
    return {
      name: CATEGORY_LABELS[key] ?? key,
      key,
      current: parseFloat(current.toFixed(1)),
      target,
      diff: parseFloat((current - target).toFixed(1)),
      valueEur: grouped[key] ?? 0,
    };
  });

  function saveAllocation() {
    setTargetAllocation(allocationDraft);
    saveTargetAllocation(allocationDraft);
    setEditingAllocation(false);
  }

  // FIRE calculator state — persisted (lazy initializers avoid SSR/client hydration mismatch)
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(() => loadFireSettings().monthlyExpenses);
  const [monthlyContrib, setMonthlyContrib] = useState<number>(() => loadFireSettings().monthlyContrib);
  const [annualReturn, setAnnualReturn] = useState<number>(() => loadFireSettings().annualReturn);
  const [swr, setSwr] = useState<number>(() => loadFireSettings().swr);

  useEffect(() => {
    saveFireSettings({ monthlyExpenses, monthlyContrib, annualReturn, swr });
  }, [monthlyExpenses, monthlyContrib, annualReturn, swr]);

  const fireNumber = useMemo(
    () => (monthlyExpenses * 12) / (swr / 100),
    [monthlyExpenses, swr]
  );

  const months = useMemo(
    () => calcMonthsToFIRE(total, monthlyContrib, fireNumber, annualReturn),
    [total, monthlyContrib, fireNumber, annualReturn]
  );

  const years = isFinite(months) ? months / 12 : null;
  const currentYear = new Date().getFullYear();
  const targetYear = years != null ? currentYear + Math.ceil(years) : null;
  const progressPct = Math.min(100, (total / fireNumber) * 100);

  // Liquidity breakdown
  const liquidityData = useMemo(() => LIQUIDITY_GROUPS.map((g) => ({
    ...g,
    value: g.categories.reduce((s, c) => s + (grouped[c] ?? 0), 0),
  })), [grouped]);
  const liquidTotal = liquidityData.reduce((s, g) => s + g.value, 0);

  // Cashflow projector
  const cashflow = useMemo(() => {
    const recurring = loadRecurringExpenses();
    const incomes = recurring.filter((r) => r.active && r.type === "income").map((r) => ({
      label: r.description,
      amount: r.frequency === "monthly" ? r.amount : r.amount / 12,
    }));
    const fixedExpenses = recurring.filter((r) => r.active && r.type === "expense").map((r) => ({
      label: r.description,
      amount: r.frequency === "monthly" ? r.amount : r.amount / 12,
    }));
    const mortgages = (portfolio?.realestate ?? [])
      .filter((r) => r.loanAmount && r.loanInterestRate !== undefined && r.loanTermYears && r.loanStartDate)
      .map((r) => ({
        label: r.name,
        amount: toEurSimple(calcMonthlyPayment(r.loanAmount!, r.loanInterestRate!, r.loanTermYears!), r.currency, rates ?? {}),
      }));
    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
    const totalFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const totalMortgage = mortgages.reduce((s, m) => s + m.amount, 0);
    return { incomes, fixedExpenses, mortgages, totalIncome, totalFixed, totalMortgage };
  }, [portfolio, rates]);

  // Pension projector state
  const [pensionContrib, setPensionContrib] = useState<number>(100);
  const [pensionReturn, setPensionReturn] = useState<number>(4);

  const currentPensionEur = grouped["pension"] ?? 0;

  // Profile-based calculations
  const currentAge = settings?.birthYear ? currentYear - settings.birthYear : null;
  const ageAtFire = currentAge != null && years != null ? currentAge + years : null;
  const retirementAge = settings?.retirementAge ?? 65;
  const yearsToOfficialRetirement = currentAge != null ? retirementAge - currentAge : null;
  const savingsRate = settings?.monthlyIncome && settings.monthlyIncome > 0
    ? (monthlyContrib / settings.monthlyIncome) * 100
    : null;

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div>
          <h1 className="text-2xl font-bold">Plánovanie</h1>
          <p className="text-muted-foreground text-sm mt-1">Alokácia portfólia a FIRE kalkulátor</p>
        </div>

        <Tabs defaultValue="allocation">
          <div className="overflow-x-auto">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="allocation">Alokácia</TabsTrigger>
              <TabsTrigger value="fire">FIRE kalkulátor</TabsTrigger>
              <TabsTrigger value="pension">II. Pilier</TabsTrigger>
              <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Allocation tab ── */}
          <TabsContent value="allocation" className="space-y-6 mt-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Celkový majetok</p>
                <p className="text-3xl font-bold mt-1">{fmt(total)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Aktuálna vs. cieľová alokácia (%)</CardTitle>
                {!editingAllocation ? (
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                    onClick={() => { setAllocationDraft({ ...targetAllocation }); setEditingAllocation(true); }}>
                    <Pencil className="w-3 h-3" /> Upraviť ciele
                  </Button>
                ) : (
                  <div className="flex gap-1.5">
                    <Button variant="default" size="sm" className="h-7 gap-1 text-xs" onClick={saveAllocation}>
                      <Check className="w-3 h-3" /> Uložiť
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                      onClick={() => setEditingAllocation(false)}>
                      <X className="w-3 h-3" /> Zrušiť
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editingAllocation ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
                    {Object.keys(allocationDraft).map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block"
                            style={{ background: CATEGORY_COLORS[key] ?? "#888" }} />
                          {CATEGORY_LABELS[key] ?? key}
                        </label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={0} max={100} step={1}
                            value={allocationDraft[key]}
                            onChange={(e) => setAllocationDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                            className="h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                    <div className="col-span-full text-xs text-muted-foreground">
                      Súčet: {Object.values(allocationDraft).reduce((a, b) => a + b, 0)}%
                      {Object.values(allocationDraft).reduce((a, b) => a + b, 0) !== 100 && (
                        <span className="text-amber-500 ml-1">(odporúča sa 100%)</span>
                      )}
                    </div>
                  </div>
                ) : (
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
                )}
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

            {/* Liquidity breakdown */}
            <Card>
              <CardHeader><CardTitle className="text-base">Likvidita portfólia</CardTitle></CardHeader>
              <CardContent>
                {liquidTotal > 0 ? (
                  <>
                    {/* Stacked bar */}
                    <div className="flex w-full h-5 rounded-full overflow-hidden mb-4">
                      {liquidityData.map((g) => (
                        <div
                          key={g.label}
                          style={{ width: `${(g.value / liquidTotal) * 100}%`, background: g.color }}
                          title={`${g.label}: ${fmt(g.value)}`}
                        />
                      ))}
                    </div>
                    <div className="space-y-3">
                      {liquidityData.map((g) => (
                        <div key={g.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color }} />
                              <span className="text-sm">{g.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{fmt(g.value)}</span>
                              <Badge variant="secondary" className="text-xs">
                                {liquidTotal > 0 ? ((g.value / liquidTotal) * 100).toFixed(1) : 0}%
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground ml-5">
                            {g.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Žiadne dáta portfólia.</p>
                )}
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
                    {years != null ? `${years.toFixed(1)} r.` : "∞"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {targetYear ? `cca rok ${targetYear}` : "Navýš mesačnú investíciu"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Profile-based stats */}
            {(currentAge != null || savingsRate != null) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {currentAge != null && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Vek teraz</p>
                      <p className="text-xl font-bold mt-0.5">{currentAge} r.</p>
                    </CardContent>
                  </Card>
                )}
                {ageAtFire != null && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Vek pri FIRE</p>
                      <p className="text-xl font-bold mt-0.5">{ageAtFire.toFixed(1)} r.</p>
                      {yearsToOfficialRetirement != null && ageAtFire < retirementAge && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                          {(retirementAge - ageAtFire).toFixed(1)} r. pred dôchodkom
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                {yearsToOfficialRetirement != null && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Do dôchodku ({retirementAge} r.)</p>
                      <p className="text-xl font-bold mt-0.5">
                        {yearsToOfficialRetirement > 0 ? `${yearsToOfficialRetirement} r.` : "Dosiahnutý"}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {savingsRate != null && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Miera úspor</p>
                      <p className="text-xl font-bold mt-0.5">{savingsRate.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">z príjmu</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

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

          {/* ── Pension projector tab ── */}
          <TabsContent value="pension" className="space-y-6 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Projektor II. piliera</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Aktuálna hodnota</p>
                    <p className="text-2xl font-bold">{fmt(currentPensionEur)}</p>
                  </div>
                  {currentAge != null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Rokov do dôchodku</p>
                      <p className="text-2xl font-bold">
                        {Math.max(0, (settings?.retirementAge ?? 65) - currentAge)} r.
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Mesačný príspevok (€)</label>
                    <Input
                      type="number"
                      min={0}
                      value={pensionContrib}
                      onChange={(e) => setPensionContrib(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Očakávaný ročný výnos (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={pensionReturn}
                      onChange={(e) => setPensionReturn(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scenarios */}
            {(() => {
              const retAge = settings?.retirementAge ?? 65;
              const monthsLeft = currentAge != null ? Math.max(0, (retAge - currentAge) * 12) : null;
              if (monthsLeft == null) {
                return (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      Nastav rok narodenia v nastaveniach pre výpočet projekcií.
                    </CardContent>
                  </Card>
                );
              }
              const scenarios = [
                { label: "Konzervatívny", rate: 1, color: "text-blue-600" },
                { label: "Stredný", rate: pensionReturn, color: "text-green-600" },
                { label: "Optimistický", rate: Math.min(pensionReturn + 2, 12), color: "text-amber-600" },
              ];
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {scenarios.map((sc) => {
                      const fv = calcFV(currentPensionEur, pensionContrib, sc.rate, monthsLeft);
                      const totalContrib = pensionContrib * monthsLeft;
                      const gain = fv - currentPensionEur - totalContrib;
                      return (
                        <Card key={sc.label}>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">{sc.label} ({sc.rate}%)</p>
                            <p className={`text-2xl font-bold mt-1 ${sc.color}`}>{fmt(fv)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              príspevky {fmt(totalContrib)} · výnos {fmt(gain)}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Mesačný príjem z II. piliera pri odchode</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {scenarios.map((sc) => {
                          const fv = calcFV(currentPensionEur, pensionContrib, sc.rate, monthsLeft);
                          // Assume 20-year payout (240 months)
                          const monthlyPayout = fv / 240;
                          return (
                            <div key={sc.label} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                              <span className="text-sm">{sc.label} ({sc.rate}%)</span>
                              <span className={`font-semibold ${sc.color}`}>
                                {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(monthlyPayout)}/mes
                              </span>
                            </div>
                          );
                        })}
                        <p className="text-xs text-muted-foreground mt-2">
                          * Orientačný výpočet — predpokladá výplatu počas 20 rokov bez zhodnotenia pri výplate.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>
          {/* ── Cashflow projector tab ── */}
          <TabsContent value="cashflow" className="space-y-6 mt-4">
            {(() => {
              const { incomes, fixedExpenses, mortgages, totalIncome, totalFixed, totalMortgage } = cashflow;
              const afterFixed = totalIncome - totalFixed - totalMortgage;
              const freeCashflow = afterFixed - monthlyContrib;
              const savingsRateCf = totalIncome > 0 ? ((monthlyContrib / totalIncome) * 100) : 0;

              return (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="bg-green-500/10 border-green-500/20">
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Príjmy / mes.</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">{fmt(totalIncome)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/20">
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Fixné výdavky</p>
                        <p className="text-xl font-bold text-red-500 mt-0.5">{fmt(totalFixed + totalMortgage)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-500/10 border-blue-500/20">
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Sporenie / inv.</p>
                        <p className="text-xl font-bold text-blue-500 mt-0.5">{fmt(monthlyContrib)}</p>
                        <p className="text-xs text-muted-foreground">{savingsRateCf.toFixed(0)}% z príjmu</p>
                      </CardContent>
                    </Card>
                    <Card className={freeCashflow >= 0 ? "bg-primary/10 border-primary/20" : "bg-red-500/10 border-red-500/20"}>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Voľný cashflow</p>
                        <p className={`text-xl font-bold mt-0.5 ${freeCashflow >= 0 ? "text-primary" : "text-red-500"}`}>{fmt(freeCashflow)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Waterfall breakdown */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Mesačný cashflow</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {/* Incomes */}
                      {incomes.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-muted/50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                            <span className="text-sm truncate">{item.label}</span>
                          </div>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400 shrink-0 ml-2">+{fmt(item.amount)}</span>
                        </div>
                      ))}

                      {/* Subtotal after income */}
                      {incomes.length > 0 && (
                        <div className="flex justify-between py-1.5 text-sm font-semibold border-t border-muted mt-1">
                          <span>Celkové príjmy</span>
                          <span className="text-green-600 dark:text-green-400">+{fmt(totalIncome)}</span>
                        </div>
                      )}

                      {/* Fixed expenses */}
                      {fixedExpenses.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-muted/50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                            <span className="text-sm truncate">{item.label}</span>
                          </div>
                          <span className="text-sm font-medium text-red-500 shrink-0 ml-2">−{fmt(item.amount)}</span>
                        </div>
                      ))}

                      {/* Mortgages */}
                      {mortgages.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-muted/50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                            <span className="text-sm truncate">{item.label} (hypotéka)</span>
                          </div>
                          <span className="text-sm font-medium text-red-500 shrink-0 ml-2">−{fmt(item.amount)}</span>
                        </div>
                      ))}

                      {/* After fixed */}
                      <div className="flex justify-between py-1.5 text-sm font-semibold border-t border-muted">
                        <span>Po fixných výdavkoch</span>
                        <span className={afterFixed >= 0 ? "text-foreground" : "text-red-500"}>{afterFixed >= 0 ? "" : "−"}{fmt(Math.abs(afterFixed))}</span>
                      </div>

                      {/* Savings */}
                      <div className="flex items-center justify-between py-1.5 border-b border-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-sm">Sporenie / investície</span>
                          <span className="text-xs text-muted-foreground">(z FIRE kal.)</span>
                        </div>
                        <span className="text-sm font-medium text-blue-500 shrink-0 ml-2">−{fmt(monthlyContrib)}</span>
                      </div>

                      {/* Free cashflow */}
                      <div className={`flex justify-between py-2 px-3 rounded-md mt-2 ${freeCashflow >= 0 ? "bg-primary/10" : "bg-red-500/10"}`}>
                        <span className="text-sm font-bold">Voľný cashflow</span>
                        <span className={`text-sm font-bold ${freeCashflow >= 0 ? "text-primary" : "text-red-500"}`}>
                          {freeCashflow >= 0 ? "+" : "−"}{fmt(Math.abs(freeCashflow))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {incomes.length === 0 && fixedExpenses.length === 0 && mortgages.length === 0 && (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground text-sm">
                        Pridaj pravidelné príjmy a výdavky v sekcii Rozpočet → Pravidelné.
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
