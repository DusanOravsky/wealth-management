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
import { Plus, Pencil, Trash2, Home, Building2 } from "lucide-react";
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
  annualRent: undefined,
  loanAmount: undefined,
  loanInterestRate: undefined,
  loanTermYears: undefined,
  loanStartDate: undefined,
};

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function toEur(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return amount / rate;
}

/** Calculate remaining loan balance using amortization formula */
function calcRemainingLoan(loanAmount: number, annualRate: number, termYears: number, startDate: string): number {
  if (annualRate === 0) {
    const totalMonths = termYears * 12;
    const elapsed = monthsElapsed(startDate);
    const remaining = totalMonths - elapsed;
    if (remaining <= 0) return 0;
    return (loanAmount / totalMonths) * remaining;
  }
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  const pmt = (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const elapsed = monthsElapsed(startDate);
  if (elapsed >= n) return 0;
  const remaining = loanAmount * Math.pow(1 + r, elapsed) - pmt * (Math.pow(1 + r, elapsed) - 1) / r;
  return Math.max(0, remaining);
}

function monthlyPayment(loanAmount: number, annualRate: number, termYears: number): number {
  if (annualRate === 0) return loanAmount / (termYears * 12);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function monthsElapsed(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

export default function RealEstatePage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RealEstateHolding | null>(null);
  const [form, setForm] = useState<Omit<RealEstateHolding, "id">>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [showMortgage, setShowMortgage] = useState(false);

  const holdings = portfolio?.realestate ?? [];

  const totalValueEur = holdings.reduce((sum, r) => sum + toEur(r.estimatedValue, r.currency, rates), 0);
  const totalDebtEur = holdings.reduce((sum, r) => {
    if (!r.loanAmount || r.loanInterestRate === undefined || !r.loanTermYears || !r.loanStartDate) return sum;
    return sum + toEur(calcRemainingLoan(r.loanAmount, r.loanInterestRate, r.loanTermYears, r.loanStartDate), r.currency, rates);
  }, 0);
  const totalEquityEur = totalValueEur - totalDebtEur;

  function openAdd() { setEditing(null); setForm(EMPTY); setShowMortgage(false); setOpen(true); }
  function openEdit(r: RealEstateHolding) {
    setEditing(r);
    setForm({
      name: r.name, type: r.type, estimatedValue: r.estimatedValue, currency: r.currency,
      purchasePrice: r.purchasePrice, purchaseYear: r.purchaseYear, area: r.area,
      annualRent: r.annualRent, note: r.note,
      loanAmount: r.loanAmount, loanInterestRate: r.loanInterestRate,
      loanTermYears: r.loanTermYears, loanStartDate: r.loanStartDate,
    });
    setShowMortgage(!!(r.loanAmount));
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || form.estimatedValue <= 0) {
      toast.error("Vyplň názov a odhadovanú hodnotu.");
      return;
    }
    if (!portfolio) return;
    const clean: Omit<RealEstateHolding, "id"> = {
      ...form,
      purchasePrice: form.purchasePrice || undefined,
      purchaseYear: form.purchaseYear || undefined,
      area: form.area || undefined,
      annualRent: form.annualRent || undefined,
      loanAmount: showMortgage ? (form.loanAmount || undefined) : undefined,
      loanInterestRate: showMortgage ? (form.loanInterestRate ?? undefined) : undefined,
      loanTermYears: showMortgage ? (form.loanTermYears || undefined) : undefined,
      loanStartDate: showMortgage ? (form.loanStartDate || undefined) : undefined,
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
    setDeleteConfirm(null);
    toast.success("Odstránené.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Nehnuteľnosti</h1>
            <p className="text-muted-foreground text-sm mt-1">Byty, domy, pozemky a iné nehnuteľnosti</p>
          </div>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Celková hodnota</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{fmt(totalValueEur)}</p>
            </CardContent>
          </Card>
          {totalDebtEur > 0 && (
            <>
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Zostatok úverov</p>
                  <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{fmt(totalDebtEur)}</p>
                  <p className="text-xs text-muted-foreground mt-1">LTV {totalValueEur > 0 ? ((totalDebtEur / totalValueEur) * 100).toFixed(0) : 0}%</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Vlastný kapitál (equity)</p>
                  <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{fmt(totalEquityEur)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{totalValueEur > 0 ? ((totalEquityEur / totalValueEur) * 100).toFixed(0) : 0}% hodnoty</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {holdings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne nehnuteľnosti. Pridaj prvú.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {holdings.map((r) => {
              const valueEur = toEur(r.estimatedValue, r.currency, rates);
              const gainPct = r.purchasePrice && r.purchasePrice > 0
                ? ((r.estimatedValue - r.purchasePrice) / r.purchasePrice) * 100
                : null;
              const currentYear = new Date().getFullYear();
              const yearsHeld = r.purchaseYear ? currentYear - r.purchaseYear : null;
              const rentalYield = r.annualRent && r.estimatedValue > 0
                ? (r.annualRent / r.estimatedValue) * 100
                : null;

              const hasMortgage = r.loanAmount && r.loanInterestRate !== undefined && r.loanTermYears && r.loanStartDate;
              const remainingLoan = hasMortgage
                ? calcRemainingLoan(r.loanAmount!, r.loanInterestRate!, r.loanTermYears!, r.loanStartDate!)
                : 0;
              const remainingLoanEur = toEur(remainingLoan, r.currency, rates);
              const equity = valueEur - remainingLoanEur;
              const ltv = valueEur > 0 ? (remainingLoanEur / valueEur) * 100 : 0;
              const pmt = hasMortgage
                ? monthlyPayment(r.loanAmount!, r.loanInterestRate!, r.loanTermYears!)
                : 0;
              const pmtEur = toEur(pmt, r.currency, rates);

              return (
                <Card key={r.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
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
                          Hodnota: {r.currency} {r.estimatedValue.toLocaleString("sk-SK")}
                          {yearsHeld !== null && ` · držba ${yearsHeld} r.`}
                        </p>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {rentalYield !== null && (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              🏠 nájom {rentalYield.toFixed(1)}% p.a. ({fmt(toEur(r.annualRent!, r.currency, rates))}/rok)
                            </span>
                          )}
                          {gainPct !== null && (
                            <span className={`text-xs ${gainPct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                              📈 {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}% vs. nákup
                            </span>
                          )}
                        </div>
                        {hasMortgage && (
                          <div className="mt-2 p-2 rounded-lg bg-muted/40 text-xs space-y-1">
                            <div className="flex gap-4 flex-wrap">
                              <span className="text-muted-foreground">Zostatok úveru: <strong className="text-red-500">{fmt(remainingLoanEur)}</strong></span>
                              <span className="text-muted-foreground">Equity: <strong className="text-blue-600 dark:text-blue-400">{fmt(equity)}</strong></span>
                              <span className="text-muted-foreground">LTV: <strong>{ltv.toFixed(0)}%</strong></span>
                              <span className="text-muted-foreground">Splátka: <strong>{fmt(pmtEur)}/mes.</strong></span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                              <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, 100 - ltv)}%` }} />
                            </div>
                            <span className="text-muted-foreground">{(100 - ltv).toFixed(0)}% splatené</span>
                          </div>
                        )}
                        {r.note && <p className="text-xs text-muted-foreground mt-1">{r.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{fmt(valueEur)}</p>
                        {hasMortgage && <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{fmt(equity)} equity</p>}
                        {r.annualRent && !hasMortgage && (
                          <p className="text-xs text-green-600">{fmt(toEur(r.annualRent, r.currency, rates))}/rok</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Upraviť nehnuteľnosť" : "Pridať nehnuteľnosť"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov</label>
              <Input placeholder="Byt Bratislava" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Typ</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? "apartment") as RealEstateHolding["type"] })}>
                  <SelectTrigger><SelectValue>{RE_TYPE_LABELS[form.type]}</SelectValue></SelectTrigger>
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
                <Input type="number" step="1000" min="0" value={form.estimatedValue || ""} onChange={(e) => setForm({ ...form, estimatedValue: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Plocha (m², voliteľné)</label>
                <Input type="number" step="1" min="0" placeholder="napr. 65" value={form.area ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setForm({ ...form, area: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nákupná cena (voliteľné)</label>
                <Input type="number" step="1000" min="0" value={form.purchasePrice ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setForm({ ...form, purchasePrice: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rok nákupu (voliteľné)</label>
                <Input type="number" min="1950" max={new Date().getFullYear()} placeholder="napr. 2020" value={form.purchaseYear ?? ""} onChange={(e) => { const v = parseInt(e.target.value); setForm({ ...form, purchaseYear: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ročný príjem z nájmu (voliteľné)</label>
              <Input type="number" step="100" min="0" placeholder="napr. 6000" value={form.annualRent ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setForm({ ...form, annualRent: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
            </div>

            {/* Mortgage section */}
            <div>
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                onClick={() => setShowMortgage((v) => !v)}
              >
                <Building2 className="w-4 h-4" />
                {showMortgage ? "▾ Skryť hypotéku / úver" : "▸ Pridať hypotéku / úver"}
              </button>
            </div>
            {showMortgage && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Polia hypotéky slúžia na výpočet zostatku, equity a mesačnej splátky.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Výška úveru</label>
                    <Input type="number" step="1000" min="0" placeholder="napr. 120000" value={form.loanAmount ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setForm({ ...form, loanAmount: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Úroková sadzba (% p.a.)</label>
                    <Input type="number" step="0.1" min="0" max="20" placeholder="napr. 3.5" value={form.loanInterestRate ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setForm({ ...form, loanInterestRate: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Splatnosť (roky)</label>
                    <Input type="number" step="1" min="1" max="40" placeholder="napr. 30" value={form.loanTermYears ?? ""} onChange={(e) => { const v = parseInt(e.target.value); setForm({ ...form, loanTermYears: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Dátum poskytnutia</label>
                    <Input type="date" value={form.loanStartDate ?? ""} onChange={(e) => setForm({ ...form, loanStartDate: e.target.value || undefined })} />
                  </div>
                </div>
                {form.loanAmount && form.loanInterestRate !== undefined && form.loanTermYears && form.loanStartDate && (
                  <div className="text-xs text-muted-foreground bg-background rounded p-2 space-y-0.5">
                    <p>Mesačná splátka: <strong>{fmt(toEur(monthlyPayment(form.loanAmount, form.loanInterestRate, form.loanTermYears), form.currency, rates))}</strong></p>
                    <p>Zostatok dnes: <strong>{fmt(toEur(calcRemainingLoan(form.loanAmount, form.loanInterestRate, form.loanTermYears, form.loanStartDate), form.currency, rates))}</strong></p>
                    <p>Equity: <strong>{fmt(toEur(form.estimatedValue - calcRemainingLoan(form.loanAmount, form.loanInterestRate, form.loanTermYears, form.loanStartDate), form.currency, rates))}</strong></p>
                  </div>
                )}
              </div>
            )}
            <Input placeholder="Poznámka (voliteľné)" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSave}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať nehnuteľnosť?</DialogTitle></DialogHeader>
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
