"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockHolding | null>(null);
  const [form, setForm] = useState<Omit<StockHolding, "id">>(EMPTY);

  const holdings = portfolio?.stocks ?? [];

  function getValueEur(s: StockHolding): number {
    const pricePerShare = s.currentPrice ?? s.purchasePrice;
    return toEur(s.amount * pricePerShare, s.currency, rates);
  }

  const totalEur = holdings.reduce((sum, s) => sum + getValueEur(s), 0);

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

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celková hodnota (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-blue-700 dark:text-blue-400">{fmt(totalEur)}</p>
            <p className="text-xs text-muted-foreground mt-1">Ceny sú manuálne — aktualizuj ich pravidelne</p>
          </CardContent>
        </Card>

        {holdings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne akcie. Pridaj prvú investíciu.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {holdings.map((s) => {
              const valueEur = getValueEur(s);
              const pricePerShare = s.currentPrice ?? s.purchasePrice;
              const gainPct = s.currentPrice
                ? ((s.currentPrice - s.purchasePrice) / s.purchasePrice) * 100
                : null;
              const costEur = toEur(s.amount * s.purchasePrice, s.currency, rates);
              return (
                <Card key={s.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{s.ticker}</span>
                        <span className="font-medium text-sm">{s.name}</span>
                        {s.exchange && <Badge variant="outline" className="text-xs">{s.exchange}</Badge>}
                        <Badge variant="secondary" className="text-xs">{s.currency}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.amount} ks · {s.currency} {pricePerShare.toFixed(2)}/ks
                        {s.currentPrice && (
                          <span className="text-muted-foreground"> · nákup: {s.currency} {s.purchasePrice.toFixed(2)}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{fmt(valueEur)}</p>
                      {gainPct !== null && (
                        <p className={`text-xs flex items-center justify-end gap-1 ${gainPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {gainPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                        </p>
                      )}
                      {gainPct === null && (
                        <p className="text-xs text-muted-foreground">nákup {fmt(costEur)}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
                <label className="text-xs text-muted-foreground mb-1 block">Aktuálna cena/ks</label>
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
    </AppShell>
  );
}
