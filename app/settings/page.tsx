"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { saveApiKey } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { pin, settings, updateSettings, lock } = useApp();

  const [binanceKey, setBinanceKey] = useState("");
  const [binanceSecret, setBinanceSecret] = useState("");
  const [coingeckoKey, setCoingeckoKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [showKeys, setShowKeys] = useState(false);

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

  function handleWipe() {
    if (!confirm("Naozaj chceš vymazať VŠETKY dáta? Táto akcia je nezvratná.")) return;
    // Remove only app-specific keys to avoid clearing other apps on the same GitHub Pages domain
    localStorage.removeItem("wm_settings");
    localStorage.removeItem("wm_portfolio");
    // In-memory session is cleared on reload automatically
    window.location.reload();
  }

  const keyInputClass = showKeys ? "" : "font-mono";

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Nastavenia</h1>
          <p className="text-muted-foreground text-sm mt-1">Správa API kľúčov a bezpečnosti</p>
        </div>

        {/* Security info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bezpečnosť</CardTitle>
            <CardDescription>
              Všetky kľúče sú šifrované AES-256-GCM tvojím PINom a uložené lokálne v prehliadači.
              Nikdy neopustia tvoje zariadenie.
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
