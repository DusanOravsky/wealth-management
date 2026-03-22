"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Commodity, Currency } from "@/lib/types";
import { CURRENCIES } from "@/lib/constants";

const EMPTY: Omit<Commodity, "id"> = {
  name: "",
  symbol: "XAU",
  unit: "oz",
  amount: 0,
  purchasePrice: 0,
  currency: "EUR",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function CommoditiesPage() {
  const { portfolio, savePortfolio, goldPrice, silverPrice } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Commodity | null>(null);
  const [form, setForm] = useState<Omit<Commodity, "id">>(EMPTY);

  const commodities = portfolio?.commodities ?? [];

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: Commodity) {
    setEditing(c);
    setForm({ name: c.name, symbol: c.symbol, unit: c.unit, amount: c.amount, purchasePrice: c.purchasePrice, currency: c.currency, note: c.note });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || form.amount <= 0) {
      toast.error("Vyplň názov a množstvo.");
      return;
    }
    if (!portfolio) return;
    const updated = editing
      ? commodities.map((c) => (c.id === editing.id ? { ...form, id: editing.id } : c))
      : [...commodities, { ...form, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, commodities: updated });
    setOpen(false);
    toast.success(editing ? "Komodita aktualizovaná." : "Komodita pridaná.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, commodities: commodities.filter((c) => c.id !== id) });
    toast.success("Komodita odstránená.");
  }

  function getCurrentPrice(symbol: string): number {
    if (symbol === "XAU") return goldPrice;
    if (symbol === "XAG") return silverPrice;
    return 0;
  }

  function getValueEur(c: Commodity): number {
    const price = getCurrentPrice(c.symbol);
    if (price === 0) return 0;
    let oz = c.amount;
    if (c.unit === "g") oz = c.amount / 31.1035;
    else if (c.unit === "kg") oz = c.amount * 32.1507;
    return price * oz;
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Komodity</h1>
            <p className="text-muted-foreground text-sm mt-1">Zlato, striebro a iné drahé kovy</p>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Pridať
          </Button>
        </div>

        {/* Price tiles */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Zlato (XAU)</p>
              <p className="text-2xl font-bold mt-1">{goldPrice > 0 ? fmt(goldPrice) : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">za oz (EUR)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Striebro (XAG)</p>
              <p className="text-2xl font-bold mt-1">{silverPrice > 0 ? fmt(silverPrice) : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">za oz (EUR)</p>
            </CardContent>
          </Card>
        </div>

        {/* Holdings */}
        {commodities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne komodity. Klikni na &quot;Pridať&quot; pre pridanie zlata alebo striebra.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {commodities.map((c) => {
              const valueEur = getValueEur(c);
              const purchaseValueEur = c.purchasePrice * c.amount;
              const gain = valueEur > 0 ? valueEur - purchaseValueEur : 0;
              return (
                <Card key={c.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <Badge variant="outline">{c.symbol}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {c.amount} {c.unit} · Nákup: {fmt(c.purchasePrice, c.currency)}/{c.unit}
                      </p>
                      {c.note && <p className="text-xs text-muted-foreground mt-1">{c.note}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{valueEur > 0 ? fmt(valueEur) : "—"}</p>
                      {gain !== 0 && (
                        <p className={`text-xs flex items-center justify-end gap-1 ${gain >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmt(gain)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{editing ? "Upraviť komoditu" : "Pridať komoditu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Názov (napr. Zlatá minca)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
                <Select value={form.symbol} onValueChange={(v) => setForm({ ...form, symbol: v ?? "XAU" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAU">Zlato (XAU)</SelectItem>
                    <SelectItem value="XAG">Striebro (XAG)</SelectItem>
                    <SelectItem value="OTHER">Iné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jednotka</label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: (v ?? "oz") as Commodity["unit"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oz">oz (unca)</SelectItem>
                    <SelectItem value="g">g (gram)</SelectItem>
                    <SelectItem value="kg">kg (kilogram)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Množstvo</label>
                <Input type="number" step="0.001" min="0" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nákupná cena/{form.unit}</label>
                <Input type="number" step="0.01" min="0" value={form.purchasePrice || ""} onChange={(e) => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mena</label>
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
