"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { loadBudgetCategories, saveBudgetCategories, loadExpenses, saveExpenses } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { BudgetCategory, Expense } from "@/lib/types";

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

export default function BudgetPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Expense dialog
  const [expOpen, setExpOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState({ categoryId: "", amount: 0, date: today.toISOString().slice(0, 10), description: "" });

  // Category dialog
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", color: "#6366f1", monthlyLimit: 0, icon: "📦" });

  useEffect(() => {
    const saved = loadBudgetCategories();
    setCategories(saved.length > 0 ? saved : DEFAULT_CATEGORIES);
    setExpenses(loadExpenses());
  }, []);

  // Expenses for selected month
  const mk = monthKey(year, month);
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(mk)),
    [expenses, mk]
  );

  // Totals per category this month
  const catTotals = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, cat) => {
      acc[cat.id] = monthExpenses
        .filter((e) => e.categoryId === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      return acc;
    }, {});
  }, [categories, monthExpenses]);

  const totalSpent = Object.values(catTotals).reduce((s, v) => s + v, 0);
  const totalBudget = categories.reduce((s, c) => s + c.monthlyLimit, 0);

  const chartData = categories
    .filter((c) => catTotals[c.id] > 0 || c.monthlyLimit > 0)
    .map((c) => ({ name: `${c.icon} ${c.name}`, spent: parseFloat(catTotals[c.id].toFixed(2)), limit: c.monthlyLimit, color: c.color }));

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

  const selectedCatLabel = categories.find((c) => c.id === expForm.categoryId);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={totalSpent > totalBudget ? "border-red-300 dark:border-red-700" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Minuté tento mesiac</p>
              <p className={`text-2xl font-bold mt-1 ${totalSpent > totalBudget ? "text-red-600 dark:text-red-400" : ""}`}>{fmt(totalSpent)}</p>
              <p className="text-xs text-muted-foreground mt-1">{totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}% z rozpočtu` : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Celkový rozpočet</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalBudget)}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(totalBudget / 12 * 12)} / rok</p>
            </CardContent>
          </Card>
          <Card className={(totalBudget - totalSpent) < 0 ? "border-red-300 dark:border-red-700" : "border-green-300 dark:border-green-700"}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Zostatok</p>
              <p className={`text-2xl font-bold mt-1 ${(totalBudget - totalSpent) < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {fmt(totalBudget - totalSpent)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{monthExpenses.length} výdavkov</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Prehľad</TabsTrigger>
            <TabsTrigger value="expenses">Výdavky</TabsTrigger>
            <TabsTrigger value="categories">Kategórie</TabsTrigger>
          </TabsList>

          {/* ── Overview tab ── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Bar chart */}
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

            {/* Category progress */}
            <Card>
              <CardHeader><CardTitle className="text-base">Plnenie rozpočtu</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {categories.map((cat) => {
                  const spent = catTotals[cat.id] ?? 0;
                  const pct = cat.monthlyLimit > 0 ? Math.min(100, (spent / cat.monthlyLimit) * 100) : 0;
                  const over = spent > cat.monthlyLimit && cat.monthlyLimit > 0;
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cat.icon} {cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{fmt(spent)} / {fmt(cat.monthlyLimit)}</span>
                          {over && <Badge variant="destructive" className="text-xs">Prekročené</Badge>}
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: over ? "#ef4444" : cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Expenses tab ── */}
          <TabsContent value="expenses" className="space-y-3 mt-4">
            {monthExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne výdavky pre {MONTH_NAMES[month]} {year}. Pridaj prvý.
                </CardContent>
              </Card>
            ) : (
              [...monthExpenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e) => {
                  const cat = categories.find((c) => c.id === e.categoryId);
                  return (
                    <Card key={e.id}>
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                          style={{ background: `${cat?.color ?? "#888"}20` }}>
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {cat?.name ?? "—"} · {new Date(e.date).toLocaleDateString("sk-SK")}
                          </p>
                        </div>
                        <p className="font-bold text-sm shrink-0">{fmt(e.amount)}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openEditExp(e)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteExp(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
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
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Názov</label>
                <Input placeholder="napr. Šport" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Emoji</label>
                <Input placeholder="🏃" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              </div>
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
    </AppShell>
  );
}
