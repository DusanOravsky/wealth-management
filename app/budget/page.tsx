"use client";

import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import {
  loadBudgetCategories, saveBudgetCategories,
  loadExpenses, saveExpenses,
  loadRecurringExpenses, saveRecurringExpenses,
  loadTrips, saveTrips,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, RefreshCw, Download, TrendingUp, TrendingDown, Minus, Upload, QrCode, MapPin } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import type { BudgetCategory, Expense, RecurringExpense, Trip } from "@/lib/types";
import type { ParsedReceipt } from "@/components/ReceiptScannerDialog";
import { BudgetStats } from "@/components/modules/BudgetStats";

const ReceiptScannerDialog = dynamic(
  () => import("@/components/ReceiptScannerDialog").then((m) => m.ReceiptScannerDialog),
  { ssr: false }
);

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
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(r.dayOfMonth, new Date(year, month + 1, 0).getDate())).padStart(2, "0")}`,
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
  const [trips, setTrips] = useState<Trip[]>(() => loadTrips());

  // QR scanner
  const [scanOpen, setScanOpen] = useState(false);

  // Expense dialog
  const [expOpen, setExpOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState({ type: "expense" as "expense" | "income", categoryId: "", amount: 0, date: today.toISOString().slice(0, 10), description: "", tripId: "" });

  // Trip dialog
  const [tripOpen, setTripOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState({ name: "", icon: "✈️", dateFrom: today.toISOString().slice(0, 10), dateTo: today.toISOString().slice(0, 10), note: "" });
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);

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

  // Separate income entries from expense entries
  const manualMonthIncomes = useMemo(
    () => manualMonthExpenses.filter((e) => e.type === "income"),
    [manualMonthExpenses]
  );
  const manualMonthExpenseOnly = useMemo(
    () => manualMonthExpenses.filter((e) => e.type !== "income"),
    [manualMonthExpenses]
  );
  const allMonthExpensesOnly = useMemo(
    () => [...manualMonthExpenseOnly, ...recurringVirtual],
    [manualMonthExpenseOnly, recurringVirtual]
  );

  // Totals per category (includes recurring, excludes income entries)
  const catTotals = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, cat) => {
      acc[cat.id] = allMonthExpensesOnly
        .filter((e) => e.categoryId === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      return acc;
    }, {});
  }, [categories, allMonthExpensesOnly]);

  const recurringIncome = useMemo(
    () => getRecurringIncomeForMonth(recurring, year, month),
    [recurring, year, month]
  );
  const manualIncome = manualMonthIncomes.reduce((s, e) => s + e.amount, 0);
  const totalIncome = recurringIncome + manualIncome;
  const totalSpent = Object.values(catTotals).reduce((s, v) => s + v, 0);
  const totalBudget = categories.reduce((s, c) => s + c.monthlyLimit, 0);
  const recurringMonthTotal = recurringVirtual.reduce((s, e) => s + e.amount, 0);
  const cashFlow = totalIncome - totalSpent;

  const chartData = categories
    .filter((c) => catTotals[c.id] > 0 || c.monthlyLimit > 0)
    .map((c) => ({ name: `${c.icon} ${c.name}`, spent: parseFloat(catTotals[c.id].toFixed(2)), limit: c.monthlyLimit, color: c.color }));

  // Remaining spend forecast for current month
  const remainingForecast = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    if (!isCurrentMonth) return null;
    const endOfMonth = new Date(year, month + 1, 0);
    return recurring
      .filter((r) => {
        if (!r.active || r.type === "income") return false;
        const rStart = new Date(r.startDate);
        if (rStart > endOfMonth) return false;
        if (r.frequency === "monthly") {
          const due = new Date(year, month, r.dayOfMonth);
          return due > today && due <= endOfMonth;
        }
        if (r.frequency === "annual") {
          const rMonth = r.month ?? new Date(r.startDate).getMonth();
          if (rMonth !== month) return false;
          const due = new Date(year, month, r.dayOfMonth);
          return due > today && due <= endOfMonth;
        }
        return false;
      })
      .reduce((s, r) => s + r.amount, 0);
  }, [recurring, year, month]);

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
  function openAddExp(presetTripId?: string) {
    setEditingExp(null);
    setExpForm({ type: "expense", categoryId: categories[0]?.id ?? "", amount: 0, date: today.toISOString().slice(0, 10), description: "", tripId: presetTripId ?? "" });
    setExpOpen(true);
  }
  function handleReceiptScanned(receipt: ParsedReceipt) {
    setScanOpen(false);
    setExpForm((f) => ({
      ...f,
      amount: receipt.amount ?? f.amount,
      date: receipt.date,
      description: receipt.description,
    }));
  }
  function openEditExp(e: Expense) {
    setEditingExp(e);
    setExpForm({ type: e.type ?? "expense", categoryId: e.categoryId, amount: e.amount, date: e.date, description: e.description, tripId: e.tripId ?? "" });
    setExpOpen(true);
  }
  function saveExp() {
    const isIncome = expForm.type === "income";
    if (!isIncome && !expForm.categoryId) { toast.error("Vyplň kategóriu."); return; }
    if (expForm.amount <= 0 || !expForm.description) {
      toast.error("Vyplň sumu a popis."); return;
    }
    const entry: Expense = {
      id: editingExp?.id ?? crypto.randomUUID(),
      type: expForm.type,
      categoryId: isIncome ? "" : expForm.categoryId,
      amount: expForm.amount,
      currency: "EUR",
      date: expForm.date,
      description: expForm.description,
      ...(expForm.tripId ? { tripId: expForm.tripId } : {}),
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

  // ── Trip CRUD ──
  function openAddTrip() {
    setEditingTrip(null);
    setTripForm({ name: "", icon: "✈️", dateFrom: today.toISOString().slice(0, 10), dateTo: today.toISOString().slice(0, 10), note: "" });
    setTripOpen(true);
  }
  function openEditTrip(t: Trip) {
    setEditingTrip(t);
    setTripForm({ name: t.name, icon: t.icon, dateFrom: t.dateFrom, dateTo: t.dateTo, note: t.note ?? "" });
    setTripOpen(true);
  }
  function saveTrip() {
    if (!tripForm.name || !tripForm.dateFrom || !tripForm.dateTo) {
      toast.error("Vyplň názov a dátumy."); return;
    }
    const entry: Trip = { id: editingTrip?.id ?? crypto.randomUUID(), ...tripForm };
    const updated = editingTrip
      ? trips.map((t) => t.id === editingTrip.id ? entry : t)
      : [...trips, entry];
    saveTrips(updated);
    setTrips(updated);
    setTripOpen(false);
    toast.success(editingTrip ? "Skupina upravená." : "Skupina pridaná.");
  }
  function deleteTrip(id: string) {
    const updated = trips.filter((t) => t.id !== id);
    saveTrips(updated);
    setTrips(updated);
    // Remove tripId from expenses belonging to this trip
    const updatedExp = expenses.map((e) => e.tripId === id ? { ...e, tripId: undefined } : e);
    saveExpenses(updatedExp);
    setExpenses(updatedExp);
    toast.success("Skupina odstránená.");
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
    if (!recurForm.dayOfMonth || recurForm.dayOfMonth < 1 || recurForm.dayOfMonth > 31) {
      toast.error("Zadaj deň v mesiaci (1–31)."); return;
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

  const csvImportRef = useRef<HTMLInputElement>(null);

  async function importFromCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV je prázdne."); return; }
      const header = lines[0].split(/[,;]/).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const dateIdx = header.findIndex((h) => ["date","datum","dátum","booking date"].some((k) => h.includes(k)));
      const amountIdx = header.findIndex((h) => ["amount","suma","betrag","credit","debit","sum"].some((k) => h.includes(k)));
      const descIdx = header.findIndex((h) => ["description","popis","note","memo","text","reference","verwendung"].some((k) => h.includes(k)));
      if (amountIdx === -1) { toast.error("Nenašiel sa stĺpec so sumou. Skontroluj formát CSV."); return; }
      const defaultCatId = categories[0]?.id ?? "other";
      const imported: Expense[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
        const rawAmount = parseFloat((cols[amountIdx] ?? "").replace(/\s/g, "").replace(",", "."));
        if (isNaN(rawAmount) || rawAmount <= 0) continue;
        const dateStr = dateIdx >= 0 ? cols[dateIdx] ?? "" : "";
        const parsedDate = dateStr ? new Date(dateStr.split(".").reverse().join("-")) : new Date(year, month, 1);
        const isoDate = isNaN(parsedDate.getTime()) ? `${year}-${String(month + 1).padStart(2, "0")}-01` : parsedDate.toISOString().slice(0, 10);
        const description = descIdx >= 0 ? (cols[descIdx] ?? "Import").slice(0, 80) : "Import z CSV";
        imported.push({ id: crypto.randomUUID(), categoryId: defaultCatId, amount: rawAmount, currency: "EUR", date: isoDate, description });
      }
      if (imported.length === 0) { toast.error("Žiadne platné riadky. Skontroluj formát."); return; }
      const updated = [...expenses, ...imported];
      saveExpenses(updated);
      setExpenses(updated);
      toast.success(`Importovaných ${imported.length} výdavkov. Skontroluj a uprav kategórie.`);
    } catch {
      toast.error("Chyba pri čítaní CSV.");
    }
  }

  function toggleRecur(id: string) {
    const updated = recurring.map((r) => r.id === id ? { ...r, active: !r.active } : r);
    saveRecurringExpenses(updated);
    setRecurring(updated);
  }

  const selectedCatLabel = categories.find((c) => c.id === expForm.categoryId);
  const selectedRecurCat = categories.find((c) => c.id === recurForm.categoryId);
  const selectedTripLabel = trips.find((t) => t.id === expForm.tripId);

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Výdavky & Rozpočet</h1>
            <p className="text-muted-foreground text-sm mt-1">Sleduj výdavky a mesačné limity</p>
          </div>
          <Button size="sm" onClick={() => openAddExp()}>
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Pridať výdavok</span>
          </Button>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-base font-semibold w-40 text-center">{MONTH_NAMES[month]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {totalIncome > 0 && (
            <Card className="border-green-300 dark:border-green-700">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Príjem</p>
                <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{fmt(totalIncome)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {recurringIncome > 0 && manualIncome > 0 ? `pravidelný + jednorazový` : recurringIncome > 0 ? "pravidelný" : "jednorazový"}
                </p>
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
          <Card className={cashFlow < 0 ? "border-red-300 dark:border-red-700" : totalIncome > 0 ? "border-green-300 dark:border-green-700" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{totalIncome > 0 ? "Cash flow" : "Zostatok"}</p>
              <p className={`text-2xl font-bold mt-1 ${cashFlow < 0 ? "text-red-600 dark:text-red-400" : totalIncome > 0 ? "text-green-600 dark:text-green-400" : ""}`}>
                {totalIncome > 0 ? fmt(cashFlow) : fmt(totalBudget - totalSpent)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{allMonthExpensesOnly.length} výdavkov</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <div className="overflow-x-auto">
            <TabsList className="w-max min-w-full">
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
              <TabsTrigger value="stats">Štatistiky</TabsTrigger>
              <TabsTrigger value="trips">
                Skupiny
                {trips.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{trips.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="categories">Kategórie</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Overview tab ── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {remainingForecast != null && remainingForecast > 0 && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                <CardContent className="pt-3 pb-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm">
                    Do konca mesiaca ešte prídu pravidelné výdavky <strong className="text-blue-700 dark:text-blue-300">{fmt(remainingForecast)}</strong>
                  </p>
                </CardContent>
              </Card>
            )}
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
                        <div key={cat.id} className="flex items-center gap-2">
                          <span className="text-sm w-4 shrink-0">{cat.icon}</span>
                          <span className="text-sm flex-1 min-w-0 truncate">{cat.name}</span>
                          <span className="hidden sm:block text-xs text-muted-foreground w-16 text-right tabular-nums shrink-0">{fmt(prevSpent)}</span>
                          <span className="hidden sm:block text-muted-foreground text-xs shrink-0">→</span>
                          <span className="text-sm font-semibold w-16 text-right tabular-nums shrink-0">{fmt(thisSpent)}</span>
                          <span className={`flex items-center gap-0.5 text-xs w-14 justify-end tabular-nums shrink-0 ${improved ? "text-green-600" : delta > 0 ? "text-red-500" : "text-muted-foreground"}`}>
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
            <div className="flex justify-end gap-2 flex-wrap">
              <input ref={csvImportRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importFromCSV} />
              <Button size="sm" variant="outline" onClick={() => csvImportRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                CSV import
              </Button>
              {allMonthExpenses.length > 0 && (
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  CSV export
                </Button>
              )}
            </div>
            {[...manualMonthExpenses, ...recurringVirtual].length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne záznamy pre {MONTH_NAMES[month]} {year}.
                </CardContent>
              </Card>
            ) : (
              [...manualMonthExpenses, ...recurringVirtual]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e) => {
                  const isIncome = e.type === "income";
                  const cat = isIncome ? null : categories.find((c) => c.id === e.categoryId);
                  const isRecurring = (e as Expense & { _recurring?: boolean })._recurring;
                  const tripTag = e.tripId ? trips.find((t) => t.id === e.tripId) : null;
                  return (
                    <Card key={e.id} className={isIncome ? "border-green-200 dark:border-green-800" : ""}>
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                          style={{ background: isIncome ? "#10b98120" : `${cat?.color ?? "#888"}20` }}>
                          {isIncome ? "💵" : (cat?.icon ?? "📦")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{e.description}</p>
                            {isIncome && <Badge variant="outline" className="text-xs shrink-0 text-green-600 border-green-300">Príjem</Badge>}
                            {isRecurring && <Badge variant="outline" className="text-xs shrink-0">Automatické</Badge>}
                            {tripTag && (
                              <Badge variant="secondary" className="text-xs shrink-0 gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />{tripTag.icon} {tripTag.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isIncome ? "Príjem" : (cat?.name ?? "—")} · {new Date(e.date).toLocaleDateString("sk-SK")}
                          </p>
                        </div>
                        <p className={`font-bold text-sm shrink-0 ${isIncome ? "text-green-600 dark:text-green-400" : ""}`}>
                          {isIncome ? "+" : ""}{fmt(e.amount)}
                        </p>
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground hidden sm:block">Príjmy a výdavky sa automaticky zarátavajú každý mesiac.</p>
              <Button size="sm" onClick={openAddRecur} className="shrink-0"><Plus className="w-4 h-4 mr-2" />Pridať</Button>
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

          {/* ── Stats tab ── */}
          <TabsContent value="stats">
            <BudgetStats expenses={expenses} recurring={recurring} categories={categories} />
          </TabsContent>

          {/* ── Trips tab ── */}
          <TabsContent value="trips" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground hidden sm:block">Skupinové výdavky na výlety, udalosti a projekty.</p>
              <Button size="sm" onClick={openAddTrip}><Plus className="w-4 h-4 mr-2" />Nová skupina</Button>
            </div>
            {trips.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne skupiny. Pridaj skupinu a priraď k nej výdavky.
                </CardContent>
              </Card>
            ) : (
              [...trips]
                .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))
                .map((trip) => {
                  const tripExpenses = expenses.filter((e) => e.tripId === trip.id);
                  const tripTotal = tripExpenses.reduce((s, e) => s + e.amount, 0);
                  const isExpanded = expandedTrip === trip.id;
                  return (
                    <Card key={trip.id}>
                      <CardContent className="pt-3 pb-3">
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-blue-100 dark:bg-blue-900">
                            {trip.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{trip.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(trip.dateFrom).toLocaleDateString("sk-SK")} – {new Date(trip.dateTo).toLocaleDateString("sk-SK")}
                              {trip.note && ` · ${trip.note}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{fmt(tripTotal)}</p>
                            <p className="text-xs text-muted-foreground">{tripExpenses.length} výdavkov</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); openAddExp(trip.id); }}>
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); openEditTrip(trip); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); deleteTrip(trip.id); }}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 space-y-1.5 border-t pt-3">
                            {tripExpenses.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">Žiadne výdavky. Klikni + pre pridanie.</p>
                            ) : (
                              [...tripExpenses]
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .map((e) => {
                                  const cat = categories.find((c) => c.id === e.categoryId);
                                  return (
                                    <div key={e.id} className="flex items-center gap-2 text-sm">
                                      <span className="text-base">{cat?.icon ?? "📦"}</span>
                                      <span className="flex-1 min-w-0 truncate">{e.description}</span>
                                      <span className="text-xs text-muted-foreground shrink-0">{new Date(e.date).toLocaleDateString("sk-SK")}</span>
                                      <span className="font-semibold shrink-0">{fmt(e.amount)}</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEditExp(e)}>
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  );
                                })
                            )}
                            {tripExpenses.length > 1 && (
                              <div className="flex justify-between text-xs font-semibold border-t pt-1.5 mt-1">
                                <span>Spolu</span>
                                <span>{fmt(tripTotal)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
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

      {/* Receipt QR / barcode scanner */}
      <ReceiptScannerDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={handleReceiptScanned}
      />

      {/* Add/Edit expense dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingExp ? "Upraviť záznam" : "Pridať záznam"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Income / Expense toggle */}
            <div className="flex rounded-md overflow-hidden border">
              <button
                type="button"
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${expForm.type === "expense" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                onClick={() => setExpForm({ ...expForm, type: "expense" })}
              >
                Výdavok
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${expForm.type === "income" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                onClick={() => setExpForm({ ...expForm, type: "income", categoryId: "" })}
              >
                Príjem
              </button>
            </div>
            {!editingExp && expForm.type === "expense" && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setScanOpen(true)}>
                <QrCode className="w-4 h-4 mr-2" />
                Skenovať bloček (QR / čiarový kód)
              </Button>
            )}
            {expForm.type === "expense" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kategória</label>
              <Select value={expForm.categoryId} onValueChange={(v) => setExpForm({ ...expForm, categoryId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue>
                    {selectedCatLabel ? `${selectedCatLabel.icon} ${selectedCatLabel.name}` : "Vyber kategóriu"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...categories].sort((a, b) => a.name.localeCompare(b.name, "sk")).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            {trips.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Skupina / udalosť (voliteľné)</label>
                <Select value={expForm.tripId || "__none__"} onValueChange={(v) => setExpForm({ ...expForm, tripId: v === "__none__" ? "" : (v ?? "") })}>
                  <SelectTrigger>
                    <SelectValue>
                      {selectedTripLabel ? `${selectedTripLabel.icon} ${selectedTripLabel.name}` : "— bez skupiny —"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— bez skupiny —</SelectItem>
                    {trips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                {["🏠","🍽️","🚗","💊","🎬","👕","📚","🛡️","💰","📦","✈️","🏋️","🐾","🎮","☕","🎁","💈","🏥","📱","⚡","🎓","🛒","🏖️","💻","🍺","🍕","🧴","💅","🎵","🎸","🏊","🚲","🛵","🚌","🚂","⛽","🔧","🏡","🌿","🌊","🎯","🏆","🎪","🎠","🧸","👶","🍼","💍","💒","🕌","🙏","📸","🖥️","🖨️","📺","📡","🔋","💡","🪴","🐶","🐱","🐟","🦮","🧹","🧺","🪣","🛁","🪑","🛏️","🔑","🏢","💼","📊","📈","🤝","🚀"].map((e) => (
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
                    {[...categories].sort((a, b) => a.name.localeCompare(b.name, "sk")).map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
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
                <Input type="number" min="1" max="31" value={recurForm.dayOfMonth || ""} onChange={(e) => { const v = parseInt(e.target.value); setRecurForm({ ...recurForm, dayOfMonth: isNaN(v) ? 0 : Math.min(31, Math.max(1, v)) }); }} />
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
      {/* Add/Edit trip dialog */}
      <Dialog open={tripOpen} onOpenChange={setTripOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTrip ? "Upraviť skupinu" : "Nová skupina"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ikona</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {["✈️","🏖️","🏔️","🌍","🗺️","🚢","🚂","🏕️","🎡","🎪","🎭","🎵","🍽️","🍺","🎯","🏆","🤿","⛷️","🏄","🧳"].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setTripForm({ ...tripForm, icon: em })}
                    className={`text-lg p-1 rounded-md border transition-colors ${tripForm.icon === em ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <Input placeholder="vlastné emoji" value={tripForm.icon} onChange={(e) => setTripForm({ ...tripForm, icon: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov</label>
              <Input placeholder="napr. Dovolenka v Turecku" value={tripForm.name} onChange={(e) => setTripForm({ ...tripForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Od</label>
                <Input type="date" value={tripForm.dateFrom} onChange={(e) => setTripForm({ ...tripForm, dateFrom: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Do</label>
                <Input type="date" value={tripForm.dateTo} onChange={(e) => setTripForm({ ...tripForm, dateTo: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Poznámka (voliteľné)</label>
              <Input placeholder="napr. All inclusive, 2 týždne" value={tripForm.note} onChange={(e) => setTripForm({ ...tripForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTripOpen(false)}>Zrušiť</Button>
            <Button onClick={saveTrip}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
