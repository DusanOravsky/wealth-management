"use client";

import { useState, useRef, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw, Upload, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { loadCryptoTransactions, saveCryptoTransactions } from "@/lib/store";
import type { CryptoHolding, CryptoTransaction, Currency } from "@/lib/types";
import { FALLBACK_RATES } from "@/lib/constants";
import { fetchBinanceBalances } from "@/lib/binance";
import { getDecryptedKey } from "@/context/AppContext";

const EMPTY: Omit<CryptoHolding, "id"> = { coinId: "", symbol: "", name: "", amount: 0, exchange: "binance", purchasePrice: undefined, purchaseCurrency: "EUR" };

function toEur(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return amount / rate;
}

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function CryptoPage() {
  const { portfolio, savePortfolio, cryptoPrices, pricesLoading, refreshPrices, pin, settings, rates } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CryptoHolding | null>(null);
  const [form, setForm] = useState<Omit<CryptoHolding, "id">>(EMPTY);
  const [binanceLoading, setBinanceLoading] = useState(false);

  const csvRef = useRef<HTMLInputElement>(null);
  const holdings = portfolio?.crypto ?? [];
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const [txs, setTxs] = useState<CryptoTransaction[]>(() => loadCryptoTransactions());
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState<Omit<CryptoTransaction, "id">>({
    coinId: "", symbol: "", type: "buy", amount: 0, pricePerCoin: 0, totalEur: 0,
    date: new Date().toISOString().slice(0, 10),
  });
  const [txSearch, setTxSearch] = useState("");
  const [holdingSearch, setHoldingSearch] = useState("");

  // DCA: average purchase price per coinId from transactions
  const dcaMap = useMemo(() => {
    const map: Record<string, { avgPrice: number; totalAmount: number; totalCost: number }> = {};
    txs.filter((t) => t.type === "buy").forEach((t) => {
      const existing = map[t.coinId];
      if (!existing) {
        map[t.coinId] = { avgPrice: t.pricePerCoin, totalAmount: t.amount, totalCost: t.totalEur };
      } else {
        const newAmount = existing.totalAmount + t.amount;
        const newCost = existing.totalCost + t.totalEur;
        map[t.coinId] = { avgPrice: newAmount > 0 ? newCost / newAmount : 0, totalAmount: newAmount, totalCost: newCost };
      }
    });
    return map;
  }, [txs]);

  const filteredTxs = useMemo(() => {
    return [...txs]
      .filter((t) => !txSearch || t.symbol.toLowerCase().includes(txSearch.toLowerCase()) || t.coinId.toLowerCase().includes(txSearch.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [txs, txSearch]);

  const totalEur = holdings.reduce((sum, h) => {
    const price = cryptoPrices.find((p) => p.symbol === h.symbol.toUpperCase());
    return sum + (price ? price.current_price * h.amount : 0);
  }, 0);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(h: CryptoHolding) {
    setEditing(h);
    setForm({ coinId: h.coinId, symbol: h.symbol, name: h.name, amount: h.amount, exchange: h.exchange, note: h.note, purchasePrice: h.purchasePrice, purchaseCurrency: h.purchaseCurrency ?? "EUR" });
    setOpen(true);
  }

  const totalCostEur = holdings.reduce((sum, h) => {
    if (!h.purchasePrice) return sum;
    return sum + toEur(h.purchasePrice * h.amount, h.purchaseCurrency ?? "EUR", rates);
  }, 0);
  const totalGainEur = totalCostEur > 0 ? totalEur - totalCostEur : null;
  const totalGainPct = totalCostEur > 0 && totalGainEur != null ? (totalGainEur / totalCostEur) * 100 : null;

  async function handleSave() {
    if (!form.coinId || !form.symbol || form.amount <= 0) {
      toast.error("Vyplň CoinGecko ID, symbol a množstvo.");
      return;
    }
    if (!portfolio) return;
    const updated = editing
      ? holdings.map((h) => (h.id === editing.id ? { ...form, id: editing.id } : h))
      : [...holdings, { ...form, id: crypto.randomUUID() }];
    await savePortfolio({ ...portfolio, crypto: updated });
    setOpen(false);
    toast.success(editing ? "Aktualizované." : "Krypto pridané.");
  }

  async function handleDelete(id: string) {
    if (!portfolio) return;
    await savePortfolio({ ...portfolio, crypto: holdings.filter((h) => h.id !== id) });
    setDeleteConfirm(null);
    toast.success("Odstránené.");
  }

  function openAddTx(h?: CryptoHolding) {
    setTxForm({
      coinId: h?.coinId ?? "", symbol: h?.symbol ?? "", type: "buy",
      amount: 0, pricePerCoin: 0, totalEur: 0,
      date: new Date().toISOString().slice(0, 10),
    });
    setTxOpen(true);
  }
  function saveTx() {
    if (!txForm.coinId || !txForm.symbol || txForm.amount <= 0 || txForm.pricePerCoin <= 0) {
      toast.error("Vyplň symbol, množstvo a cenu."); return;
    }
    const entry: CryptoTransaction = {
      id: crypto.randomUUID(),
      ...txForm,
      totalEur: txForm.amount * txForm.pricePerCoin,
    };
    const updated = [...txs, entry];
    saveCryptoTransactions(updated);
    setTxs(updated);
    setTxOpen(false);
    toast.success("Transakcia pridaná.");
  }
  function deleteTx(id: string) {
    const updated = txs.filter((t) => t.id !== id);
    saveCryptoTransactions(updated);
    setTxs(updated);
  }

  async function importFromBinance() {
    if (!pin || !settings) { toast.error("Najprv sa prihlás."); return; }
    const apiKey = await getDecryptedKey("binanceKey", pin, settings);
    const apiSecret = await getDecryptedKey("binanceSecret", pin, settings);
    if (!apiKey || !apiSecret) {
      toast.error("Nastav Binance API kľúče v Nastaveniach.");
      return;
    }
    setBinanceLoading(true);
    try {
      const balances = await fetchBinanceBalances(apiKey, apiSecret);
      if (!portfolio) return;
      // Convert Binance balances to holdings — map symbol to CoinGecko ID and full name
      const SYMBOL_TO_ID: Record<string, string> = {
        BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana",
        ADA: "cardano", DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink",
        XRP: "ripple", DOGE: "dogecoin", AVAX: "avalanche-2", UNI: "uniswap",
      };
      const SYMBOL_TO_NAME: Record<string, string> = {
        BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana",
        ADA: "Cardano", DOT: "Polkadot", MATIC: "Polygon", LINK: "Chainlink",
        XRP: "XRP", DOGE: "Dogecoin", AVAX: "Avalanche", UNI: "Uniswap",
      };
      const newHoldings: CryptoHolding[] = balances
        .filter((b) => SYMBOL_TO_ID[b.asset])
        .map((b) => ({
          id: crypto.randomUUID(),
          coinId: SYMBOL_TO_ID[b.asset],
          symbol: b.asset,
          name: SYMBOL_TO_NAME[b.asset] ?? b.asset,
          amount: b.total,
          exchange: "binance" as const,
        }));
      // Merge: replace existing binance holdings, keep others
      const nonBinance = holdings.filter((h) => h.exchange !== "binance");
      await savePortfolio({ ...portfolio, crypto: [...nonBinance, ...newHoldings] });
      await refreshPrices();
      toast.success(`Importovaných ${newHoldings.length} koin zo Binance.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chyba pri importe z Binance.";
      // Binance REST API blocks browser CORS requests — this is expected
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("CORS")) {
        toast.error("Binance API blokuje CORS požiadavky z prehliadača. Pridaj holdings manuálne alebo použij CORS Unblock rozšírenie.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBinanceLoading(false);
    }
  }

  // Import holdings from CoinGecko portfolio CSV export
  // Expected columns: Name, Symbol, Quantity (other columns ignored)
  async function importFromCoinGeckoCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !portfolio) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) { toast.error("CSV je prázdne."); return; }
      const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const nameIdx = header.findIndex((h) => h === "name" || h === "coin");
      const symbolIdx = header.findIndex((h) => h === "symbol");
      const qtyIdx = header.findIndex((h) => h === "quantity" || h === "holdings" || h === "amount");
      if (symbolIdx === -1 || qtyIdx === -1) {
        toast.error("CSV neobsahuje stĺpce Symbol a Quantity. Exportuj portfólio z CoinGecko.");
        return;
      }
      const newHoldings: CryptoHolding[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const symbol = (cols[symbolIdx] ?? "").toUpperCase();
        const qty = parseFloat(cols[qtyIdx] ?? "0");
        const name = nameIdx >= 0 ? (cols[nameIdx] ?? symbol) : symbol;
        if (!symbol || isNaN(qty) || qty <= 0) continue;
        newHoldings.push({
          id: crypto.randomUUID(),
          coinId: name.toLowerCase().replace(/\s+/g, "-"),
          symbol,
          name,
          amount: qty,
          exchange: "other",
        });
      }
      if (newHoldings.length === 0) { toast.error("Žiadne platné riadky v CSV."); return; }
      // Replace existing holdings with same symbol, keep others
      const existingSymbols = new Set(newHoldings.map((h) => h.symbol));
      const kept = holdings.filter((h) => !existingSymbols.has(h.symbol.toUpperCase()));
      await savePortfolio({ ...portfolio, crypto: [...kept, ...newHoldings] });
      await refreshPrices();
      toast.success(`Importovaných ${newHoldings.length} koin z CoinGecko.`);
    } catch {
      toast.error("Chyba pri čítaní CSV súboru.");
    }
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Krypto</h1>
            <p className="text-muted-foreground text-sm mt-1">Ceny cez CoinCap · Import z Binance a CoinGecko</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Import CoinGecko
            </Button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={importFromCoinGeckoCSV} />
            <Button variant="outline" size="sm" onClick={importFromBinance} disabled={binanceLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${binanceLoading ? "animate-spin" : ""}`} />
              Import Binance
            </Button>
            <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 sm:col-span-1">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Celková hodnota (EUR)</p>
              <p className="text-3xl font-bold mt-1 text-orange-700 dark:text-orange-400">{fmt(totalEur)}</p>
            </CardContent>
          </Card>
          {totalCostEur > 0 && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Investované</p>
                  <p className="text-xl font-bold mt-1">{fmt(totalCostEur)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Zisk / Strata</p>
                  <p className={`text-xl font-bold mt-1 ${(totalGainEur ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {totalGainEur != null ? `${totalGainEur >= 0 ? "+" : ""}${fmt(totalGainEur)}` : "—"}
                  </p>
                  {totalGainPct != null && (
                    <p className={`text-xs mt-0.5 ${totalGainPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(1)}%
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Live market prices */}
        {cryptoPrices.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Trhové ceny</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cryptoPrices.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{p.symbol.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{p.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{fmt(p.current_price)}</p>
                      <p className={`text-xs ${p.price_change_percentage_24h >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {fmtPct(p.price_change_percentage_24h)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="holdings">
          <TabsList>
            <TabsTrigger value="holdings">Pozície</TabsTrigger>
            <TabsTrigger value="history">
              História
              {txs.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{txs.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Holdings tab */}
          <TabsContent value="holdings" className="mt-4">
            {holdings.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadne krypto. Pridaj manuálne alebo importuj z Binance.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {holdings.length > 4 && (
                  <Input
                    placeholder="Hľadaj krypto..."
                    value={holdingSearch}
                    onChange={(e) => setHoldingSearch(e.target.value)}
                    className="mb-2"
                  />
                )}
                {holdings.filter((h) => !holdingSearch || h.name.toLowerCase().includes(holdingSearch.toLowerCase()) || h.symbol.toLowerCase().includes(holdingSearch.toLowerCase())).map((h) => {
                  const price = cryptoPrices.find((p) => p.symbol === h.symbol.toUpperCase());
                  const valueEur = price ? price.current_price * h.amount : 0;
                  const change = price?.price_change_percentage_24h ?? 0;
                  const costEur = h.purchasePrice ? toEur(h.purchasePrice * h.amount, h.purchaseCurrency ?? "EUR", rates) : null;
                  const gainEur = costEur != null && valueEur > 0 ? valueEur - costEur : null;
                  const gainPct = costEur != null && costEur > 0 && gainEur != null ? (gainEur / costEur) * 100 : null;
                  const dca = dcaMap[h.coinId];
                  return (
                    <Card key={h.id}>
                      <CardContent className="pt-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{h.name}</span>
                            <Badge variant="outline">{h.symbol.toUpperCase()}</Badge>
                            <Badge variant="secondary" className="text-xs">{h.exchange}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {h.amount} {h.symbol.toUpperCase()}
                            {price && ` · ${fmt(price.current_price)}/ks`}
                          </p>
                          {dca && price && dca.avgPrice > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              DCA: {fmt(dca.avgPrice)}/ks
                              {price.current_price > dca.avgPrice
                                ? <span className="text-green-600 ml-1">+{(((price.current_price - dca.avgPrice) / dca.avgPrice) * 100).toFixed(1)}% vs. DCA</span>
                                : <span className="text-red-500 ml-1">{(((price.current_price - dca.avgPrice) / dca.avgPrice) * 100).toFixed(1)}% vs. DCA</span>}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{valueEur > 0 ? fmt(valueEur) : "—"}</p>
                          {price && (
                            <p className={`text-xs flex items-center justify-end gap-1 ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {fmtPct(change)} 24h
                            </p>
                          )}
                          {gainEur != null && (
                            <p className={`text-xs mt-0.5 ${gainEur >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {gainEur >= 0 ? "+" : ""}{fmt(gainEur)} ({gainPct != null ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : ""})
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" title="Pridať transakciu" onClick={() => openAddTx(h)}><Plus className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ id: h.id, name: `${h.name} (${h.symbol.toUpperCase()})` })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History tab */}
          <TabsContent value="history" className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input placeholder="Hľadaj symbol..." value={txSearch} onChange={(e) => setTxSearch(e.target.value)} className="max-w-xs" />
              <Button size="sm" onClick={() => openAddTx()}><Plus className="w-4 h-4 mr-1" />Pridať</Button>
            </div>
            {filteredTxs.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Žiadne transakcie. Pridaj nákupy/predaje pre sledovanie DCA.</CardContent></Card>
            ) : (
              filteredTxs.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-3 pb-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "buy" || t.type === "transfer_in" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                      {t.type === "buy" || t.type === "transfer_in"
                        ? <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                        : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{t.symbol.toUpperCase()}</p>
                        <Badge variant="outline" className="text-xs">{t.type === "buy" ? "Nákup" : t.type === "sell" ? "Predaj" : t.type === "transfer_in" ? "Príjem" : "Odchod"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.amount} ks · {fmt(t.pricePerCoin)}/ks · {new Date(t.date).toLocaleDateString("sk-SK")}
                        {t.fee ? ` · poplatok ${fmt(t.fee)}` : ""}
                      </p>
                      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                    </div>
                    <p className={`font-bold text-sm shrink-0 ${t.type === "buy" || t.type === "transfer_in" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                      {t.type === "buy" || t.type === "transfer_in" ? "-" : "+"}{fmt(t.totalEur)}
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => deleteTx(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Upraviť krypto" : "Pridať krypto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CoinGecko ID (napr. bitcoin, ethereum)</label>
              <Input placeholder="bitcoin" value={form.coinId} onChange={(e) => setForm({ ...form, coinId: e.target.value.toLowerCase() })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Symbol (napr. BTC)</label>
                <Input placeholder="BTC" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Názov</label>
                <Input placeholder="Bitcoin" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Množstvo</label>
                <Input type="number" step="0.00000001" min="0" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Burza</label>
                <Select value={form.exchange} onValueChange={(v) => setForm({ ...form, exchange: (v ?? "binance") as CryptoHolding["exchange"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="binance">Binance</SelectItem>
                    <SelectItem value="other">Iná</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nákupná cena/ks (voliteľné)</label>
                <Input type="number" step="0.01" min="0" placeholder="napr. 45000"
                  value={form.purchasePrice ?? ""}
                  onChange={(e) => { const v = parseFloat(e.target.value); setForm({ ...form, purchasePrice: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mena nákupu</label>
                <Select value={form.purchaseCurrency ?? "EUR"} onValueChange={(v) => setForm({ ...form, purchaseCurrency: (v ?? "EUR") as Currency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["EUR", "USD", "CZK", "GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

      {/* Transaction dialog */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pridať krypto transakciu</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex rounded-lg overflow-hidden border">
              {(["buy", "sell", "transfer_in", "transfer_out"] as const).map((type) => (
                <button key={type} className={`flex-1 py-2 text-xs font-medium transition-colors ${txForm.type === type ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setTxForm({ ...txForm, type })}>
                  {type === "buy" ? "Nákup" : type === "sell" ? "Predaj" : type === "transfer_in" ? "Príjem" : "Odchod"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Symbol (napr. BTC)</label>
                <Input placeholder="BTC" value={txForm.symbol} onChange={(e) => setTxForm({ ...txForm, symbol: e.target.value.toUpperCase(), coinId: e.target.value.toLowerCase() })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum</label>
                <Input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Množstvo</label>
                <Input type="number" step="0.00000001" min="0" value={txForm.amount || ""} onChange={(e) => setTxForm({ ...txForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cena/ks (EUR)</label>
                <Input type="number" step="0.01" min="0" value={txForm.pricePerCoin || ""} onChange={(e) => setTxForm({ ...txForm, pricePerCoin: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Poplatok EUR (voliteľné)</label>
              <Input type="number" step="0.01" min="0" value={txForm.fee ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); setTxForm({ ...txForm, fee: isNaN(v) || e.target.value === "" ? undefined : v }); }} />
            </div>
            {txForm.amount > 0 && txForm.pricePerCoin > 0 && (
              <p className="text-sm text-muted-foreground">Celkom: <strong>{fmt(txForm.amount * txForm.pricePerCoin)}</strong></p>
            )}
            <Input placeholder="Poznámka (voliteľné)" value={txForm.note ?? ""} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>Zrušiť</Button>
            <Button onClick={saveTx}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať krypto?</DialogTitle></DialogHeader>
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
