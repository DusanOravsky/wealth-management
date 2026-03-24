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
import { STORE_KEYS } from "@/lib/constants";

const DEFAULT_TARGET_ALLOCATION: Record<string, number> = {
  cash: 5,
  bank: 10,
  pension: 10,
  commodity: 15,
  crypto: 20,
  stock: 25,
  realestate: 15,
};

function loadTargetAllocation(): Record<string, number> {
  if (typeof window === "undefined") return DEFAULT_TARGET_ALLOCATION;
  try {
    const raw = localStorage.getItem(STORE_KEYS.TARGET_ALLOCATION);
    return raw ? { ...DEFAULT_TARGET_ALLOCATION, ...JSON.parse(raw) } : DEFAULT_TARGET_ALLOCATION;
  } catch { return DEFAULT_TARGET_ALLOCATION; }
}

function loadFireSettings() {
  if (typeof window === "undefined") return { monthlyExpenses: 2000, monthlyContrib: 500, annualReturn: 7, swr: 4 };
  try {
    const raw = localStorage.getItem(STORE_KEYS.FIRE_SETTINGS);
    return raw ? JSON.parse(raw) : { monthlyExpenses: 2000, monthlyContrib: 500, annualReturn: 7, swr: 4 };
  } catch { return { monthlyExpenses: 2000, monthlyContrib: 500, annualReturn: 7, swr: 4 }; }
}

const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Komodity", cash: "Hotovosť", pension: "II. Pilier", bank: "Banka", crypto: "Krypto",
  stock: "Akcie", realestate: "Nehnuteľnosti",
};

const CATEGORY_COLORS: Record<string, string> = {
  commodity: "#f59e0b", cash: "#10b981", pension: "#6366f1", bank: "#3b82f6", crypto: "#f97316",
  stock: "#60a5fa", realestate: "#34d399",
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
  const { portfolioSummary, settings } = useApp();

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
    localStorage.setItem(STORE_KEYS.TARGET_ALLOCATION, JSON.stringify(allocationDraft));
    setEditingAllocation(false);
  }

  // FIRE calculator state — persisted
  const fireDefaults = useMemo(() => loadFireSettings(), []);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(fireDefaults.monthlyExpenses);
  const [monthlyContrib, setMonthlyContrib] = useState<number>(fireDefaults.monthlyContrib);
  const [annualReturn, setAnnualReturn] = useState<number>(fireDefaults.annualReturn);
  const [swr, setSwr] = useState<number>(fireDefaults.swr);

  useEffect(() => {
    localStorage.setItem(STORE_KEYS.FIRE_SETTINGS, JSON.stringify({ monthlyExpenses, monthlyContrib, annualReturn, swr }));
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
        </Tabs>
      </div>
    </AppShell>
  );
}
