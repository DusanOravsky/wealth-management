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
import type { BankAccount, Currency } from "@/lib/types";
import { CURRENCIES, FALLBACK_RATES } from "@/lib/constants";

const EMPTY: Omit<BankAccount, "id"> = { bank: "", name: "", iban: "", balance: 0, currency: "EUR" };

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function BankPage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<Omit<BankAccount, "id">>(EMPTY);

  const accounts = portfolio?.bankAccounts ?? [];

  const totalEur = accounts.reduce((sum, a) => {
    const rate = rates[a.currency] ?? FALLBACK_RATES[a.currency] ?? 1;
    return sum + a.balance / rate;
  }, 0);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(a: BankAccount) { setEditing(a); setForm({ bank: a.bank, name: a.name, iban: a.iban, balance: a.balance, currency: a.currency, note: a.note }); setOpen(true); }

  async function handleSave() {
    if (!form.bank || !form.name) { toast.error("Vyplň banku a názov účtu."); return; }
    if (!portfolio) return;
    const updated = editing
      ? accounts.map((a) => (a.id === editing.id ? { ...form, id: editing.id } : a))
      : [...accounts, { ...form, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, bankAccounts: updated });
    setOpen(false);
    toast.success(editing ? "Účet aktualizovaný." : "Účet pridaný.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, bankAccounts: accounts.filter((a) => a.id !== id) });
    toast.success("Účet odstránený.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bankové účty</h1>
            <p className="text-muted-foreground text-sm mt-1">Evidencia zostatkov na bankových účtoch</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celkový zostatok (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-blue-700 dark:text-blue-400">{fmt(totalEur)}</p>
          </CardContent>
        </Card>

        {accounts.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadne účty. Klikni na &quot;Pridať&quot;.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{a.bank} — {a.name}</p>
                    {a.iban && <p className="text-xs text-muted-foreground font-mono mt-1">{a.iban}</p>}
                    {a.note && <p className="text-xs text-muted-foreground mt-1">{a.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{fmt(a.balance, a.currency)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Upraviť účet" : "Pridať bankový účet"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Banka (napr. Tatra banka, Slovenská sporiteľňa)" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
            <Input placeholder="Názov účtu (napr. Bežný účet)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="IBAN (voliteľné)" value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="font-mono" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.01" placeholder="Zostatok" value={form.balance || ""} onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })} />
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
