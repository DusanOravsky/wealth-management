"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import type { PensionEntry, Currency } from "@/lib/types";
import { CURRENCIES, FALLBACK_RATES } from "@/lib/constants";

const EMPTY: Omit<PensionEntry, "id" | "updatedAt"> = { provider: "", value: 0, currency: "EUR" };

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function PensionPage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PensionEntry | null>(null);
  const [form, setForm] = useState<Omit<PensionEntry, "id" | "updatedAt">>(EMPTY);

  const pension = portfolio?.pension ?? [];

  const totalEur = pension.reduce((sum, p) => {
    const rate = rates[p.currency] ?? FALLBACK_RATES[p.currency] ?? 1;
    return sum + p.value / rate;
  }, 0);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(p: PensionEntry) { setEditing(p); setForm({ provider: p.provider, value: p.value, currency: p.currency, note: p.note }); setOpen(true); }

  async function handleSave() {
    if (!form.provider || form.value <= 0) { toast.error("Vyplň správcovskú spoločnosť a hodnotu."); return; }
    if (!portfolio) return;
    const entry: PensionEntry = { ...form, id: editing?.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
    const updated = editing ? pension.map((p) => (p.id === editing.id ? entry : p)) : [...pension, entry];
    await savePortfolio({ ...portfolio, pension: updated });
    setOpen(false);
    toast.success(editing ? "Aktualizované." : "II. pilier pridaný.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, pension: pension.filter((p) => p.id !== id) });
    toast.success("Odstránené.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">II. Dôchodkový Pilier</h1>
            <p className="text-muted-foreground text-sm mt-1">Doplnkové dôchodkové sporenie — manuálna evidencia</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800 flex gap-3">
          <PiggyBank className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-800 dark:text-indigo-300">
            II. pilier je nelikvidný až do dôchodku. Hodnotu aktualizuj manuálne podľa výpisu od DDS.
          </p>
        </div>

        <Card className="bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celková hodnota (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-indigo-700 dark:text-indigo-400">{fmt(totalEur)}</p>
          </CardContent>
        </Card>

        {pension.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadny II. pilier. Klikni na &quot;Pridať&quot;.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pension.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{p.provider}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aktualizované: {new Date(p.updatedAt).toLocaleDateString("sk-SK")}
                    </p>
                    {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{fmt(p.value, p.currency)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Upraviť II. pilier" : "Pridať II. pilier"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Správca (napr. NN, Uniqa, Allianz)" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.01" min="0" placeholder="Hodnota" value={form.value || ""} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} />
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: (v ?? "EUR") as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Poznámka (fond, stratégia...)" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
