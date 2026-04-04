"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { loadAlerts, saveAlerts } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Bell, BellOff, RefreshCw, History } from "lucide-react";
import { toast } from "sonner";
import type { PriceAlert, AlertHistoryEntry } from "@/lib/types";
import { loadAlertHistory } from "@/lib/store";

const EMPTY_FORM = {
  assetType: "gold" as PriceAlert["assetType"],
  coinId: "",
  ticker: "",
  label: "Zlato",
  condition: "above" as PriceAlert["condition"],
  targetPrice: 0,
};

function fmt(n: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export default function AlertsPage() {
  const { goldPrice, silverPrice, platinumPrice, palladiumPrice, cryptoPrices, stockPrices, rates } = useApp();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setAlerts(loadAlerts());
    setAlertHistory(loadAlertHistory());
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) {
      toast.error("Tento prehliadač nepodporuje notifikácie.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") toast.success("Notifikácie povolené.");
    else toast.error("Notifikácie zamietnuté — skontroluj nastavenia prehliadača.");
  }

  function handleAssetTypeChange(type: PriceAlert["assetType"]) {
    const defaults: Record<PriceAlert["assetType"], { label: string; coinId: string; ticker: string }> = {
      gold:      { label: "Zlato (XAU)",      coinId: "", ticker: "" },
      silver:    { label: "Striebro (XAG)",   coinId: "", ticker: "" },
      platinum:  { label: "Platina (XPT)",    coinId: "", ticker: "" },
      palladium: { label: "Paládium (XPD)",   coinId: "", ticker: "" },
      stock:     { label: "",                 coinId: "", ticker: "" },
      crypto:    { label: "",                 coinId: "", ticker: "" },
    };
    setForm({ ...form, assetType: type, ...defaults[type] });
  }

  function handleCoinSelect(coinId: string | null) {
    const id = coinId ?? "";
    const coin = cryptoPrices.find((p) => p.id === id);
    setForm({ ...form, coinId: id, label: coin ? `${coin.name} (${coin.symbol})` : id });
  }

  function currentPrice(type: PriceAlert["assetType"], coinId?: string, ticker?: string): number {
    if (type === "gold") return goldPrice;
    if (type === "silver") return silverPrice;
    if (type === "platinum") return platinumPrice;
    if (type === "palladium") return palladiumPrice;
    if (type === "crypto" && coinId) return cryptoPrices.find((p) => p.id === coinId)?.current_price ?? 0;
    if (type === "stock" && ticker) {
      const usd = stockPrices[ticker.toUpperCase()];
      return usd ? usd / (rates["USD"] ?? 1.09) : 0;
    }
    return 0;
  }

  function handleAdd() {
    if (form.targetPrice <= 0) { toast.error("Zadaj cieľovú cenu."); return; }
    if (form.assetType === "crypto" && !form.coinId) { toast.error("Vyber kryptomenu."); return; }
    if (form.assetType === "stock" && !form.ticker) { toast.error("Zadaj ticker akcie."); return; }
    const alert: PriceAlert = {
      id: crypto.randomUUID(),
      assetType: form.assetType,
      coinId: form.coinId || undefined,
      ticker: form.ticker || undefined,
      label: form.label || form.ticker || form.coinId,
      condition: form.condition,
      targetPrice: form.targetPrice,
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...alerts, alert];
    saveAlerts(updated);
    setAlerts(updated);
    setOpen(false);
    setForm(EMPTY_FORM);
    toast.success("Alert pridaný.");
  }

  function handleDelete(id: string) {
    const updated = alerts.filter((a) => a.id !== id);
    saveAlerts(updated);
    setAlerts(updated);
    toast.success("Alert odstránený.");
  }

  function handleReset(id: string) {
    const updated = alerts.map((a) => a.id === id ? { ...a, triggered: false } : a);
    saveAlerts(updated);
    setAlerts(updated);
    toast.success("Alert resetovaný.");
  }

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cenové alerty</h1>
            <p className="text-muted-foreground text-sm mt-1">Notifikácia keď cena dosiahne zadanú hranicu</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Pridať alert</Button>
        </div>

        {/* Notification permission banner */}
        {notifPerm !== "granted" && (
          <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950">
            <CardContent className="pt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BellOff className="w-5 h-5 text-yellow-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Notifikácie nie sú povolené</p>
                  <p className="text-xs text-muted-foreground">Povol notifikácie aby si dostával upozornenia.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={requestPermission}>Povoliť</Button>
            </CardContent>
          </Card>
        )}

        {/* Live prices reference */}
        <Card>
          <CardHeader><CardTitle className="text-base">Aktuálne ceny</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Zlato (XAU)", price: goldPrice },
                { label: "Striebro (XAG)", price: silverPrice },
                { label: "Platina (XPT)", price: platinumPrice },
                { label: "Paládium (XPD)", price: palladiumPrice },
              ].map(({ label, price }) => (
                <div key={label} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold">{price > 0 ? fmt(price) : "—"}</p>
                  <p className="text-xs text-muted-foreground">/ oz</p>
                </div>
              ))}
              {cryptoPrices.slice(0, 4).map((p) => (
                <div key={p.id} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{p.name}</p>
                  <p className="font-bold">{fmt(p.current_price)}</p>
                  <p className={`text-xs ${p.price_change_percentage_24h >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {p.price_change_percentage_24h >= 0 ? "+" : ""}{p.price_change_percentage_24h.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active alerts */}
        {active.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" /> Aktívne alerty ({active.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {active.map((a) => {
                const cur = currentPrice(a.assetType, a.coinId, a.ticker);
                const priceDiff = a.condition === "above" ? a.targetPrice - cur : cur - a.targetPrice;
                const diffPct = cur > 0 ? (priceDiff / cur) * 100 : null;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.condition === "above" ? "Cena stúpne nad" : "Cena klesne pod"} {fmt(a.targetPrice)}
                          {diffPct !== null && ` · ešte ${diffPct.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">{cur > 0 ? fmt(cur) : "—"}</Badge>

                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Triggered alerts */}
        {triggered.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base text-muted-foreground">Spustené alerty ({triggered.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {triggered.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">{a.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.condition === "above" ? "Nad" : "Pod"} {fmt(a.targetPrice)} — dosiahnuté
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" title="Resetovať" onClick={() => handleReset(a.id)}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {alerts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Žiadne alerty. Pridaj prvý pomocou tlačidla vyššie.
            </CardContent>
          </Card>
        )}

        {/* History */}
        {alertHistory.length > 0 && (
          <Card>
            <CardHeader>
              <button
                type="button"
                className="flex items-center justify-between w-full"
                onClick={() => setShowHistory((v) => !v)}
              >
                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                  <History className="w-4 h-4" /> História alertov ({alertHistory.length})
                </CardTitle>
                <span className="text-xs text-muted-foreground">{showHistory ? "Skryť" : "Zobraziť"}</span>
              </button>
            </CardHeader>
            {showHistory && (
              <CardContent className="space-y-2">
                {[...alertHistory].reverse().map((h) => (
                  <div key={h.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{h.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.condition === "above" ? "Prekročilo" : "Kleslo pod"} {fmt(h.targetPrice)}
                        {" · "}cena bola {fmt(h.priceAtTrigger)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {new Date(h.triggeredAt).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pridať cenový alert</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Aktívum</label>
              <Select value={form.assetType} onValueChange={(v) => handleAssetTypeChange((v ?? "gold") as PriceAlert["assetType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Zlato (XAU)</SelectItem>
                  <SelectItem value="silver">Striebro (XAG)</SelectItem>
                  <SelectItem value="platinum">Platina (XPT)</SelectItem>
                  <SelectItem value="palladium">Paládium (XPD)</SelectItem>
                  <SelectItem value="stock">Akcia / ETF</SelectItem>
                  <SelectItem value="crypto">Kryptomena</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.assetType === "stock" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ticker (napr. AAPL, MSFT)</label>
                <Input
                  placeholder="AAPL"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase(), label: e.target.value.toUpperCase() })}
                />
              </div>
            )}

            {form.assetType === "crypto" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kryptomena</label>
                {cryptoPrices.length > 0 ? (
                  <Select value={form.coinId} onValueChange={handleCoinSelect}>
                    <SelectTrigger><SelectValue placeholder="Vyber kryptomenu" /></SelectTrigger>
                    <SelectContent>
                      {cryptoPrices.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.symbol}) — {fmt(p.current_price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="CoinGecko ID (napr. bitcoin)"
                    value={form.coinId}
                    onChange={(e) => setForm({ ...form, coinId: e.target.value, label: e.target.value })}
                  />
                )}
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Podmienka</label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: (v ?? "above") as PriceAlert["condition"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Cena stúpne nad</SelectItem>
                  <SelectItem value="below">Cena klesne pod</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Cieľová cena (EUR)
                {currentPrice(form.assetType, form.coinId, form.ticker) > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    · aktuálna: {fmt(currentPrice(form.assetType, form.coinId, form.ticker))}
                  </span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.targetPrice || ""}
                onChange={(e) => setForm({ ...form, targetPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={handleAdd}>Pridať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
