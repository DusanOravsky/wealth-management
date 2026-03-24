"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { getDecryptedKey } from "@/context/AppContext";
import { loadInsurance, saveInsurance } from "@/lib/store";
import { fetchInsuranceAlternatives } from "@/lib/claude";
import type { InsuranceAlternative } from "@/lib/claude";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Sparkles, ShieldCheck, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Insurance, Currency } from "@/lib/types";

// Days notice required by Slovak law before anniversary to cancel
const LEGAL_NOTICE_DAYS = 42; // 6 weeks
const WARNING_DAYS = 60;

const TYPE_LABELS: Record<Insurance["type"], string> = {
  car_liability: "PZP (povinné ručenie)",
  car_comprehensive: "Havarijné poistenie",
  property: "Poistenie nehnuteľnosti",
  life: "Životné poistenie",
  health: "Zdravotné / úrazové",
  travel: "Cestovné poistenie",
  other: "Iné",
};

const CURRENCIES = ["EUR", "USD", "CZK", "GBP"] as const;

const EMPTY: Omit<Insurance, "id"> = {
  name: "",
  type: "car_liability",
  provider: "",
  policyNumber: "",
  annualPremium: 0,
  currency: "EUR",
  startDate: "",
  endDate: "",
  autoRenewal: false,
  note: "",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryStatus(ins: Insurance): "expired" | "critical" | "warning" | "ok" {
  const days = daysUntil(ins.endDate);
  if (days < 0) return "expired";
  if (days <= LEGAL_NOTICE_DAYS) return "critical";
  if (days <= WARNING_DAYS) return "warning";
  return "ok";
}

const STATUS_CONFIG = {
  expired: { label: "Expirované", color: "destructive" as const, icon: AlertTriangle, bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" },
  critical: { label: "Kritické — konaj!", color: "destructive" as const, icon: AlertTriangle, bg: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800" },
  warning: { label: "Blíži sa koniec", color: "default" as const, icon: Clock, bg: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800" },
  ok: { label: "Aktívne", color: "secondary" as const, icon: CheckCircle2, bg: "" },
};

export default function InsurancePage() {
  const { pin, settings } = useApp();
  const [policies, setPolicies] = useState<Insurance[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Insurance | null>(null);
  const [form, setForm] = useState<Omit<Insurance, "id">>(EMPTY);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, InsuranceAlternative[]>>({});
  const [aiOpen, setAiOpen] = useState<string | null>(null);

  useEffect(() => {
    setPolicies(loadInsurance());
  }, []);

  const totalAnnual = useMemo(
    () => policies.reduce((sum, p) => sum + (p.currency === "EUR" ? p.annualPremium : p.annualPremium), 0),
    [policies]
  );

  const expiringSoon = useMemo(
    () => policies.filter((p) => ["critical", "warning", "expired"].includes(expiryStatus(p)))
      .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate)),
    [policies]
  );

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(p: Insurance) {
    setEditing(p);
    setForm({ name: p.name, type: p.type, provider: p.provider, policyNumber: p.policyNumber, annualPremium: p.annualPremium, currency: p.currency, startDate: p.startDate, endDate: p.endDate, autoRenewal: p.autoRenewal, note: p.note });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.provider || !form.endDate || form.annualPremium <= 0) {
      toast.error("Vyplň názov, poisťovňu, dátum konca a ročné poistné.");
      return;
    }
    const clean = { ...form, policyNumber: form.policyNumber || undefined, note: form.note || undefined };
    const updated = editing
      ? policies.map((p) => (p.id === editing.id ? { ...clean, id: editing.id } : p))
      : [...policies, { ...clean, id: crypto.randomUUID() }];
    saveInsurance(updated);
    setPolicies(updated);
    setOpen(false);
    toast.success(editing ? "Aktualizované." : "Poistenie pridané.");
  }

  async function handleDelete(id: string) {
    const updated = policies.filter((p) => p.id !== id);
    saveInsurance(updated);
    setPolicies(updated);
    const newAi = { ...aiResults };
    delete newAi[id];
    setAiResults(newAi);
    toast.success("Odstránené.");
  }

  async function handleAI(ins: Insurance) {
    if (!pin || !settings) { toast.error("Najprv sa prihlás."); return; }
    const claudeKey = await getDecryptedKey("claudeKey", pin, settings);
    if (!claudeKey) {
      toast.error("Nastav Claude API kľúč v Nastaveniach.");
      return;
    }
    setAiLoading(ins.id);
    try {
      const alts = await fetchInsuranceAlternatives(ins, claudeKey);
      setAiResults((prev) => ({ ...prev, [ins.id]: alts }));
      setAiOpen(ins.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chyba AI.");
    } finally {
      setAiLoading(null);
    }
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Poistenie</h1>
            <p className="text-muted-foreground text-sm mt-1">Auto, byt, život a iné poistky</p>
          </div>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Ročné poistné celkom</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalAnnual)}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(totalAnnual / 12)} / mesiac</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Počet poistiek</p>
              <p className="text-2xl font-bold mt-1">{policies.length}</p>
            </CardContent>
          </Card>
          <Card className={expiringSoon.length > 0 ? "border-orange-300 dark:border-orange-700" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Vyžadujú pozornosť</p>
              <p className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">{expiringSoon.length}</p>
              <p className="text-xs text-muted-foreground mt-1">v nasledujúcich {WARNING_DAYS} dňoch</p>
            </CardContent>
          </Card>
        </div>

        {/* Expiring soon banner */}
        {expiringSoon.length > 0 && (
          <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="w-4 h-4" />
                Upozornenie na expiráciu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {expiringSoon.map((p) => {
                const days = daysUntil(p.endDate);
                const status = expiryStatus(p);
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className={status === "critical" || status === "expired" ? "text-red-600 dark:text-red-400 font-semibold" : "text-orange-600 dark:text-orange-400"}>
                      {days < 0 ? "Expirované" : days === 0 ? "Dnes!" : `${days} dní`}
                      {status === "critical" && days >= 0 && ` — výpoveď do ${new Date(new Date(p.endDate).getTime() - LEGAL_NOTICE_DAYS * 86400000).toLocaleDateString("sk-SK")}`}
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-1">
                Podľa zákona musíš dať výpoveď aspoň 6 týždňov (42 dní) pred výročným dňom.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Policies list */}
        {policies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne poistky. Pridaj prvú pomocou tlačidla vyššie.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {policies
              .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
              .map((ins) => {
                const days = daysUntil(ins.endDate);
                const status = expiryStatus(ins);
                const cfg = STATUS_CONFIG[status];
                const StatusIcon = cfg.icon;
                return (
                  <Card key={ins.id} className={cfg.bg}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: "rgba(99,102,241,0.12)" }}>
                          <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{ins.name}</span>
                            <Badge variant="outline" className="text-xs">{TYPE_LABELS[ins.type]}</Badge>
                            <Badge variant={cfg.color} className="text-xs flex items-center gap-1">
                              <StatusIcon className="w-3 h-3" />
                              {days < 0 ? "Expirované" : days === 0 ? "Dnes!" : `${days} dní`}
                            </Badge>
                            {ins.autoRenewal && <Badge variant="secondary" className="text-xs">Auto-obnova</Badge>}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span><strong>Poisťovňa:</strong> {ins.provider}</span>
                            <span><strong>Ročné:</strong> {fmt(ins.annualPremium, ins.currency)}</span>
                            <span><strong>Koniec:</strong> {new Date(ins.endDate).toLocaleDateString("sk-SK")}</span>
                            {ins.policyNumber && <span><strong>Č. zmluvy:</strong> {ins.policyNumber}</span>}
                          </div>
                          {ins.note && <p className="text-xs text-muted-foreground mt-1">{ins.note}</p>}
                          {status === "critical" && days >= 0 && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                              Posledný deň výpovede: {new Date(new Date(ins.endDate).getTime() - LEGAL_NOTICE_DAYS * 86400000).toLocaleDateString("sk-SK")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => aiResults[ins.id] ? setAiOpen(ins.id) : handleAI(ins)}
                            disabled={aiLoading === ins.id}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${aiLoading === ins.id ? "animate-pulse" : ""}`} />
                            {aiLoading === ins.id ? "Hľadám..." : "AI alternatívy"}
                          </Button>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(ins)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(ins.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Upraviť poistenie" : "Pridať poistenie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Názov (napr. PZP Škoda Octavia)</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Typ poistenia</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? "other") as Insurance["type"] })}>
                  <SelectTrigger><SelectValue>{TYPE_LABELS[form.type]}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Poisťovňa</label>
                <Input placeholder="napr. Allianz" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ročné poistné</label>
                <Input type="number" step="0.01" min="0" value={form.annualPremium || ""} onChange={(e) => setForm({ ...form, annualPremium: parseFloat(e.target.value) || 0 })} />
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
                <label className="text-xs text-muted-foreground mb-1 block">Začiatok poistenia</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Koniec / výročný deň</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Číslo zmluvy (voliteľné)</label>
                <Input placeholder="napr. POL-123456" value={form.policyNumber ?? ""} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Automatická obnova</label>
                <Select value={form.autoRenewal ? "yes" : "no"} onValueChange={(v) => setForm({ ...form, autoRenewal: (v ?? "no") === "yes" })}>
                  <SelectTrigger><SelectValue>{form.autoRenewal ? "Áno" : "Nie"}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Áno</SelectItem>
                    <SelectItem value="no">Nie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input placeholder="Poznámka (voliteľné)" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSave}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI alternatives dialog */}
      {aiOpen && aiResults[aiOpen] && (
        <Dialog open={!!aiOpen} onOpenChange={() => setAiOpen(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI alternatívy — {policies.find((p) => p.id === aiOpen)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {aiResults[aiOpen].map((alt, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{alt.provider}</p>
                        <p className="text-sm text-muted-foreground">{alt.product}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-sm font-bold">
                        {alt.estimatedAnnualPremium}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Výhody</p>
                        <ul className="space-y-0.5">
                          {alt.pros.map((p, j) => <li key={j} className="text-muted-foreground before:content-['✓_'] before:text-green-500">{p}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-500 mb-1">Nevýhody</p>
                        <ul className="space-y-0.5">
                          {alt.cons.map((c, j) => <li key={j} className="text-muted-foreground before:content-['✗_'] before:text-red-400">{c}</li>)}
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs p-2 rounded-md bg-muted/50 text-muted-foreground">
                      <strong>Tip:</strong> {alt.tip}
                    </p>
                  </CardContent>
                </Card>
              ))}
              <p className="text-xs text-muted-foreground text-center">
                Toto sú odhadované ceny od AI — pred rozhodnutím si overif aktuálne podmienky priamo u poisťovne.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAiOpen(null)}>Zavrieť</Button>
              <Button onClick={() => { setAiOpen(null); handleAI(policies.find((p) => p.id === aiOpen)!); }}>
                <Sparkles className="w-4 h-4 mr-2" />Obnov
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
