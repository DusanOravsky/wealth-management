"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Banknote, ChevronDown, ChevronUp, Search } from "lucide-react";
import { toast } from "sonner";
import type { Commodity, Currency } from "@/lib/types";
import { CURRENCIES, COMMODITY_META, FALLBACK_RATES } from "@/lib/constants";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function toOz(amount: number, unit: Commodity["unit"]) {
  if (unit === "g") return amount / 31.1035;
  if (unit === "kg") return amount * 32.1507;
  return amount;
}

// ── seed data ─────────────────────────────────────────────────────────────────

const HISTORICAL_SEED: Array<Omit<Commodity, "id">> = [
  { name: "Zlatý prút 250g", symbol: "XAU", unit: "g", amount: 250, purchaseTotalEur: 10219, purchaseDate: "2011-11-30", purchasePrice: 40.88, currency: "EUR" },
  { name: "Zlatá unca", symbol: "XAU", unit: "oz", amount: 1, purchaseTotalEur: 1347, purchaseDate: "2012-07-22", purchasePrice: 1347, currency: "EUR" },
  { name: "Zlatá unca", symbol: "XAU", unit: "oz", amount: 1, purchaseTotalEur: 1274, purchaseDate: "2012-07-22", purchasePrice: 1274, currency: "EUR" },
  { name: "Zlatá minca – Čína", symbol: "XAU", unit: "oz", amount: 0.5, purchaseTotalEur: 705, purchaseDate: "2012-07-22", purchasePrice: 1410, currency: "EUR", note: "Čína" },
  { name: "Zlatá minca – Rakúsko", symbol: "XAU", unit: "oz", amount: 0.5, purchaseTotalEur: 692, purchaseDate: "2012-07-22", purchasePrice: 1384, currency: "EUR", note: "Rakúsko" },
  { name: "Zlatá minca – USA", symbol: "XAU", unit: "oz", amount: 0.5, purchaseTotalEur: 698, purchaseDate: "2012-07-22", purchasePrice: 1396, currency: "EUR", note: "USA" },
  { name: "Knieza Pribina", symbol: "XAU", unit: "g", amount: 9.5, purchaseTotalEur: 431, purchaseDate: "2012-07-24", purchasePrice: 45.37, currency: "EUR", note: "Knieza Pribina" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 2250, purchaseDate: "2012-08-21", purchasePrice: 45.00, currency: "EUR" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 2349, purchaseDate: "2012-09-14", purchasePrice: 46.98, currency: "EUR" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 2122, purchaseDate: "2013-02-07", purchasePrice: 42.44, currency: "EUR" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 1870, purchaseDate: "2013-05-20", purchasePrice: 37.40, currency: "EUR" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 1629, purchaseDate: "2013-07-01", purchasePrice: 32.58, currency: "EUR" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 1677, purchaseDate: "2014-10-30", purchasePrice: 33.54, currency: "EUR" },
  { name: "Zlatá minca – Austrália", symbol: "XAU", unit: "oz", amount: 0.5, purchaseTotalEur: 692, purchaseDate: "", purchasePrice: 1384, currency: "EUR", note: "Austrália" },
  { name: "Lukáško – minca", symbol: "XAU", unit: "g", amount: 3.5, purchaseTotalEur: 182, purchaseDate: "2014-01-26", purchasePrice: 52.00, currency: "EUR", note: "Lukáško" },
  { name: "Natálka – minca", symbol: "XAU", unit: "g", amount: 3.5, purchaseTotalEur: 218, purchaseDate: "2015-11-12", purchasePrice: 62.29, currency: "EUR", note: "Natálka" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 3157, purchaseDate: "2023-12-21", purchasePrice: 63.14, currency: "EUR" },
  { name: "Zlatý prút 50g", symbol: "XAU", unit: "g", amount: 50, purchaseTotalEur: 3000, purchaseDate: "2024-07-16", purchasePrice: 60.00, currency: "EUR" },
  { name: "Mayský kalendár", symbol: "XAU", unit: "g", amount: 3.5, purchaseTotalEur: 0, purchaseDate: "", purchasePrice: 0, currency: "EUR", note: "Mayský kalendár" },
  { name: "Pápež Ján Pavol II", symbol: "XAU", unit: "g", amount: 7.7, purchaseTotalEur: 0, purchaseDate: "", purchasePrice: 0, currency: "EUR", note: "Pápež Ján Pavol II" },
];

// ── empty form ────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];

