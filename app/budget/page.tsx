"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  loadBudgetCategories, saveBudgetCategories,
  loadExpenses, saveExpenses,
  loadRecurringExpenses, saveRecurringExpenses,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, RefreshCw, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import type { BudgetCategory, Expense, RecurringExpense } from "@/lib/types";

// ─── Default categories ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: "housing",    name: "Bývanie",          color: "#6366f1", monthlyLimit: 600,  icon: "🏠" },
  { id: "food",       name: "Jedlo",             color: "#f59e0b", monthlyLimit: 400,  icon: "🍽️" },
  { id: "transport",  name: "Doprava",           color: "#3b82f6", monthlyLimit: 200,  icon: "🚗" },
  { id: "health",     name: "Zdravie",           color: "#10b981", monthlyLimit: 100,  icon: "💊" },
  { id: "entertain",  name: "Zábava",            color: "#f97316", monthlyLimit: 150,  icon: "🎬" },
  { id: "clothing",   name: "Oblečenie",         color: "#ec4899", monthlyLimit: 100,  icon: "👕" },
  { id: "education",  name: "Vzdelanie",         color: "#8b5cf6", monthlyLimit: 100,  icon: "📚" },
  { id: "insurance",  name: "Poistenie",         color: "#34d399", monthlyLimit: 100,  icon: "🛡️" },
  { id: "savings",    name: "Sporenie / Invest.", color: "#fbbf24", monthlyLimit: 500,  icon: "💰" },
  { id: "other",      name: "Iné",               color: "#94a3b8", monthlyLimit: 200,  icon: "📦" },
];

