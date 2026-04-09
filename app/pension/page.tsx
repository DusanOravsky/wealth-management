"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { loadPensionContributions, savePensionContributions } from "@/lib/store";
import type { PensionEntry, PensionContribution, Currency } from "@/lib/types";
import { CURRENCIES, FALLBACK_RATES } from "@/lib/constants";

const EMPTY: Omit<PensionEntry, "id" | "updatedAt"> = { provider: "", value: 0, currency: "EUR" };
const EMPTY_CONTRIB: Omit<PensionContribution, "id" | "pensionId"> = {
  date: new Date().toISOString().slice(0, 10),
  amount: 0,
  currency: "EUR",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}
function fmtEur(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function PensionPage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PensionEntry | null>(null);
  const [form, setForm] = useState<Omit<PensionEntry, "id" | "updatedAt">>(EMPTY);

  const [contributions, setContributions] = useState<PensionContribution[]>(() => loadPensionContributions());
  const [contribOpen, setContribOpen] = useState(false);
  const [contribPensionId, setContribPensionId] = useState<string>("");
  const [contribForm, setContribForm] = useState<Omit<PensionContribution, "id" | "pensionId">>(EMPTY_CONTRIB);
  const [filterPensionId, setFilterPensionId] = useState<string>("all");

  const pension = portfolio?.pension ?? [];

  const totalEur = pension.reduce((sum, p) => {
    const rate = rates[p.currency] ?? FALLBACK_RATES[p.currency] ?? 1;
    return sum + p.value / rate;
  }, 0);

  // Per-pension contribution totals
  const contribSummary = useMemo(() => {
    return pension.reduce<Record<string, { total: number; count: number; lastDate: string | null }>>((acc, p) => {
      const cs = contributions.filter((c) => c.pensionId === p.id);
      acc[p.id] = {
        total: cs.reduce((s, c) => s + c.amount, 0),
        count: cs.length,
        lastDate: cs.length > 0 ? cs.sort((a, b) => b.date.localeCompare(a.date))[0].date : null,
      };
      return acc;
    }, {});
  }, [contributions, pension]);

  // Yearly breakdown of contributions
  const yearlyContribs = useMemo(() => {
    const filtered = filterPensionId === "all" ? contributions : contributions.filter((c) => c.pensionId === filterPensionId);
    const byYear: Record<string, number> = {};
    filtered.forEach((c) => {
      const y = c.date.slice(0, 4);
      byYear[y] = (byYear[y] ?? 0) + c.amount;
    });
    return Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0]));
  }, [contributions, filterPensionId]);

  const filteredContribs = useMemo(() => {
    return [...contributions]
      .filter((c) => filterPensionId === "all" || c.pensionId === filterPensionId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [contributions, filterPensionId]);

  // Pension CRUD
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
    const updated = contributions.filter((c) => c.pensionId !== id);
    savePensionContributions(updated);
    setContributions(updated);
    toast.success("Odstránené.");
  }

  // Contribution CRUD
  function openAddContrib(pensionId: string) {
    setContribPensionId(pensionId);
    setContribForm({ ...EMPTY_CONTRIB, date: new Date().toISOString().slice(0, 10) });
    setContribOpen(true);
  }
  function saveContrib() {
    if (contribForm.amount <= 0) { toast.error("Vyplň sumu príspevku."); return; }
    const entry: PensionContribution = { id: crypto.randomUUID(), pensionId: contribPensionId, ...contribForm };
    const updated = [...contributions, entry];
    savePensionContributions(updated);
    setContributions(updated);
    setContribOpen(false);
    toast.success("Príspevok pridaný.");
  }
  function deleteContrib(id: string) {
    const updated = contributions.filter((c) => c.id !== id);
    savePensionContributions(updated);
    setContributions(updated);
    toast.success("Príspevok odstránený.");
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Celková hodnota (EUR)</p>
              <p className="text-2xl font-bold mt-1 text-indigo-700 dark:text-indigo-400">{fmtEur(totalEur)}</p>
            </CardContent>
          </Card>
          {contributions.length > 0 && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Celkom vložené</p>
                  <p className="text-2xl font-bold mt-1">{fmtEur(contributions.reduce((s, c) => s + c.amount, 0))}</p>
                  <p className="text-xs text-muted-foreground mt-1">{contributions.length} príspevkov</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Zhodnotenie</p>
                  <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                    {fmtEur(totalEur - contributions.reduce((s, c) => s + c.amount, 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {contributions.reduce((s, c) => s + c.amount, 0) > 0
                      ? `${(((totalEur - contributions.reduce((s, c) => s + c.amount, 0)) / contributions.reduce((s, c) => s + c.amount, 0)) * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs defaultValue="pension">
          <div className="overflow-x-auto">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="pension">Fondy</TabsTrigger>
              <TabsTrigger value="contributions">
                Príspevky
                {contributions.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{contributions.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pension" className="mt-4">
            {pension.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadny II. pilier. Klikni na &quot;Pridať&quot;.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {pension.map((p) => {
                  const summary = contribSummary[p.id];
                  return (
                    <Card key={p.id}>
                      <CardContent className="pt-4 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{p.provider}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Aktualizované: {new Date(p.updatedAt).toLocaleDateString("sk-SK")}
                          </p>
                          {summary && summary.count > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {summary.count} príspevkov · spolu {fmt(summary.total, p.currency)}
                              {summary.lastDate && ` · naposledy ${new Date(summary.lastDate).toLocaleDateString("sk-SK")}`}
                            </p>
                          )}
                          {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{fmt(p.value, p.currency)}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" title="Pridať príspevok" onClick={() => openAddContrib(p.id)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contributions" className="mt-4 space-y-4">
            {pension.length > 1 && (
              <Select value={filterPensionId} onValueChange={(v) => setFilterPensionId(v ?? "all")}>
                <SelectTrigger className="w-64">
                  <SelectValue>{filterPensionId === "all" ? "Všetky fondy" : pension.find((p) => p.id === filterPensionId)?.provider ?? "—"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky fondy</SelectItem>
                  {pension.map((p) => <SelectItem key={p.id} value={p.id}>{p.provider}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {yearlyContribs.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {yearlyContribs.map(([year, total]) => (
                  <div key={year} className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{year}: </span>
                    <span className="font-semibold">{fmtEur(total)}</span>
                  </div>
                ))}
              </div>
            )}

            {filteredContribs.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne príspevky. Pridaj ich cez + pri fonde.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredContribs.map((c) => {
                  const p = pension.find((pp) => pp.id === c.pensionId);
                  return (
                    <Card key={c.id}>
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                          <PiggyBank className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{p?.provider ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(c.date).toLocaleDateString("sk-SK")}</p>
                          {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                        </div>
                        <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 shrink-0">+{fmt(c.amount, c.currency)}</p>
                        <Button variant="ghost" size="icon" onClick={() => deleteContrib(c.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Pension dialog */}
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

      {/* Contribution dialog */}
      <Dialog open={contribOpen} onOpenChange={setContribOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pridať príspevok — {pension.find((p) => p.id === contribPensionId)?.provider}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Suma</label>
                <Input type="number" step="0.01" min="0" value={contribForm.amount || ""} onChange={(e) => setContribForm({ ...contribForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mena</label>
                <Select value={contribForm.currency} onValueChange={(v) => setContribForm({ ...contribForm, currency: (v ?? "EUR") as Currency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dátum</label>
              <Input type="date" value={contribForm.date} onChange={(e) => setContribForm({ ...contribForm, date: e.target.value })} />
            </div>
            <Input placeholder="Poznámka (voliteľné)" value={contribForm.note ?? ""} onChange={(e) => setContribForm({ ...contribForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContribOpen(false)}>Zrušiť</Button>
            <Button onClick={saveContrib}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
