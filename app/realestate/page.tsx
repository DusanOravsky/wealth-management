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
import { Plus, Pencil, Trash2, Home, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { RealEstateHolding, Currency } from "@/lib/types";
import { FALLBACK_RATES } from "@/lib/constants";

const CURRENCIES = ["EUR", "USD", "CZK", "GBP"] as const;

const RE_TYPE_LABELS: Record<RealEstateHolding["type"], string> = {
  apartment: "Byt",
  house: "Dom",
  cottage: "Chata",
  land: "Pozemok",
  commercial: "Komerčná",
  other: "Iné",
};

const EMPTY: Omit<RealEstateHolding, "id"> = {
  name: "",
  type: "apartment",
  estimatedValue: 0,
  currency: "EUR",
  purchasePrice: undefined,
  purchaseYear: undefined,
  area: undefined,
};

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function toEur(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return amount / rate;
}

export default function RealEstatePage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RealEstateHolding | null>(null);
  const [form, setForm] = useState<Omit<RealEstateHolding, "id">>(EMPTY);

  const holdings = portfolio?.realestate ?? [];
  const totalEur = holdings.reduce((sum, r) => sum + toEur(r.estimatedValue, r.currency, rates), 0);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: RealEstateHolding) {
    setEditing(r);
    setForm({ name: r.name, type: r.type, estimatedValue: r.estimatedValue, currency: r.currency, purchasePrice: r.purchasePrice, purchaseYear: r.purchaseYear, area: r.area, note: r.note });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || form.estimatedValue <= 0) {
      toast.error("Vyplň názov a odhadovanú hodnotu.");
      return;
    }
    if (!portfolio) return;
    const clean = {
      ...form,
      purchasePrice: form.purchasePrice || undefined,
      purchaseYear: form.purchaseYear || undefined,
      area: form.area || undefined,
    };
    const updated = editing
      ? holdings.map((r) => (r.id === editing.id ? { ...clean, id: editing.id } : r))
      : [...holdings, { ...clean, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, realestate: updated });
    setOpen(false);
    toast.success(editing ? "Aktualizované." : "Nehnuteľnosť pridaná.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, realestate: holdings.filter((r) => r.id !== id) });
    toast.success("Odstránené.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Nehnuteľnosti</h1>
            <p className="text-muted-foreground text-sm mt-1">Byty, domy, pozemky a iné nehnuteľnosti</p>
          </div>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celková odhadovaná hodnota (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{fmt(totalEur)}</p>
          </CardContent>
        </Card>

        {holdings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne nehnuteľnosti. Pridaj prvú.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {holdings.map((r) => {
              const valueEur = toEur(r.estimatedValue, r.currency, rates);
              const gainPct = r.purchasePrice
                ? ((r.estimatedValue - r.purchasePrice) / r.purchasePrice) * 100
                : null;
              const currentYear = new Date().getFullYear();
              const yearsHeld = r.purchaseYear ? currentYear - r.purchaseYear : null;
              return (
                <Card key={r.id}>
                  <CardContent className="pt-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.15)" }}>
                      <Home className="w-5 h-5" style={{ color: "#10b981" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.name}</span>
                        <Badge variant="outline" className="text-xs">{RE_TYPE_LABELS[r.type]}</Badge>
                        {r.area && <Badge variant="secondary" className="text-xs">{r.area} m²</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Odhadovaná hodnota: {r.currency} {r.estimatedValue.toLocaleString("sk-SK")}
                        {yearsHeld !== null && ` · držba ${yearsHeld} r.`}
                      </p>
                      {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{fmt(valueEur)}</p>
                      {gainPct !== null && (
                        <p className={`text-xs flex items-center justify-end gap-1 ${gainPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {gainPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{editing ? "Upraviť nehnuteľnosť" : "Pridať nehnuteľnosť"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov (napr. Byt Bratislava)</label>
              <Input
                placeholder="Byt Bratislava"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Typ</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? "apartment") as RealEstateHolding["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RE_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Odhadovaná hodnota</label>
                <Input
                  type="number"
                  step="1000"
                  min="0"
                  value={form.estimatedValue || ""}
                  onChange={(e) => setForm({ ...form, estimatedValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Plocha (m², voliteľné)</label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="napr. 65"
                  value={form.area ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setForm({ ...form, area: isNaN(v) || e.target.value === "" ? undefined : v });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nákupná cena (voliteľné)</label>
                <Input
                  type="number"
                  step="1000"
                  min="0"
                  value={form.purchasePrice ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setForm({ ...form, purchasePrice: isNaN(v) || e.target.value === "" ? undefined : v });
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rok nákupu (voliteľné)</label>
                <Input
                  type="number"
                  min="1950"
                  max={new Date().getFullYear()}
                  placeholder="napr. 2020"
                  value={form.purchaseYear ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setForm({ ...form, purchaseYear: isNaN(v) || e.target.value === "" ? undefined : v });
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