const EMPTY: Omit<Commodity, "id"> = {
  name: "",
  symbol: "XAU",
  unit: "g",
  amount: 0,
  purchasePrice: 0,
  purchaseTotalEur: 0,
  purchaseDate: today(),
  currency: "EUR",
};

// ── page ──────────────────────────────────────────────────────────────────────

export default function CommoditiesPage() {
  const { portfolio, savePortfolio, goldPrice, silverPrice, rates } = useApp();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Commodity | null>(null);
  const [form, setForm] = useState<Omit<Commodity, "id">>(EMPTY);

  const [sellOpen, setSellOpen] = useState(false);
  const [sellItem, setSellItem] = useState<Commodity | null>(null);
  const [sellAmt, setSellAmt] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  const [showSold, setShowSold] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("ALL");

  const commodities = portfolio?.commodities ?? [];

  const active = [...commodities.filter((c) => !c.sold)].sort((a, b) => {
    if (!a.purchaseDate && !b.purchaseDate) return 0;
    if (!a.purchaseDate) return 1;
    if (!b.purchaseDate) return -1;
    return a.purchaseDate.localeCompare(b.purchaseDate);
  });
  const soldItems = commodities.filter((c) => c.sold);

  const symbols = [...new Set(active.map((c) => c.symbol))];

  const filtered = active.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.note?.toLowerCase().includes(q) ?? false);
    const matchSymbol = filterSymbol === "ALL" || c.symbol === filterSymbol;
    return matchSearch && matchSymbol;
  });

  const groups = (filterSymbol === "ALL" ? symbols : symbols.filter((s) => s === filterSymbol)).map((sym) => {
    const items = filtered.filter((c) => c.symbol === sym);
    const totalGrams = items.reduce((s, c) => {
      if (c.unit === "g") return s + c.amount;
      if (c.unit === "oz") return s + c.amount * 31.1035;
      if (c.unit === "kg") return s + c.amount * 1000;
      return s;
    }, 0);
    const groupInvested = items.reduce((s, c) => s + getCostEur(c), 0);
    const groupValue = items.reduce((s, c) => s + getValueEur(c), 0);
    const groupGain = groupValue - groupInvested;
    const groupGainPct = groupInvested > 0 ? (groupGain / groupInvested) * 100 : 0;
    return { sym, items, totalGrams, groupInvested, groupValue, groupGain, groupGainPct };
  });

  // ── price helpers ──────────────────────────────────────────────────────────

  function getValueEur(c: Commodity): number {
    const price = c.symbol === "XAU" ? goldPrice : c.symbol === "XAG" ? silverPrice : 0;
    if (price > 0) return price * toOz(c.amount, c.unit);
    if (c.purchaseTotalEur && c.purchaseTotalEur > 0) return c.purchaseTotalEur;
    const rate = rates[c.currency] ?? FALLBACK_RATES[c.currency] ?? 1;
    return (c.amount * c.purchasePrice) / rate;
  }

  function getCostEur(c: Commodity): number {
    if (c.purchaseTotalEur && c.purchaseTotalEur > 0) return c.purchaseTotalEur;
    const rate = rates[c.currency] ?? FALLBACK_RATES[c.currency] ?? 1;
    return (c.amount * c.purchasePrice) / rate;
  }

  // ── summary ────────────────────────────────────────────────────────────────

  const totalInvested = active.reduce((s, c) => s + getCostEur(c), 0);
  const totalValue = active.reduce((s, c) => s + getValueEur(c), 0);
  const totalGain = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, purchaseDate: today() });
    setOpen(true);
  }

  function openEdit(c: Commodity) {
    setEditing(c);
    setForm({
      name: c.name, symbol: c.symbol, unit: c.unit, amount: c.amount,
      purchasePrice: c.purchasePrice, purchaseTotalEur: c.purchaseTotalEur ?? 0,
      purchaseDate: c.purchaseDate ?? "", currency: c.currency, note: c.note,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || form.amount <= 0) { toast.error("Vyplň názov a množstvo."); return; }
    if (!portfolio) return;
    const entry = {
      ...form,
      purchasePrice: form.purchaseTotalEur && form.amount > 0
        ? form.purchaseTotalEur / form.amount
        : form.purchasePrice,
    };
    const updated = editing
      ? commodities.map((c) => (c.id === editing.id ? { ...entry, id: editing.id } : c))
      : [...commodities, { ...entry, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, commodities: updated });
    setOpen(false);
    toast.success(editing ? "Komodita aktualizovaná." : "Komodita pridaná.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, commodities: commodities.filter((c) => c.id !== id) });
    toast.success("Komodita odstránená.");
  }

  async function handleSeed() {
    if (!portfolio) return;
    const seeded = HISTORICAL_SEED.map((s) => ({ ...s, id: crypto.randomUUID() }));
    await savePortfolio({ ...portfolio, commodities: [...commodities, ...seeded] });
    toast.success(`Naimportovaných ${seeded.length} historických nákupov.`);
  }

  // ── sell ───────────────────────────────────────────────────────────────────

  function openSell(c: Commodity) {
    setSellItem(c);
    setSellAmt(String(c.amount));
    setSellPrice("");
    setSellOpen(true);
  }

  async function handleSell() {
    if (!sellItem || !portfolio) return;
    const amount = parseFloat(sellAmt);
    if (isNaN(amount) || amount <= 0 || amount > sellItem.amount) {
      toast.error("Neplatné množstvo.");
      return;
    }
    const soldTotalEur = parseFloat(sellPrice) || undefined;
    let updated: Commodity[];
    if (amount >= sellItem.amount) {
      // full sell — mark as sold
      updated = commodities.map((c) =>
        c.id === sellItem.id ? { ...c, sold: true, soldDate: today(), soldTotalEur } : c
      );
    } else {
      // partial sell — reduce amount, keep proportional cost
      updated = commodities.map((c) =>
        c.id === sellItem.id
          ? {
              ...c,
              amount: c.amount - amount,
              purchaseTotalEur: c.purchaseTotalEur
                ? (c.purchaseTotalEur / c.amount) * (c.amount - amount)
                : c.purchaseTotalEur,
            }
          : c
      );
    }
    await savePortfolio({ ...portfolio, commodities: updated });
    setSellOpen(false);
    toast.success("Predaj zaznamenaný.");
  }

  async function handleUnsell(id: string) {
    if (!portfolio) return;
    const updated = commodities.map((c) =>
      c.id === id ? { ...c, sold: false, soldDate: undefined } : c
    );
    await savePortfolio({ ...portfolio, commodities: updated });
    toast.success("Predaj zrušený.");
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Komodity</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Zlato, striebro a drahé kovy</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1.5" /> Pridať</Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Investovaných</p>
              <p className="font-bold text-sm mt-0.5">{totalInvested > 0 ? fmt(totalInvested) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Hodnota</p>
              <p className="font-bold text-sm mt-0.5">{totalValue > 0 ? fmt(totalValue) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Zisk</p>
              <p className={`font-bold text-sm mt-0.5 ${totalGain >= 0 ? "text-green-600" : "text-red-500"}`}>
                {totalInvested > 0 ? `${totalGain >= 0 ? "+" : ""}${fmt(totalGain)}` : "—"}
              </p>
              {totalInvested > 0 && (
                <p className={`text-xs ${totalGain >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(0)} %
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live prices */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Zlato (XAU/oz)</p>
              <p className="font-bold">{goldPrice > 0 ? fmt(goldPrice) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Striebro (XAG/oz)</p>
              <p className="font-bold">{silverPrice > 0 ? fmt(silverPrice) : "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Seed button */}
        {commodities.length === 0 && (
          <Button variant="outline" className="w-full" onClick={handleSeed}>
            Naimportovať historické nákupy (20 položiek)
          </Button>
        )}

        {/* Search + symbol filter */}
        {active.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Hľadať..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterSymbol("ALL")}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${filterSymbol === "ALL" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
              >
                Všetky
              </button>
              {symbols.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSymbol(s)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${filterSymbol === s ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
                >
                  {COMMODITY_META[s]?.name ?? s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active holdings — grouped by symbol */}
        {active.length === 0 && commodities.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Žiadne komodity. Klikni na &quot;Pridať&quot; alebo naimportuj historické nákupy.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">Žiadne výsledky.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map(({ sym, items, totalGrams, groupInvested, groupValue, groupGain, groupGainPct }) => (
              items.length === 0 ? null : (
                <div key={sym} className="space-y-2">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{COMMODITY_META[sym]?.name ?? sym}</span>
                      <Badge variant="secondary" className="text-xs">{sym}</Badge>
                      <span className="text-xs text-muted-foreground">{totalGrams.toFixed(1)} g · {items.length} položiek</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium">{groupValue > 0 ? fmt(groupValue) : "—"}</span>
                      {groupInvested > 0 && groupValue > 0 && (
                        <span className={`text-xs ml-2 ${groupGain >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {groupGain >= 0 ? "+" : ""}{groupGainPct.toFixed(0)} %
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  {items.map((c) => {
                    const value = getValueEur(c);
                    const cost = getCostEur(c);
                    const gain = value - cost;
                    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
                    const hasCost = cost > 0;

                    return (
                      <Card key={c.id}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-sm">{c.name}</span>
                                {c.purchaseDate && (
                                  <span className="text-xs text-muted-foreground">{fmtDate(c.purchaseDate)}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.amount} {c.unit}
                                {c.note && ` · ${c.note}`}
                              </p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {hasCost && <span className="text-xs text-muted-foreground">{fmt(cost)}</span>}
                                {hasCost && value > 0 && <span className="text-xs">→</span>}
                                {value > 0 && <span className="text-xs font-medium">{fmt(value)}</span>}
                                {hasCost && value > 0 && (
                                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${gain >= 0 ? "text-green-600" : "text-red-500"}`}>
                                    {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {gain >= 0 ? "+" : ""}{fmt(gain)} ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(0)} %)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0 mt-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSell(c)}>
                                <Banknote className="w-3.5 h-3.5 text-amber-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            ))}
          </div>
        )}

        {/* Sold items */}
        {soldItems.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              onClick={() => setShowSold(!showSold)}
            >
              {showSold ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Predané ({soldItems.length})
            </button>
            {showSold && (
              <div className="space-y-2 opacity-60">
                {soldItems.map((c) => (
                  <Card key={c.id} className="border-dashed">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm line-through">{c.name}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">{c.symbol}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.amount} {c.unit} · Predané {fmtDate(c.soldDate)}
                            {c.note && ` · ${c.note}`}
                          </p>
                          {c.soldTotalEur && c.soldTotalEur > 0 && (
                            <p className="text-xs mt-0.5">
                              Predané za: <strong>{fmt(c.soldTotalEur)}</strong>
                              {c.purchaseTotalEur && c.purchaseTotalEur > 0 && (
                                <span className={`ml-2 ${c.soldTotalEur >= c.purchaseTotalEur ? "text-green-600" : "text-red-500"}`}>
                                  {c.soldTotalEur >= c.purchaseTotalEur ? "+" : ""}{fmt(c.soldTotalEur - c.purchaseTotalEur)}
                                  {" "}({((c.soldTotalEur - c.purchaseTotalEur) / c.purchaseTotalEur * 100).toFixed(0)} %)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Zrušiť predaj" onClick={() => handleUnsell(c.id)}>
                            <TrendingUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit dialog ─────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Upraviť komoditu" : "Pridať komoditu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input placeholder="Názov (napr. Zlatý prút 50g)" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
                <Select value={form.symbol} onValueChange={(v) => setForm({ ...form, symbol: v ?? "XAU" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMMODITY_META).map(([sym, meta]) => (
                      <SelectItem key={sym} value={sym}>{meta.name} ({sym})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jednotka</label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: (v ?? "g") as Commodity["unit"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">g (gram)</SelectItem>
                    <SelectItem value="oz">oz (unca)</SelectItem>
                    <SelectItem value="kg">kg (kilogram)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Množstvo</label>
                <Input type="number" step="0.001" min="0" placeholder="0"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum nákupu</label>
                <Input type="date" value={form.purchaseDate ?? ""}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kúpna cena celkom (EUR)</label>
              <Input type="number" step="1" min="0" placeholder="0"
                value={form.purchaseTotalEur || ""}
                onChange={(e) => setForm({ ...form, purchaseTotalEur: parseFloat(e.target.value) || 0 })} />
            </div>

            <Input placeholder="Poznámka (voliteľné)" value={form.note ?? ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSave}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sell dialog ────────────────────────────────────────────────────────── */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Predať – {sellItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Dostupné: <strong>{sellItem?.amount} {sellItem?.unit}</strong>
              {sellItem && getValueEur(sellItem) > 0 && (
                <> · Aktuálna hodnota: <strong>{fmt(getValueEur(sellItem))}</strong></>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Množstvo na predaj ({sellItem?.unit})</label>
                <Input type="number" step="0.001" min="0.001"
                  max={sellItem?.amount}
                  value={sellAmt}
                  onChange={(e) => setSellAmt(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Predajná cena celkom (EUR)</label>
                <Input type="number" step="1" min="0" placeholder="voliteľné"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ak predáš celé množstvo, položka sa presunie do sekcie &quot;Predané&quot;. Čiastočný predaj zníži dostupné množstvo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>Zrušiť</Button>
            <Button variant="destructive" onClick={handleSell}>Predať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
