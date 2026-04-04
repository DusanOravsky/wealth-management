"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  loadBankTransactions, saveBankTransactions,
} from "@/lib/store";
import type { BankAccount, BankTransaction, Currency } from "@/lib/types";
import { CURRENCIES, FALLBACK_RATES } from "@/lib/constants";

const EMPTY_ACCOUNT: Omit<BankAccount, "id"> = { bank: "", name: "", iban: "", balance: 0, currency: "EUR" };
const EMPTY_TX: Omit<BankTransaction, "id" | "accountId"> = {
  date: new Date().toISOString().slice(0, 10),
  amount: 0,
  type: "debit",
  description: "",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}
function fmtEur(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function BankPage() {
  const { portfolio, savePortfolio, rates } = useApp();
  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<Omit<BankAccount, "id">>(EMPTY_ACCOUNT);

  const [transactions, setTransactions] = useState<BankTransaction[]>(() => loadBankTransactions());
  const [txOpen, setTxOpen] = useState(false);
  const [txAccountId, setTxAccountId] = useState<string>("");
  const [txForm, setTxForm] = useState<Omit<BankTransaction, "id" | "accountId">>(EMPTY_TX);
  const [filterAccountId, setFilterAccountId] = useState<string>("all");
  const [txSearch, setTxSearch] = useState("");

  const accounts = portfolio?.bankAccounts ?? [];

  const totalEur = accounts.reduce((sum, a) => {
    const rate = rates[a.currency] ?? FALLBACK_RATES[a.currency] ?? 1;
    return sum + a.balance / rate;
  }, 0);

  // Per-account transaction totals
  const txSummary = useMemo(() => {
    return accounts.reduce<Record<string, { credits: number; debits: number; count: number }>>((acc, a) => {
      const txs = transactions.filter((t) => t.accountId === a.id);
      acc[a.id] = {
        credits: txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0),
        debits: txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0),
        count: txs.length,
      };
      return acc;
    }, {});
  }, [transactions, accounts]);

  const filteredTxs = useMemo(() => {
    return [...transactions]
      .filter((t) => filterAccountId === "all" || t.accountId === filterAccountId)
      .filter((t) => !txSearch || t.description.toLowerCase().includes(txSearch.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterAccountId, txSearch]);

  // Account CRUD
  function openAdd() { setEditing(null); setForm(EMPTY_ACCOUNT); setAccountOpen(true); }
  function openEdit(a: BankAccount) {
    setEditing(a);
    setForm({ bank: a.bank, name: a.name, iban: a.iban, balance: a.balance, currency: a.currency, note: a.note });
    setAccountOpen(true);
  }
  async function handleSave() {
    if (!form.bank || !form.name) { toast.error("Vyplň banku a názov účtu."); return; }
    if (!portfolio) return;
    const updated = editing
      ? accounts.map((a) => (a.id === editing.id ? { ...form, id: editing.id } : a))
      : [...accounts, { ...form, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, bankAccounts: updated });
    setAccountOpen(false);
    toast.success(editing ? "Účet aktualizovaný." : "Účet pridaný.");
  }
  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, bankAccounts: accounts.filter((a) => a.id !== id) });
    const updatedTx = transactions.filter((t) => t.accountId !== id);
    saveBankTransactions(updatedTx);
    setTransactions(updatedTx);
    toast.success("Účet odstránený.");
  }

  // Transaction CRUD
  function openAddTx(accountId: string) {
    setTxAccountId(accountId);
    setTxForm({ ...EMPTY_TX, date: new Date().toISOString().slice(0, 10) });
    setTxOpen(true);
  }
  function saveTx() {
    if (!txForm.description || txForm.amount <= 0) { toast.error("Vyplň popis a sumu."); return; }
    const entry: BankTransaction = { id: crypto.randomUUID(), accountId: txAccountId, ...txForm };
    const updated = [...transactions, entry];
    saveBankTransactions(updated);
    setTransactions(updated);
    setTxOpen(false);
    toast.success("Transakcia pridaná.");
  }
  function deleteTx(id: string) {
    const updated = transactions.filter((t) => t.id !== id);
    saveBankTransactions(updated);
    setTransactions(updated);
    toast.success("Transakcia odstránená.");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bankové účty</h1>
            <p className="text-muted-foreground text-sm mt-1">Evidencia zostatkov a pohybov</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-2" />Pridať</Button>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celkový zostatok (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-blue-700 dark:text-blue-400">{fmtEur(totalEur)}</p>
            <p className="text-xs text-muted-foreground mt-1">{accounts.length} {accounts.length === 1 ? "účet" : accounts.length < 5 ? "účty" : "účtov"}</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts">Účty</TabsTrigger>
            <TabsTrigger value="transactions">
              Transakcie
              {transactions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{transactions.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Accounts tab */}
          <TabsContent value="accounts" className="mt-4">
            {accounts.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadne účty. Klikni na &quot;Pridať&quot;.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {accounts.map((a) => {
                  const rate = rates[a.currency] ?? FALLBACK_RATES[a.currency] ?? 1;
                  const balanceEur = a.balance / rate;
                  const summary = txSummary[a.id];
                  return (
                    <Card key={a.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{a.bank}</p>
                              <span className="text-muted-foreground text-sm">—</span>
                              <p className="text-sm">{a.name}</p>
                            </div>
                            {a.iban && <p className="text-xs text-muted-foreground font-mono mt-1">{a.iban}</p>}
                            {summary && summary.count > 0 && (
                              <div className="flex gap-3 mt-1 text-xs">
                                <span className="text-green-600 dark:text-green-400">+{fmt(summary.credits, a.currency)} príjem</span>
                                <span className="text-red-500">-{fmt(summary.debits, a.currency)} výdaj</span>
                                <span className="text-muted-foreground">{summary.count} transakcií</span>
                              </div>
                            )}
                            {a.note && <p className="text-xs text-muted-foreground mt-1">{a.note}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-lg">{fmt(a.balance, a.currency)}</p>
                            {a.currency !== "EUR" && <p className="text-xs text-muted-foreground">{fmtEur(balanceEur)}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" title="Pridať transakciu" onClick={() => openAddTx(a.id)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Transactions tab */}
          <TabsContent value="transactions" className="mt-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Hľadaj transakciu..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={filterAccountId} onValueChange={(v) => setFilterAccountId(v ?? "all")}>
                <SelectTrigger className="w-52">
                  <SelectValue>
                    {filterAccountId === "all" ? "Všetky účty" : accounts.find((a) => a.id === filterAccountId)?.name ?? "—"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky účty</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {filteredTxs.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Žiadne transakcie. Pridaj ich cez tlačidlo + pri účte.
                </CardContent>
              </Card>
            ) : (
              filteredTxs.map((t) => {
                const account = accounts.find((a) => a.id === t.accountId);
                return (
                  <Card key={t.id}>
                    <CardContent className="pt-3 pb-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "credit" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                        {t.type === "credit"
                          ? <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                          : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {account ? `${account.bank} — ${account.name}` : "—"} · {new Date(t.date).toLocaleDateString("sk-SK")}
                        </p>
                        {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                      </div>
                      <p className={`font-bold text-sm shrink-0 ${t.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                        {t.type === "credit" ? "+" : "-"}{fmt(t.amount, account?.currency ?? "EUR")}
                      </p>
                      <Button variant="ghost" size="icon" onClick={() => deleteTx(t.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Account dialog */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Upraviť účet" : "Pridať bankový účet"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Banka (napr. Tatra banka)" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
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
            <Button variant="outline" onClick={() => setAccountOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSave}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction dialog */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pridať transakciu — {accounts.find((a) => a.id === txAccountId)?.bank} {accounts.find((a) => a.id === txAccountId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex rounded-lg overflow-hidden border">
              <button className={`flex-1 py-2 text-sm font-medium transition-colors ${txForm.type === "debit" ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setTxForm({ ...txForm, type: "debit" })}>
                Výdaj (−)
              </button>
              <button className={`flex-1 py-2 text-sm font-medium transition-colors ${txForm.type === "credit" ? "bg-green-600 text-white" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setTxForm({ ...txForm, type: "credit" })}>
                Príjem (+)
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Popis</label>
              <Input placeholder="napr. Výplata, Nájomné..." value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Suma</label>
                <Input type="number" step="0.01" min="0" value={txForm.amount || ""} onChange={(e) => setTxForm({ ...txForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum</label>
                <Input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
              </div>
            </div>
            <Input placeholder="Poznámka (voliteľné)" value={txForm.note ?? ""} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>Zrušiť</Button>
            <Button onClick={saveTx}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
