"use client";

import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { saveApiKey, exportBackup, importBackup, wipeAll } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Save, Trash2, Download, Upload, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { CURRENCIES, AUTO_LOCK_DEFAULT_MINUTES, PIN_MIN_LENGTH } from "@/lib/constants";
import type { Currency } from "@/lib/types";

export default function SettingsPage() {
  const { pin, settings, updateSettings, lock, changePIN, reloadPortfolio } = useApp();

  // API keys
  const [binanceKey, setBinanceKey] = useState("");
  const [binanceSecret, setBinanceSecret] = useState("");
  const [coingeckoKey, setCoingeckoKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [showKeys, setShowKeys] = useState(false);

  // Change PIN
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [changingPin, setChangingPin] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);

  async function saveKey(
    field: "binanceKey" | "binanceSecret" | "coingeckoKey" | "claudeKey",
    value: string,
    label: string
  ) {
    if (!pin || !settings) { toast.error("Nie si prihlásený."); return; }
    if (!value.trim()) { toast.error("Hodnota nemôže byť prázdna."); return; }
    try {
      const updated = await saveApiKey(field, value.trim(), pin, settings);
      updateSettings(updated);
      toast.success(`${label} uložený.`);
    } catch {
      toast.error("Chyba pri ukladaní kľúča.");
    }
  }

  async function handleChangePIN() {
    if (newPin !== confirmPin) { toast.error("Nové PINy sa nezhodujú."); return; }
    if (newPin.length < PIN_MIN_LENGTH) {
      toast.error(`PIN musí mať aspoň ${PIN_MIN_LENGTH} číslic.`);
      return;
    }
    setChangingPin(true);
    try {
      const ok = await changePIN(currentPin, newPin);
      if (ok) {
        toast.success("PIN bol úspešne zmenený.");
        setCurrentPin(""); setNewPin(""); setConfirmPin("");
      } else {
        toast.error("Nesprávny súčasný PIN.");
      }
    } finally {
      setChangingPin(false);
    }
  }

  async function handleExport() {
    if (!pin || !settings) { toast.error("Nie si prihlásený."); return; }
    try {
      const json = await exportBackup(pin, settings.salt);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wealth-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Záloha exportovaná.");
    } catch {
      toast.error("Chyba pri exporte.");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pin || !settings) return;
    try {
      const text = await file.text();
      await importBackup(text, pin, settings.salt);
      await reloadPortfolio();
      toast.success("Záloha importovaná.");
    } catch {
      toast.error("Chyba pri importe. Skontroluj formát súboru.");
    }
    e.target.value = "";
  }

  function handleWipe() {
    if (!confirm("Naozaj chceš vymazať VŠETKY dáta? Táto akcia je nezvratná.")) return;
    wipeAll();
    window.location.reload();
  }

  const keyInputClass = showKeys ? "" : "font-mono";

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Nastavenia</h1>
          <p className="text-muted-foreground text-sm mt-1">Správa API kľúčov, bezpečnosti a zálohy</p>
        </div>

        {/* Display settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zobrazenie</CardTitle>
            <CardDescription>Mena a automatické zamknutie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm w-40 shrink-0">Zobrazovacia mena</label>
              <Select
                value={settings?.displayCurrency ?? settings?.baseCurrency ?? "EUR"}
                onValueChange={(v) => {
                  if (v && settings) updateSettings({ ...settings, displayCurrency: (v ?? "EUR") as Currency });
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm w-40 shrink-0">Auto-zamknutie</label>
              <Select
                value={String(settings?.autoLockMinutes ?? AUTO_LOCK_DEFAULT_MINUTES)}
                onValueChange={(v) => {
                  if (v && settings) updateSettings({ ...settings, autoLockMinutes: Number(v) });
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 min</SelectItem>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bezpečnosť</CardTitle>
            <CardDescription>
              Všetky kľúče sú šifrované AES-256-GCM tvojím PINom a uložené lokálne.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" size="sm" onClick={lock}>
              Zamknúť aplikáciu
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeys(!showKeys)}
            >
              {showKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showKeys ? "Skryť" : "Zobraziť"} polia
            </Button>
          </CardContent>
        </Card>

        {/* Change PIN */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zmena PINu</CardTitle>
            <CardDescription>
              Pri zmene PINu sa automaticky prešifrujú všetky dáta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Aktuálny PIN"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
            />
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Nový PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
            />
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Potvrdiť nový PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
            />
            <Button
              size="sm"
              onClick={handleChangePIN}
              disabled={changingPin || !currentPin || !newPin || !confirmPin}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {changingPin ? "Mením PIN..." : "Zmeniť PIN"}
            </Button>
          </CardContent>
        </Card>

        {/* Export / Import */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export / Import zálohy</CardTitle>
            <CardDescription>
              Export uloží dešifrované portfólio ako JSON. Import prepíše aktuálne dáta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportovať zálohu
            </Button>
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Importovať zálohu
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </CardContent>
        </Card>

        {/* Binance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Binance API</CardTitle>
            <CardDescription>
              Read-Only API kľúč zo Binance. Použi len kľúče s oprávnením &quot;Read Info&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                placeholder="API Key"
                value={binanceKey}
                onChange={(e) => setBinanceKey(e.target.value)}
                className={keyInputClass}
              />
              <Button size="sm" onClick={() => saveKey("binanceKey", binanceKey, "Binance API Key")}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                placeholder="Secret Key"
                value={binanceSecret}
                onChange={(e) => setBinanceSecret(e.target.value)}
                className={keyInputClass}
              />
              <Button size="sm" onClick={() => saveKey("binanceSecret", binanceSecret, "Binance Secret Key")}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings?.binanceKey ? "✓ API Key uložený" : "API Key nie je nastavený"}
              {" · "}
              {settings?.binanceSecret ? "✓ Secret uložený" : "Secret nie je nastavený"}
            </p>
          </CardContent>
        </Card>

        {/* CoinGecko */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CoinGecko API</CardTitle>
            <CardDescription>
              Voliteľný API kľúč pre vyšší rate limit. Bez kľúča funguje free tier (30 req/min).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                placeholder="CoinGecko Demo API Key"
                value={coingeckoKey}
                onChange={(e) => setCoingeckoKey(e.target.value)}
                className={keyInputClass}
              />
              <Button size="sm" onClick={() => saveKey("coingeckoKey", coingeckoKey, "CoinGecko API Key")}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings?.coingeckoKey ? "✓ API Key uložený" : "Nepovinné — bez kľúča funguje free tier"}
            </p>
          </CardContent>
        </Card>

        {/* Claude */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claude API (Anthropic)</CardTitle>
            <CardDescription>
              Vyžadovaný pre AI odporúčania. Získaj kľúč na console.anthropic.com.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                placeholder="sk-ant-..."
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                className={keyInputClass}
              />
              <Button size="sm" onClick={() => saveKey("claudeKey", claudeKey, "Claude API Key")}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings?.claudeKey ? "✓ Claude API Key uložený" : "API Key nie je nastavený"}
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Danger zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Nebezpečná zóna</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm" onClick={handleWipe}>
              <Trash2 className="w-4 h-4 mr-2" />
              Vymazať všetky dáta
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Vymaže všetky dáta z localStorage vrátane portfólia, PIN a API kľúčov.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
