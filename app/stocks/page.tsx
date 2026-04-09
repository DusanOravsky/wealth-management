"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Bell, BellOff, ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { StockHolding, Currency, StockWatchItem, StockTransaction } from "@/lib/types";
import { FALLBACK_RATES } from "@/lib/constants";
import { loadWatchlist, saveWatchlist, loadStockTransactions, saveStockTransactions } from "@/lib/store";

const CURRENCIES = ["EUR", "USD", "CZK", "GBP"] as const;

const EMPTY: Omit<StockHolding, "id"> = {
  ticker: "",
  name: "",
  amount: 0,
  purchasePrice: 0,
  currentPrice: undefined,
  currency: "EUR",
  exchange: "",
  annualDividendYield: undefined,
};

const EMPTY_WATCH: Omit<StockWatchItem, "id"> = {
  ticker: "",
  name: "",
  targetPrice: undefined,
  note: "",
};

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function toEur(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return amount / rate;
}

export default function StocksPage() {
  const { portfolio, savePortfolio, rates, stockPrices } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockHolding | null>(null);
  const [form, setForm] = useState<Omit<StockHolding, "id">>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<StockWatchItem[]>(() => loadWatchlist());
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchEditing, setWatchEditing] = useState<StockWatchItem | null>(null);
  const [watchForm, setWatchForm] = useState<Omit<StockWatchItem, "id">>(EMPTY_WATCH);
  const [watchDeleteConfirm, setWatchDeleteConfirm] = useState<{ id: string; ticker: string } | null>(null);

  const [stockTxs, setStockTxs] = useState<StockTransaction[]>(() => loadStockTransactions());
  const [stockTxOpen, setStockTxOpen] = useState(false);
  const [stockTxForm, setStockTxForm] = useState<Omit<StockTransaction, "id">>({
    ticker: "", type: "buy", amount: 0, pricePerShare: 0, totalEur: 0,
    date: new Date().toISOString().slice(0, 10),
  });
  const [stockTxSearch, setStockTxSearch] = useState("");
  const [holdingSearch, setHoldingSearch] = useState("");

  const filteredStockTxs = useMemo(() => {
    return [...stockTxs]
      .filter((t) => !stockTxSearch || t.ticker.toLowerCase().includes(stockTxSearch.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [stockTxs, stockTxSearch]);

  const holdings = portfolio?.stocks ?? [];

  // Use live Yahoo Finance price (USD→EUR) if available, else currentPrice or purchasePrice
  function getLivePriceEur(s: StockHolding): number | null {
    const liveUsd = stockPrices[s.ticker.toUpperCase()];
    if (liveUsd != null) return toEur(liveUsd, "USD", rates);
    return null;
  }

  function getValueEur(s: StockHolding): number {
    const live = getLivePriceEur(s);
    if (live != null) return s.amount * live;
    return toEur(s.amount * (s.currentPrice ?? s.purchasePrice), s.currency, rates);
  }

  function getCostEur(s: StockHolding): number {
    return toEur(s.amount * s.purchasePrice, s.currency, rates);
  }

  const totalEur = holdings.reduce((sum, s) => sum + getValueEur(s), 0);
  const totalCostEur = holdings.reduce((sum, s) => sum + getCostEur(s), 0);
  const totalGainEur = totalEur - totalCostEur;
  const totalGainPct = totalCostEur > 0 ? (totalGainEur / totalCostEur) * 100 : 0;

  // Annual dividend income estimate
  const annualDividendEur = useMemo(() => holdings.reduce((sum, s) => {
    if (!s.annualDividendYield) return sum;
    return sum + getValueEur(s) * (s.annualDividendYield / 100);
  }, 0), [holdings, rates, stockPrices]); // eslint-disable-line react-hooks/exhaustive-deps

  const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","Máj","Jún","Júl","Aug","Sep","Okt","Nov","Dec"];
  const currentMonth = new Date().getMonth();

  // Dividend calendar — quarterly assumption (Mar/Jun/Sep/Dec = months 2,5,8,11)
  const dividendsByMonth = useMemo(() => {
    const monthTotals = Array(12).fill(0) as number[];
    const quarterlyMonths = [2, 5, 8, 11];
    for (const s of holdings) {
      if (!s.annualDividendYield) continue;
      const valueEur = getValueEur(s);
      if (valueEur <= 0) continue;
      const annualDiv = valueEur * (s.annualDividendYield / 100);
      const quarterlyDiv = annualDiv / 4;
      for (const m of quarterlyMonths) {
        monthTotals[m] += quarterlyDiv;
      }
    }
    return monthTotals;
  }, [holdings, rates, stockPrices]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(s: StockHolding) {
    setEditing(s);
    setForm({ ticker: s.ticker, name: s.name, amount: s.amount, purchasePrice: s.purchasePrice, currentPrice: s.currentPrice, currency: s.currency, exchange: s.exchange, note: s.note, annualDividendYield: s.annualDividendYield });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.ticker || !form.name || form.amount <= 0 || form.purchasePrice <= 0) {
      toast.error("Vyplň ticker, názov, množstvo a nákupnú cenu.");
      return;
    }
    if (!portfolio) return;
    const clean = { ...form, currentPrice: form.currentPrice || undefined, annualDividendYield: form.annualDividendYield || undefined };
    const updated = editing
      ? holdings.map((s) => (s.id === editing.id ? { ...clean, id: editing.id } : s))
      : [...holdings, { ...clean, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, stocks: updated });
    setOpen(false);
    toast.success(editing ? "Aktualizované." : "Akcia pridaná.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, stocks: holdings.filter((s) => s.id !== id) });
    setDeleteConfirm(null);
    toast.success("Odstránené.");
  }

  // Stock transaction handlers
  function openAddStockTx(s?: StockHolding) {
    setStockTxForm({
      ticker: s?.ticker ?? "", type: "buy", amount: 0,
      pricePerShare: s?.purchasePrice ?? 0, totalEur: 0,
      date: new Date().toISOString().slice(0, 10),
    });
    setStockTxOpen(true);
  }
  function saveStockTx() {
    if (!stockTxForm.ticker || stockTxForm.amount <= 0 || stockTxForm.pricePerShare <= 0) {
      toast.error("Vyplň ticker, množstvo a cenu."); return;
    }
    const entry: StockTransaction = {
      id: crypto.randomUUID(),
      ...stockTxForm,
      totalEur: toEur(stockTxForm.amount * stockTxForm.pricePerShare, "EUR", rates),
    };
    const updated = [...stockTxs, entry];
    saveStockTransactions(updated);
    setStockTxs(updated);
    setStockTxOpen(false);
    toast.success("Transakcia pridaná.");
  }
  function deleteStockTx(id: string) {
    const updated = stockTxs.filter((t) => t.id !== id);
    saveStockTransactions(updated);
    setStockTxs(updated);
  }

  // Watchlist handlers
  function openAddWatch() { setWatchEditing(null); setWatchForm(EMPTY_WATCH); setWatchOpen(true); }
  function openEditWatch(w: StockWatchItem) {
    setWatchEditing(w);
    setWatchForm({ ticker: w.ticker, name: w.name, targetPrice: w.targetPrice, note: w.note });
    setWatchOpen(true);
  }
  function handleSaveWatch() {
    if (!watchForm.ticker || !watchForm.name) { toast.error("Vyplň ticker a názov."); return; }
    const clean: StockWatchItem = { ...watchForm, id: watchEditing?.id ?? crypto.randomUUID() };
    const updated = watchEditing
      ? watchlist.map((w) => (w.id === watchEditing.id ? clean : w))
      : [...watchlist, clean];
    saveWatchlist(updated);
    setWatchlist(updated);
    setWatchOpen(false);
    toast.success(watchEditing ? "Aktualizované." : "Pridané do watchlistu.");
  }
  function handleDeleteWatch(id: string) {
    const updated = watchlist.filter((w) => w.id !== id);
    saveWatchlist(updated);
    setWatchlist(updated);
    setWatchDeleteConfirm(null);
    toast.success("Odstránené z watchlistu.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div>
          <h1 className="text-2xl font-bold">Akcie</h1>
          <p className="text-muted-foreground text-sm mt-1">Akciové investície a ETF</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Hodnota</p>
              <p className="text-xl font-bold mt-0.5">{fmt(totalEur)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Live · Yahoo Finance</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Investované</p>
              <p className="text-xl font-bold mt-0.5">{totalCostEur > 0 ? fmt(totalCostEur) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Zisk / Strata</p>
              <p className={`text-xl font-bold mt-0.5 ${totalGainEur >= 0 ? "text-green-600" : "text-red-500"}`}>
                {totalCostEur > 0 ? `${totalGainEur >= 0 ? "+" : ""}${fmt(totalGainEur)}` : "—"}
              </p>
              {totalCostEur > 0 && (
                <p className={`text-xs mt-0.5 ${totalGainEur >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(1)}%
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Dividendy / rok</p>
              <p className="text-xl font-bold mt-0.5">{annualDividendEur > 0 ? fmt(annualDividendEur) : "—"}</p>
              {annualDividendEur > 0 && <p className="text-xs text-muted-foreground mt-0.5">{fmt(annualDividendEur / 12)}/mes</p>}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="holdings">
          <div className="flex items-start gap-2">
            <div className="overflow-x-auto flex-1">
              <TabsList className="w-max min-w-full">
                <TabsTrigger value="holdings">Pozície ({holdings.length})</TabsTrigger>
                <TabsTrigger value="history">
                  História
                  {stockTxs.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{stockTxs.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="dividends">Dividendy</TabsTrigger>
                <TabsTrigger value="watchlist">Watchlist ({watchlist.length})</TabsTrigger>
              </TabsList>
            </div>
            <div>
              <TabsContent value="holdings" className="mt-0">
                <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <Button size="sm" onClick={() => openAddStockTx()}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
              </TabsContent>
              <TabsContent value="dividends" className="mt-0" />
              <TabsContent value="watchlist" className="mt-0">
                <Button size="sm" onClick={openAddWatch}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
              </TabsContent>
            </div>
          </div>

          {/* Holdings tab */}
          <TabsContent value="holdings" className="mt-4">
            {holdings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Žiadne akcie. Pridaj prvú investíciu.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {holdings.length > 4 && (
                  <Input
                    placeholder="Hľadaj ticker alebo názov..."
                    value={holdingSearch}
                    onChange={(e) => setHoldingSearch(e.target.value)}
                    className="mb-2"
                  />
                )}
                {holdings.filter((s) => !holdingSearch || s.ticker.toLowerCase().includes(holdingSearch.toLowerCase()) || s.name.toLowerCase().includes(holdingSearch.toLowerCase())).map((s) => {
                  const live = getLivePriceEur(s);
                  const valueEur = getValueEur(s);
                  const costEur = getCostEur(s);
                  const gainEur = valueEur - costEur;
                  const gainPct = costEur > 0 ? (gainEur / costEur) * 100 : null;
                  const liveUsd = stockPrices[s.ticker.toUpperCase()];
                  const dividendEur = s.annualDividendYield ? valueEur * (s.annualDividendYield / 100) : null;

                  return (
                    <Card key={s.id}>
                      <CardContent className="pt-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base">{s.ticker}</span>
                            <span className="font-medium text-sm">{s.name}</span>
                            {s.exchange && <Badge variant="outline" className="text-xs">{s.exchange}</Badge>}
                            <Badge variant="secondary" className="text-xs">{s.currency}</Badge>
                            {liveUsd != null && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-300">Live</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {s.amount} ks
                            {live != null
                              ? ` · €${(live).toFixed(2)}/ks (live)`
                              : ` · ${s.currency} ${(s.currentPrice ?? s.purchasePrice).toFixed(2)}/ks`}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {costEur > 0 && (
                              <p className="text-xs text-muted-foreground">nákup {fmt(costEur)}</p>
                            )}
                            {dividendEur != null && (
                              <p className="text-xs text-amber-600">div. {fmt(dividendEur)}/rok · {s.annualDividendYield}%</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{fmt(valueEur)}</p>
                          {gainPct !== null && (
                            <p className={`text-xs flex items-center justify-end gap-1 ${gainEur >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {gainEur >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {gainEur >= 0 ? "+" : ""}{fmt(gainEur)} ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ id: s.id, name: `${s.name} (${s.ticker})` })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History tab */}
          <TabsContent value="history" className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input placeholder="Hľadaj ticker..." value={stockTxSearch} onChange={(e) => setStockTxSearch(e.target.value)} className="max-w-xs" />
            </div>
            {filteredStockTxs.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Žiadne transakcie. Pridaj nákupy a predaje akcií.</CardContent></Card>
            ) : (
              filteredStockTxs.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-3 pb-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "buy" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                      {t.type === "buy" ? <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{t.ticker}</p>
                        <Badge variant="outline" className="text-xs">{t.type === "buy" ? "Nákup" : "Predaj"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.amount} ks · {fmt(t.pricePerShare)}/ks · {new Date(t.date).toLocaleDateString("sk-SK")}
                        {t.fee ? ` · poplatok ${fmt(t.fee)}` : ""}
                      </p>
                      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                    </div>
                    <p className={`font-bold text-sm shrink-0 ${t.type === "buy" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                      {t.type === "buy" ? "-" : "+"}{fmt(t.totalEur)}
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => deleteStockTx(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Dividends tab */}
          <TabsContent value="dividends" className="mt-4 space-y-3">
            {holdings.filter((s) => s.annualDividendYield).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Žiadne akcie s dividendovým výnosom. Nastav Annual Dividend Yield pri akciách.</CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">Odhadovaný kalendár (kvartálne)</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {MONTH_NAMES_SHORT.map((name, i) => {
                        const div = dividendsByMonth[i];
                        const isPast = i < currentMonth;
                        const isCurrentM = i === currentMonth;
                        return (
                          <div key={i} className={`rounded-lg p-2 text-center border transition-colors ${isCurrentM ? "border-primary bg-primary/5" : isPast ? "opacity-50" : "border-border"}`}>
                            <p className="text-xs text-muted-foreground">{name}</p>
                            <p className={`text-sm font-semibold mt-0.5 ${div > 0 ? (isPast ? "text-muted-foreground" : "text-green-600 dark:text-green-400") : "text-muted-foreground"}`}>
                              {div > 0 ? `€${div.toFixed(0)}` : "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Ročný príjem z dividend</p>
                    {holdings.filter((s) => s.annualDividendYield).sort((a, b) => {
                      const aDiv = getValueEur(a) * (a.annualDividendYield! / 100);
                      const bDiv = getValueEur(b) * (b.annualDividendYield! / 100);
                      return bDiv - aDiv;
                    }).map((s) => {
                      const valueEur = getValueEur(s);
                      const divEur = valueEur * (s.annualDividendYield! / 100);
                      return (
                        <div key={s.id} className="flex items-center gap-3">
                          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1">{s.ticker} — {s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.annualDividendYield}% p.a.</span>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">{fmt(divEur)}/rok</span>
                          <span className="text-xs text-muted-foreground">{fmt(divEur / 12)}/mes.</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between font-semibold border-t pt-2 mt-1 text-sm">
                      <span>Spolu</span>
                      <span className="text-green-600 dark:text-green-400">{fmt(annualDividendEur)}/rok · {fmt(annualDividendEur / 12)}/mes.</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Watchlist tab */}
          <TabsContent value="watchlist" className="mt-4">
            {watchlist.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Watchlist je prázdny. Pridaj tituly, ktoré sleduješ.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {watchlist.map((w) => {
                  const liveUsd = stockPrices[w.ticker.toUpperCase()];
                  const liveEur = liveUsd != null ? toEur(liveUsd, "USD", rates) : null;
                  const targetEur = w.targetPrice;
                  const reachedTarget = liveEur != null && targetEur != null && liveEur >= targetEur;
                  const pctToTarget = liveEur != null && targetEur != null
                    ? ((targetEur - liveEur) / liveEur) * 100
                    : null;

                  return (
                    <Card key={w.id} className={reachedTarget ? "border-green-500" : ""}>
                      <CardContent className="pt-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base">{w.ticker}</span>
                            <span className="font-medium text-sm">{w.name}</span>
                            {reachedTarget && (
                              <Badge className="text-xs bg-green-600">Dosiahnutý cieľ</Badge>
                            )}
                          </div>
                          {w.note && <p className="text-xs text-muted-foreground mt-0.5">{w.note}</p>}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {liveEur != null && (
                              <p className="text-sm">Live: <span className="font-semibold">€{liveEur.toFixed(2)}</span></p>
                            )}
                            {targetEur != null && (
                              <p className="text-sm text-muted-foreground">Cieľ: €{targetEur.toFixed(2)}</p>
                            )}
                            {pctToTarget != null && !reachedTarget && (
                              <p className="text-xs text-blue-600">{pctToTarget > 0 ? "+" : ""}{pctToTarget.toFixed(1)}% k cieľu</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {liveEur != null
                            ? <Bell className="w-4 h-4 text-green-600" />
                            : <BellOff className="w-4 h-4 text-muted-foreground" />}
                          <Button variant="ghost" size="icon" onClick={() => openEditWatch(w)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setWatchDeleteConfirm({ id: w.id, ticker: w.ticker })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Upraviť akciu" : "Pridať akciu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ticker (napr. AAPL)</label>
                <Input
                  placeholder="AAPL"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mena</label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: (v ?? "EUR") as Currency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov spoločnosti</label>
              <Input
                placeholder="Apple Inc."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Burza (napr. NASDAQ, NYSE)</label>
              <Input
                placeholder="NASDAQ"
                value={form.exchange ?? ""}
                onChange={(e) => setForm({ ...form, exchange: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Počet kusov</label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nákupná cena/ks</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchasePrice || ""}
                  onChange={(e) => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Akt. cena/ks</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="voliteľné"
                  value={form.currentPrice ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setForm({ ...form, currentPrice: isNaN(v) || e.target.value === "" ? undefined : v });
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ročný dividendový výnos % (voliteľné)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="napr. 3.5"
                value={form.annualDividendYield ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setForm({ ...form, annualDividendYield: isNaN(v) || e.target.value === "" ? undefined : v });
                }}
              />
            </div>
            <Input
              placeholder="Poznámka (voliteľné)"
              value={form.note ?? ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSave}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock transaction dialog */}
      <Dialog open={stockTxOpen} onOpenChange={setStockTxOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pridať akciovú transakciu</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex rounded-lg overflow-hidden border">
              <button className={`flex-1 py-2 text-sm font-medium transition-colors ${stockTxForm.type === "buy" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setStockTxForm({ ...stockTxForm, type: "buy" })}>Nákup</button>
              <button className={`flex-1 py-2 text-sm font-medium transition-colors ${stockTxForm.type === "sell" ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setStockTxForm({ ...stockTxForm, type: "sell" })}>Predaj</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ticker (napr. AAPL)</label>
                <Input placeholder="AAPL" value={stockTxForm.ticker} onChange={(e) => setStockTxForm({ ...stockTxForm, ticker: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum</label>
                <Input type="date" value={stockTxForm.date} onChange={(e) => setStockTxForm({ ...stockTxForm, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Počet akcií</label>
                <Input type="number" step="0.001" min="0" value={stockTxForm.amount || ""} onChange={(e) => setStockTxForm({ ...stockTxForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cena/ks (EUR)</label>
                <Input type="number" step="0.01" min="0" value={stockTxForm.pricePerShare || ""} onChange={(e) => setStockTxForm({ ...stockTxForm, pricePerShare: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Poplatok EUR (voliteľné)</label>
              <Input type="number" step="0.01" min="0" value={stockTxForm.fee ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setStockTxForm({ ...stockTxForm, fee: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
            </div>
            {stockTxForm.amount > 0 && stockTxForm.pricePerShare > 0 && (
              <p className="text-sm text-muted-foreground">Celkom: <strong>{fmt(stockTxForm.amount * stockTxForm.pricePerShare)}</strong></p>
            )}
            <Input placeholder="Poznámka (voliteľné)" value={stockTxForm.note ?? ""} onChange={(e) => setStockTxForm({ ...stockTxForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockTxOpen(false)}>Zrušiť</Button>
            <Button onClick={saveStockTx}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať akciu?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Naozaj chceš vymazať <strong>{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Zrušiť</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}>Vymazať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Watchlist dialog */}
      <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{watchEditing ? "Upraviť watchlist" : "Pridať do watchlistu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
                <Input
                  placeholder="AAPL"
                  value={watchForm.ticker}
                  onChange={(e) => setWatchForm({ ...watchForm, ticker: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cieľová cena (€, voliteľné)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="napr. 200"
                  value={watchForm.targetPrice ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setWatchForm({ ...watchForm, targetPrice: isNaN(v) || e.target.value === "" ? undefined : v });
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov</label>
              <Input
                placeholder="Apple Inc."
                value={watchForm.name}
                onChange={(e) => setWatchForm({ ...watchForm, name: e.target.value })}
              />
            </div>
            <Input
              placeholder="Poznámka (voliteľné)"
              value={watchForm.note ?? ""}
              onChange={(e) => setWatchForm({ ...watchForm, note: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWatchOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSaveWatch}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={watchDeleteConfirm !== null} onOpenChange={(o) => { if (!o) setWatchDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať z watchlistu?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Naozaj chceš odstrániť <strong>{watchDeleteConfirm?.ticker}</strong> z watchlistu?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWatchDeleteConfirm(null)}>Zrušiť</Button>
            <Button variant="destructive" onClick={() => watchDeleteConfirm && handleDeleteWatch(watchDeleteConfirm.id)}>Vymazať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