const MONTH_NAMES = ["Január","Február","Marec","Apríl","Máj","Jún","Júl","August","September","Október","November","December"];

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Returns virtual expense entries for recurring expenses (not income) due in [year, month] */
function getRecurringForMonth(recurring: RecurringExpense[], year: number, month: number): Expense[] {
  const mk = monthKey(year, month);
  return recurring
    .filter((r) => {
      if (!r.active || r.type === "income") return false;
      const rStart = new Date(r.startDate);
      if (rStart > new Date(year, month + 1, 0)) return false;
      if (r.frequency === "monthly") return true;
      if (r.frequency === "annual") return (r.month ?? new Date(r.startDate).getMonth()) === month;
      return false;
    })
    .map((r) => ({
      id: `recurring_${r.id}_${mk}`,
      categoryId: r.categoryId,
      amount: r.amount,
      currency: r.currency,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(r.dayOfMonth).padStart(2, "0")}`,
      description: r.description,
      _recurring: true,
    } as Expense & { _recurring?: boolean }));
}

/** Returns total income from recurring income entries due in [year, month] */
function getRecurringIncomeForMonth(recurring: RecurringExpense[], year: number, month: number): number {
  return recurring
    .filter((r) => {
      if (!r.active || r.type !== "income") return false;
      const rStart = new Date(r.startDate);
      if (rStart > new Date(year, month + 1, 0)) return false;
      if (r.frequency === "monthly") return true;
      if (r.frequency === "annual") return (r.month ?? new Date(r.startDate).getMonth()) === month;
      return false;
    })
    .reduce((s, r) => s + r.amount, 0);
}

const EMPTY_RECUR: Omit<RecurringExpense, "id"> = {
  type: "expense",
  categoryId: "",
  amount: 0,
  currency: "EUR",
  description: "",
  frequency: "monthly",
  dayOfMonth: 1,
  month: 0,
  startDate: new Date().toISOString().slice(0, 10),
  active: true,
};

export default function BudgetPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [categories, setCategories] = useState<BudgetCategory[]>(() => {
    const saved = loadBudgetCategories();
    return saved.length > 0 ? saved : DEFAULT_CATEGORIES;
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [recurring, setRecurring] = useState<RecurringExpense[]>(() => loadRecurringExpenses());

  // Expense dialog
  const [expOpen, setExpOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState({ categoryId: "", amount: 0, date: today.toISOString().slice(0, 10), description: "" });

  // Category dialog
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", color: "#6366f1", monthlyLimit: 0, icon: "📦" });

  // Recurring dialog
  const [recurOpen, setRecurOpen] = useState(false);
  const [editingRecur, setEditingRecur] = useState<RecurringExpense | null>(null);
  const [recurForm, setRecurForm] = useState<Omit<RecurringExpense, "id">>(EMPTY_RECUR);

  // Expenses for selected month (manual + recurring virtual entries)
  const mk = monthKey(year, month);
  const manualMonthExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(mk)),
    [expenses, mk]
  );
  const recurringVirtual = useMemo(
    () => getRecurringForMonth(recurring, year, month),
    [recurring, year, month]
  );
  const allMonthExpenses = useMemo(
    () => [...manualMonthExpenses, ...recurringVirtual],
    [manualMonthExpenses, recurringVirtual]
  );

  // Totals per category (includes recurring)
  const catTotals = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, cat) => {
      acc[cat.id] = allMonthExpenses
        .filter((e) => e.categoryId === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      return acc;
    }, {});
  }, [categories, allMonthExpenses]);

  const recurringIncome = useMemo(
    () => getRecurringIncomeForMonth(recurring, year, month),
    [recurring, year, month]
  );
  const totalSpent = Object.values(catTotals).reduce((s, v) => s + v, 0);
  const totalBudget = categories.reduce((s, c) => s + c.monthlyLimit, 0);
  const recurringMonthTotal = recurringVirtual.reduce((s, e) => s + e.amount, 0);
  const cashFlow = recurringIncome - totalSpent;

  const chartData = categories
    .filter((c) => catTotals[c.id] > 0 || c.monthlyLimit > 0)
    .map((c) => ({ name: `${c.icon} ${c.name}`, spent: parseFloat(catTotals[c.id].toFixed(2)), limit: c.monthlyLimit, color: c.color }));

  // Month-over-month comparison per category
  const momData = useMemo(() => {
    const prevD = new Date(year, month - 1, 1);
    const prevY = prevD.getFullYear();
    const prevM = prevD.getMonth();
    const prevMk = monthKey(prevY, prevM);
    return categories
      .map((cat) => {
        const thisSpent = catTotals[cat.id] ?? 0;
        const prevManual = expenses
          .filter((e) => e.date.startsWith(prevMk) && e.categoryId === cat.id)
          .reduce((s, e) => s + e.amount, 0);
        const prevRecurring = getRecurringForMonth(recurring, prevY, prevM)
          .filter((e) => e.categoryId === cat.id)
          .reduce((s, e) => s + e.amount, 0);
        const prevSpent = prevManual + prevRecurring;
        const delta = thisSpent - prevSpent;
        const deltaPct = prevSpent > 0 ? (delta / prevSpent) * 100 : null;
        return { cat, thisSpent, prevSpent, delta, deltaPct };
      })
      .filter((d) => d.thisSpent > 0 || d.prevSpent > 0);
  }, [categories, catTotals, expenses, recurring, year, month]);

  // 6-month spending trend
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const mk2 = monthKey(y, m);
      const manualTotal = expenses
        .filter((e) => e.date.startsWith(mk2))
        .reduce((s, e) => s + e.amount, 0);
      const recurTotal = getRecurringForMonth(recurring, y, m)
        .reduce((s, e) => s + e.amount, 0);
      months.push({
        name: MONTH_NAMES[m].slice(0, 3),
        total: parseFloat((manualTotal + recurTotal).toFixed(2)),
        budget: categories.reduce((s, c) => s + c.monthlyLimit, 0),
      });
    }
    return months;
  }, [expenses, recurring, year, month, categories]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // ── Expense CRUD ──
  function openAddExp() {
    setEditingExp(null);
    setExpForm({ categoryId: categories[0]?.id ?? "", amount: 0, date: today.toISOString().slice(0, 10), description: "" });
    setExpOpen(true);
  }
  function openEditExp(e: Expense) {
    setEditingExp(e);
    setExpForm({ categoryId: e.categoryId, amount: e.amount, date: e.date, description: e.description });
    setExpOpen(true);
  }
  function saveExp() {
    if (!expForm.categoryId || expForm.amount <= 0 || !expForm.description) {
      toast.error("Vyplň kategóriu, sumu a popis."); return;
    }
    const entry: Expense = {
      id: editingExp?.id ?? crypto.randomUUID(),
      categoryId: expForm.categoryId,
      amount: expForm.amount,
      currency: "EUR",
      date: expForm.date,
      description: expForm.description,
    };
    const updated = editingExp
      ? expenses.map((e) => e.id === editingExp.id ? entry : e)
      : [...expenses, entry];
    saveExpenses(updated);
    setExpenses(updated);
    setExpOpen(false);
    toast.success(editingExp ? "Výdavok upravený." : "Výdavok pridaný.");
  }
  function deleteExp(id: string) {
    const updated = expenses.filter((e) => e.id !== id);
    saveExpenses(updated);
    setExpenses(updated);
    toast.success("Výdavok odstránený.");
  }

  // ── Category CRUD ──
  function openAddCat() {
    setEditingCat(null);
    setCatForm({ name: "", color: "#6366f1", monthlyLimit: 0, icon: "📦" });
    setCatOpen(true);
  }
  function openEditCat(c: BudgetCategory) {
    setEditingCat(c);
    setCatForm({ name: c.name, color: c.color, monthlyLimit: c.monthlyLimit, icon: c.icon });
    setCatOpen(true);
  }
  function saveCat() {
    if (!catForm.name || catForm.monthlyLimit <= 0) { toast.error("Vyplň názov a mesačný limit."); return; }
    const entry: BudgetCategory = { id: editingCat?.id ?? crypto.randomUUID(), ...catForm };
    const updated = editingCat
      ? categories.map((c) => c.id === editingCat.id ? entry : c)
      : [...categories, entry];
    saveBudgetCategories(updated);
    setCategories(updated);
    setCatOpen(false);
    toast.success(editingCat ? "Kategória upravená." : "Kategória pridaná.");
  }
  function deleteCat(id: string) {
    const updated = categories.filter((c) => c.id !== id);
    saveBudgetCategories(updated);
    setCategories(updated);
    toast.success("Kategória odstránená.");
  }

  // ── Recurring CRUD ──
  function openAddRecur() {
    setEditingRecur(null);
    setRecurForm({ ...EMPTY_RECUR, categoryId: categories[0]?.id ?? "", startDate: today.toISOString().slice(0, 10) });
    setRecurOpen(true);
  }
  function openEditRecur(r: RecurringExpense) {
    setEditingRecur(r);
    setRecurForm({ type: r.type ?? "expense", categoryId: r.categoryId, amount: r.amount, currency: r.currency, description: r.description, frequency: r.frequency, dayOfMonth: r.dayOfMonth, month: r.month ?? new Date(r.startDate).getMonth(), startDate: r.startDate, active: r.active, note: r.note });
    setRecurOpen(true);
  }
  function saveRecur() {
    if (!recurForm.categoryId || recurForm.amount <= 0 || !recurForm.description) {
      toast.error("Vyplň kategóriu, sumu a popis."); return;
    }
    const entry: RecurringExpense = { id: editingRecur?.id ?? crypto.randomUUID(), ...recurForm };
    const updated = editingRecur
      ? recurring.map((r) => r.id === editingRecur.id ? entry : r)
      : [...recurring, entry];
    saveRecurringExpenses(updated);
    setRecurring(updated);
    setRecurOpen(false);
    toast.success(editingRecur ? "Pravidelný výdavok upravený." : "Pravidelný výdavok pridaný.");
  }
  function deleteRecur(id: string) {
    const updated = recurring.filter((r) => r.id !== id);
    saveRecurringExpenses(updated);
    setRecurring(updated);
    toast.success("Odstránený.");
  }
  function exportCsv() {
    const rows = [...allMonthExpenses]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        const cat = categories.find((c) => c.id === e.categoryId);
        return [e.date, `"${e.description.replace(/"/g, '""')}"`, e.amount.toFixed(2), e.currency, cat?.name ?? ""].join(",");
      });
    const csv = ["Dátum,Popis,Suma,Mena,Kategória", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vydavky_${monthKey(year, month)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function toggleRecur(id: string) {
    const updated = recurring.map((r) => r.id === id ? { ...r, active: !r.active } : r);
    saveRecurringExpenses(updated);
    setRecurring(updated);
  }

  const selectedCatLabel = categories.find((c) => c.id === expForm.categoryId);
  const selectedRecurCat = categories.find((c) => c.id === recurForm.categoryId);

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Výdavky & Rozpočet</h1>
            <p className="text-muted-foreground text-sm mt-1">Sleduj výdavky a mesačné limity</p>
          </div>
          <Button size="sm" onClick={openAddExp}><Plus className="w-4 h-4 mr-2" />Pridať výdavok</Button>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-base font-semibold w-40 text-center">{MONTH_NAMES[month]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {recurringIncome > 0 && (
            <Card className="border-green-300 dark:border-green-700">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Príjem</p>
                <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{fmt(recurringIncome)}</p>
                <p className="text-xs text-muted-foreground mt-1">pravidelný</p>
              </CardContent>
            </Card>
          )}
          <Card className={totalSpent > totalBudget ? "border-red-300 dark:border-red-700" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Výdavky</p>
              <p className={`text-2xl font-bold mt-1 ${totalSpent > totalBudget ? "text-red-600 dark:text-red-400" : ""}`}>{fmt(totalSpent)}</p>
              {recurringMonthTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-1">pravidelné: {fmt(recurringMonthTotal)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Rozpočet</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalBudget)}</p>
              <p className="text-xs text-muted-foreground mt-1">{totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(0)}%` : "—"}</p>
            </CardContent>
          </Card>
          <Card className={cashFlow < 0 ? "border-red-300 dark:border-red-700" : recurringIncome > 0 ? "border-green-300 dark:border-green-700" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{recurringIncome > 0 ? "Cash flow" : "Zostatok"}</p>
              <p className={`text-2xl font-bold mt-1 ${cashFlow < 0 ? "text-red-600 dark:text-red-400" : recurringIncome > 0 ? "text-green-600 dark:text-green-400" : ""}`}>
                {recurringIncome > 0 ? fmt(cashFlow) : fmt(totalBudget - totalSpent)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{allMonthExpenses.length} výdavkov</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Prehľad</TabsTrigger>
            <TabsTrigger value="expenses">Výdavky</TabsTrigger>
            <TabsTrigger value="recurring">
              Pravidelné
              {recurring.filter((r) => r.active).length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {recurring.filter((r) => r.active).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="categories">Kategórie</TabsTrigger>
          </TabsList>

          {/* ── Overview tab ── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {chartData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Minuté vs. limit</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <Tooltip formatter={(v) => `${v} €`} />
                      <Bar dataKey="limit" name="Limit" fill="#e2e8f0" radius={[4,4,0,0]} />
                      <Bar dataKey="spent" name="Minuté" radius={[4,4,0,0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.spent > entry.limit ? "#ef4444" : entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {trendData.some((d) => d.total > 0) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Trend výdavkov (6 mesiacov)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trendData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
                      <Tooltip formatter={(v) => [`${v} €`, "Výdavky"]} />
                      <ReferenceLine y={trendData[0]?.budget} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Limit", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
                      <Bar dataKey="total" name="Výdavky" radius={[4, 4, 0, 0]}>
                        {trendData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.total > entry.budget ? "#ef4444" : i === trendData.length - 1 ? "#6366f1" : "#6366f140"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {momData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mesiac / predchádzajúci mesiac</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {momData.map(({ cat, thisSpent, prevSpent, delta, deltaPct }) => {
                      const improved = delta < 0;
                      const unchanged = delta === 0;
                      return (
                        <div key={cat.id} className="flex items-center gap-3">
                          <span className="text-sm w-4">{cat.icon}</span>
                          <span className="text-sm flex-1 min-w-0 truncate">{cat.name}</span>
                          <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">{fmt(prevSpent)}</span>
                          <span className="text-muted-foreground text-xs">→</span>
                          <span className="text-sm font-semibold w-16 text-right tabular-nums">{fmt(thisSpent)}</span>
                          <span className={`flex items-center gap-0.5 text-xs w-16 justify-end tabular-nums ${improved ? "text-green-600" : delta > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                            {unchanged ? (
                              <Minus className="w-3 h-3" />
                            ) : improved ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : (
                              <TrendingUp className="w-3 h-3" />
                            )}
                            {deltaPct !== null ? `${delta > 0 ? "+" : ""}${deltaPct.toFixed(0)}%` : delta > 0 ? `+${fmt(delta)}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Plnenie rozpočtu</CardTitle>
                  <Button size="sm" variant="outline" onClick={openAddCat}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Nová kategória
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.map((cat) => {
                  const spent = catTotals[cat.id] ?? 0;
                  const pct = cat.monthlyLimit > 0 ? Math.min(100, (spent / cat.monthlyLimit) * 100) : 0;
                  const over = spent > cat.monthlyLimit && cat.monthlyLimit > 0;
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cat.icon} {cat.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{fmt(spent)} / {fmt(cat.monthlyLimit)}</span>
                          {over && <Badge variant="destructive" className="text-xs">Prekročené</Badge>}
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditCat(cat)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: over ? "#ef4444" : cat.color }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                        <span>{pct.toFixed(0)}% z limitu</span>
                        <span>zostatok: {fmt(Math.max(0, cat.monthlyLimit - spent))}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Expenses tab ── */}
          <TabsContent value="expenses" className="space-y-3 mt-4">
            {allMonthExpenses.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  CSV export
                </Button>
              </div>
            )}
            {allMonthExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne výdavky pre {MONTH_NAMES[month]} {year}.
                </CardContent>
              </Card>
            ) : (
              [...allMonthExpenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e) => {
                  const cat = categories.find((c) => c.id === e.categoryId);
                  const isRecurring = (e as Expense & { _recurring?: boolean })._recurring;
                  return (
                    <Card key={e.id}>
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                          style={{ background: `${cat?.color ?? "#888"}20` }}>
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{e.description}</p>
                            {isRecurring && <Badge variant="outline" className="text-xs shrink-0">Automatické</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {cat?.name ?? "—"} · {new Date(e.date).toLocaleDateString("sk-SK")}
                          </p>
                        </div>
                        <p className="font-bold text-sm shrink-0">{fmt(e.amount)}</p>
                        {!isRecurring && (
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditExp(e)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteExp(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </TabsContent>

          {/* ── Recurring tab ── */}
          <TabsContent value="recurring" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Príjmy a výdavky sa automaticky zarátavajú každý mesiac.</p>
              <Button size="sm" onClick={openAddRecur}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
            </div>

            {/* Income section */}
            {recurring.filter(r => r.type === "income").length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Príjmy</p>
                {recurring.filter(r => r.type === "income").map((r) => {
                  const dueLabel = r.frequency === "monthly" ? `každý mesiac, ${r.dayOfMonth}. deň` : `raz ročne, ${MONTH_NAMES[r.month ?? 0]} ${r.dayOfMonth}.`;
                  return (
                    <Card key={r.id} className={!r.active ? "opacity-50" : ""}>
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: "#10b98120" }}>💵</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{r.description}</p>
                            <Badge variant="secondary" className="text-xs shrink-0 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                              {r.frequency === "monthly" ? "Mesačný" : "Ročný"}
                            </Badge>
                            {!r.active && <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">Pozastavené</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{dueLabel}</p>
                        </div>
                        <p className="font-bold text-sm shrink-0 text-green-600 dark:text-green-400">+{fmt(r.amount)}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => toggleRecur(r.id)}><RefreshCw className={`w-4 h-4 ${r.active ? "" : "text-muted-foreground"}`} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditRecur(r)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteRecur(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Expense section */}
            {recurring.filter(r => r.type !== "income").length > 0 && (
              <div className="space-y-2">
                {recurring.filter(r => r.type === "income").length > 0 && (
                  <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">Výdavky</p>
                )}
                {recurring.filter(r => r.type !== "income").map((r) => {
                  const cat = categories.find((c) => c.id === r.categoryId);
                  const dueLabel = r.frequency === "monthly" ? `každý mesiac, ${r.dayOfMonth}. deň` : `raz ročne, ${MONTH_NAMES[r.month ?? new Date(r.startDate).getMonth()]} ${r.dayOfMonth}.`;
                  return (
                    <Card key={r.id} className={!r.active ? "opacity-50" : ""}>
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: `${cat?.color ?? "#888"}20` }}>
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{r.description}</p>
                            <Badge variant={r.frequency === "monthly" ? "secondary" : "outline"} className="text-xs shrink-0">
                              {r.frequency === "monthly" ? "Mesačné" : "Ročné"}
                            </Badge>
                            {!r.active && <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">Pozastavené</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{cat?.name ?? "—"} · {dueLabel}</p>
                        </div>
                        <p className="font-bold text-sm shrink-0">{fmt(r.amount)}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => toggleRecur(r.id)}><RefreshCw className={`w-4 h-4 ${r.active ? "" : "text-muted-foreground"}`} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditRecur(r)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteRecur(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {recurring.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne záznamy. Pridaj plat, nájomné, predplatné, poistky...
                </CardContent>
              </Card>
            )}

            {(recurringIncome > 0 || recurringMonthTotal > 0) && (
              <Card className="bg-muted/30">
                <CardContent className="pt-3 pb-3 space-y-1">
                  {recurringIncome > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Príjmy ({MONTH_NAMES[month]})</span>
                      <span className="font-bold text-green-600 dark:text-green-400">+{fmt(recurringIncome)}</span>
                    </div>
                  )}
                  {recurringMonthTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Výdavky ({MONTH_NAMES[month]})</span>
                      <span className="font-bold">-{fmt(recurringMonthTotal)}</span>
                    </div>
                  )}
                  {recurringIncome > 0 && (
                    <div className="flex items-center justify-between border-t pt-1 mt-1">
                      <span className="text-sm font-medium">Cash flow</span>
                      <span className={`font-bold ${cashFlow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{fmt(cashFlow)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Ročné záväzky (výdavky)</span>
                    <span className="text-sm">{fmt(recurring.filter(r => r.active && r.type !== "income").reduce((s, r) => s + (r.frequency === "annual" ? r.amount : r.amount * 12), 0))}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Categories tab ── */}
          <TabsContent value="categories" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openAddCat}><Plus className="w-4 h-4 mr-2" />Nová kategória</Button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => (
                <Card key={cat.id}>
                  <CardContent className="pt-3 pb-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ background: `${cat.color}20` }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">Mesačný limit: {fmt(cat.monthlyLimit)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCat(cat.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit expense dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingExp ? "Upraviť výdavok" : "Pridať výdavok"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kategória</label>
              <Select value={expForm.categoryId} onValueChange={(v) => setExpForm({ ...expForm, categoryId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue>
                    {selectedCatLabel ? `${selectedCatLabel.icon} ${selectedCatLabel.name}` : "Vyber kategóriu"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Popis</label>
              <Input placeholder="napr. Nákup Lidl" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Suma (€)</label>
                <Input type="number" step="0.01" min="0" value={expForm.amount || ""} onChange={(e) => setExpForm({ ...expForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum</label>
                <Input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpOpen(false)}>Zrušiť</Button>
            <Button onClick={saveExp}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? "Upraviť kategóriu" : "Nová kategória"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov</label>
              <Input placeholder="napr. Šport" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ikona</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {["🏠","🍽️","🚗","💊","🎬","👕","📚","🛡️","💰","📦","✈️","🏋️","🐾","🎮","☕","🎁","💈","🏥","📱","⚡","🎓","🛒","🏖️","💻"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setCatForm({ ...catForm, icon: e })}
                    className={`text-lg p-1 rounded-md border transition-colors ${catForm.icon === e ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Input placeholder="alebo vlož vlastné emoji" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mesačný limit (€)</label>
                <Input type="number" step="10" min="0" value={catForm.monthlyLimit || ""} onChange={(e) => setCatForm({ ...catForm, monthlyLimit: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Farba</label>
                <Input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="h-8 px-1 py-0.5 cursor-pointer" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Zrušiť</Button>
            <Button onClick={saveCat}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit recurring expense dialog */}
      <Dialog open={recurOpen} onOpenChange={setRecurOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRecur ? "Upraviť pravidelný záznam" : "Nový pravidelný záznam"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex rounded-lg overflow-hidden border">
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${recurForm.type === "expense" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setRecurForm({ ...recurForm, type: "expense" })}
              >
                Výdavok
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${recurForm.type === "income" ? "bg-green-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setRecurForm({ ...recurForm, type: "income" })}
              >
                Príjem
              </button>
            </div>
            {recurForm.type === "expense" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kategória</label>
                <Select value={recurForm.categoryId} onValueChange={(v) => setRecurForm({ ...recurForm, categoryId: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue>
                      {selectedRecurCat ? `${selectedRecurCat.icon} ${selectedRecurCat.name}` : "Vyber kategóriu"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Popis</label>
              <Input placeholder="napr. Nájomné, Netflix, PZP..." value={recurForm.description} onChange={(e) => setRecurForm({ ...recurForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Suma (€)</label>
                <Input type="number" step="0.01" min="0" value={recurForm.amount || ""} onChange={(e) => setRecurForm({ ...recurForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frekvencia</label>
                <Select value={recurForm.frequency} onValueChange={(v) => setRecurForm({ ...recurForm, frequency: (v ?? "monthly") as "monthly" | "annual" })}>
                  <SelectTrigger><SelectValue>{recurForm.frequency === "monthly" ? "Mesačne" : "Ročne"}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mesačne</SelectItem>
                    <SelectItem value="annual">Ročne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {recurForm.frequency === "annual" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mesiac splatnosti</label>
                  <Select value={String(recurForm.month ?? 0)} onValueChange={(v) => setRecurForm({ ...recurForm, month: parseInt(v ?? "0") })}>
                    <SelectTrigger><SelectValue>{MONTH_NAMES[recurForm.month ?? 0]}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Deň v mesiaci</label>
                <Input type="number" min="1" max="28" value={recurForm.dayOfMonth} onChange={(e) => setRecurForm({ ...recurForm, dayOfMonth: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Platí od</label>
              <Input type="date" value={recurForm.startDate} onChange={(e) => setRecurForm({ ...recurForm, startDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurOpen(false)}>Zrušiť</Button>
            <Button onClick={saveRecur}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
