"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { StockHolding, Currency } from "@/lib/types";
import { FALLBACK_RATES } from "@/lib/constants";

const CURRENCIES = ["EUR", "USD", "CZK", "GBP"] as const;

const EMPTY: Omit<StockHolding, "id"> = {
  ticker: "",
  name: "",
  amount: 0,
  purchasePrice: 0,
  currentPrice: undefined,
  currency: "EUR",
  exchange: "",
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

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(s: StockHolding) {
    setEditing(s);
    setForm({ ticker: s.ticker, name: s.name, amount: s.amount, purchasePrice: s.purchasePrice, currentPrice: s.currentPrice, currency: s.currency, exchange: s.exchange, note: s.note });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.ticker || !form.name || form.amount <= 0 || form.purchasePrice <= 0) {
      toast.error("Vyplň ticker, názov, množstvo a nákupnú cenu.");
      return;
    }
    if (!portfolio) return;
    const clean = { ...form, currentPrice: form.currentPrice || undefined };
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

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Akcie</h1>
            <p className="text-muted-foreground text-sm mt-1">Akciové investície a ETF</p>
          </div>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Hodnota</p>
              <p className="text-xl font-bold mt-0.5">{fmt(totalEur)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Live ceny · Yahoo Finance</p>
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
        </div>

        {holdings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne akcie. Pridaj prvú investíciu.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {holdings.map((s) => {
              const live = getLivePriceEur(s);
              const valueEur = getValueEur(s);
              const costEur = getCostEur(s);
              const gainEur = valueEur - costEur;
              const gainPct = costEur > 0 ? (gainEur / costEur) * 100 : null;
              const liveUsd = stockPrices[s.ticker.toUpperCase()];

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
                      {costEur > 0 && (
                        <p className="text-xs text-muted-foreground">nákup {fmt(costEur)}</p>
                      )}
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
    </AppShell>
  );
}
