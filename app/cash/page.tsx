"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CashEntry, Currency } from "@/lib/types";
import { CURRENCIES, CURRENCY_SYMBOLS, FALLBACK_RATES } from "@/lib/constants";

const EMPTY: Omit<CashEntry, "id"> = { label: "", amount: 0, currency: "EUR" };

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function CashPage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashEntry | null>(null);
  const [form, setForm] = useState<Omit<CashEntry, "id">>(EMPTY);

  const cash = portfolio?.cash ?? [];

  const totalEur = cash.reduce((sum, c) => {
    const rate = rates[c.currency] ?? FALLBACK_RATES[c.currency] ?? 1;
    return sum + c.amount / rate;
  }, 0);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(c: CashEntry) { setEditing(c); setForm({ label: c.label, amount: c.amount, currency: c.currency, note: c.note }); setOpen(true); }

  async function handleSave() {
    if (!form.label || form.amount <= 0) { toast.error("Vyplň popis a sumu."); return; }
    if (!portfolio) return;
    const updated = editing
      ? cash.map((c) => (c.id === editing.id ? { ...form, id: editing.id } : c))
      : [...cash, { ...form, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, cash: updated });
    setOpen(false);
    toast.success(editing ? "Aktualizované." : "Hotovosť pridaná.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, cash: cash.filter((c) => c.id !== id) });
    toast.success("Odstránené.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hotovosť</h1>
            <p className="text-muted-foreground text-sm mt-1">Prehľad hotovosti a likvidných prostriedkov</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celková hotovosť (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-green-700 dark:text-green-400">{fmt(totalEur)}</p>
          </CardContent>
        </Card>

        {cash.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadna hotovosť. Klikni na &quot;Pridať&quot;.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {cash.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{c.label}</p>
                    {c.note && <p className="text-xs text-muted-foreground mt-1">{c.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{fmt(c.amount, c.currency)}</p>
                    <p className="text-xs text-muted-foreground">{CURRENCY_SYMBOLS[c.currency] ?? c.currency}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Upraviť" : "Pridať hotovosť"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Popis (napr. Peňaženka, Trezor)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.01" min="0" placeholder="Suma" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: (v ?? "EUR") as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Poznámka (voliteľné)" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
