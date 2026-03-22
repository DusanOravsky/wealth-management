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
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { CryptoHolding } from "@/lib/types";
import { fetchBinanceBalances } from "@/lib/binance";
import { getDecryptedKey } from "@/context/AppContext";

const EMPTY: Omit<CryptoHolding, "id"> = { coinId: "", symbol: "", name: "", amount: 0, exchange: "binance" };

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function CryptoPage() {
  const { portfolio, savePortfolio, cryptoPrices, pricesLoading, refreshPrices, pin, settings } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CryptoHolding | null>(null);
  const [form, setForm] = useState<Omit<CryptoHolding, "id">>(EMPTY);
  const [binanceLoading, setBinanceLoading] = useState(false);

  const holdings = portfolio?.crypto ?? [];

  const totalEur = holdings.reduce((sum, h) => {
    const price = cryptoPrices.find((p) => p.id === h.coinId);
    return sum + (price ? price.current_price * h.amount : 0);
  }, 0);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(h: CryptoHolding) {
    setEditing(h);
    setForm({ coinId: h.coinId, symbol: h.symbol, name: h.name, amount: h.amount, exchange: h.exchange, note: h.note });
    setOpen(true);
  }

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
    toast.success("Odstránené.");
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

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Krypto</h1>
            <p className="text-muted-foreground text-sm mt-1">Kryptomeny cez CoinGecko a Binance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={importFromBinance} disabled={binanceLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${binanceLoading ? "animate-spin" : ""}`} />
              Import Binance
            </Button>
            <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Pridať</Button>
          </div>
        </div>

        <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Celková hodnota (EUR)</p>
            <p className="text-3xl font-bold mt-1 text-orange-700 dark:text-orange-400">{fmt(totalEur)}</p>
          </CardContent>
        </Card>

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

        {/* Holdings */}
        {holdings.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Žiadne krypto. Pridaj manuálne alebo importuj z Binance.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {holdings.map((h) => {
              const price = cryptoPrices.find((p) => p.id === h.coinId);
              const valueEur = price ? price.current_price * h.amount : 0;
              const change = price?.price_change_percentage_24h ?? 0;
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
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{valueEur > 0 ? fmt(valueEur) : "—"}</p>
                      {price && (
                        <p className={`text-xs flex items-center justify-end gap-1 ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmtPct(change)} 24h
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(h.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
