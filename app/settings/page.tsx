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
import { Eye, EyeOff, Save, Trash2, Download, Upload, KeyRound, User, Cloud, CloudDownload, QrCode, ScanLine } from "lucide-react";
import { loadGIS, requestAccessToken, uploadToDrive, downloadFromDrive, getLastSync } from "@/lib/gdrive";
import { toast } from "sonner";
import { CURRENCIES, AUTO_LOCK_DEFAULT_MINUTES, PIN_MIN_LENGTH } from "@/lib/constants";
import type { Currency } from "@/lib/types";
import { exportQRPayload, importQRPayload } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  // Google Drive sync
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() => getLastSync());
  const [googleClientId, setGoogleClientId] = useState(settings?.googleClientId ?? "");

  // QR transfer
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrScanInput, setQrScanInput] = useState("");
  const [qrImportLoading, setQrImportLoading] = useState(false);

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

  async function handleGDriveUpload() {
    if (!pin || !settings) { toast.error("Nie si prihlásený."); return; }
    const clientId = settings.googleClientId ?? googleClientId;
    if (!clientId) { toast.error("Zadaj Google Client ID."); return; }
    setGdriveLoading(true);
    try {
      await loadGIS();
      const token = await requestAccessToken(clientId);
      const content = await exportBackup(pin, settings.salt);
      const ts = await uploadToDrive(token, content);
      setLastSync(ts);
      toast.success("Záloha nahraná na Google Drive.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chyba pri nahrávaní.");
    } finally {
      setGdriveLoading(false);
    }
  }

  async function handleGDriveDownload() {
    if (!pin || !settings) { toast.error("Nie si prihlásený."); return; }
    const clientId = settings.googleClientId ?? googleClientId;
    if (!clientId) { toast.error("Zadaj Google Client ID."); return; }
    if (!confirm("Stiahnuť zálohu z Google Drive? Prepíše aktuálne dáta.")) return;
    setGdriveLoading(true);
    try {
      await loadGIS();
      const token = await requestAccessToken(clientId);
      const result = await downloadFromDrive(token);
      if (!result) { toast.error("Na Drive sa nenašla žiadna záloha."); return; }
      await importBackup(result.content, pin, settings.salt);
      await reloadPortfolio();
      setLastSync(result.modifiedTime);
      toast.success("Záloha stiahnutá a importovaná.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chyba pri sťahovaní.");
    } finally {
      setGdriveLoading(false);
    }
  }

  async function openQRDialog() {
    if (!pin || !settings) { toast.error("Nie si prihlásený."); return; }
    setQrDialogOpen(true);
    setQrDataUrl(null);
    setQrLoading(true);
    try {
      const encoded = await exportQRPayload(pin, settings.salt);
      const url = `https://dusanoravsky.github.io/wealth-management/#qr=${encoded}`;
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "L", width: 320, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch {
      toast.error("Chyba pri generovaní QR kódu.");
    } finally {
      setQrLoading(false);
    }
  }

  async function handleQRImport() {
    if (!pin || !settings) { toast.error("Nie si prihlásený."); return; }
    const encoded = qrScanInput.trim();
    if (!encoded) { toast.error("Zadaj zakódované dáta."); return; }
    setQrImportLoading(true);
    try {
      // Accept either the full URL or just the encoded payload
      const payload = encoded.includes("#qr=") ? encoded.split("#qr=")[1] : encoded;
      await importQRPayload(payload, pin, settings.salt);
      await reloadPortfolio();
      toast.success("Dáta importované z QR kódu.");
      setQrDialogOpen(false);
      setQrScanInput("");
    } catch {
      toast.error("Neplatné QR dáta. Skopíruj obsah presne z PC.");
    } finally {
      setQrImportLoading(false);
    }
  }

  function saveGoogleClientId() {
    if (!settings) return;
    const id = googleClientId.trim();
    if (!id) { toast.error("Zadaj Client ID."); return; }
    updateSettings({ ...settings, googleClientId: id });
    toast.success("Google Client ID uložené.");
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

        {/* Personal profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Osobný profil
            </CardTitle>
            <CardDescription>
              Použije sa v FIRE kalkulátore a plánovaní dôchodku.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Rok narodenia</label>
                <Input
                  type="number"
                  placeholder="napr. 1990"
                  value={settings?.birthYear ?? ""}
                  onChange={(e) => {
                    if (!settings) return;
                    const v = parseInt(e.target.value);
                    updateSettings({ ...settings, birthYear: isNaN(v) ? undefined : v });
                  }}
                  min={1940}
                  max={new Date().getFullYear() - 18}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Cieľový vek dôchodku</label>
                <Input
                  type="number"
                  placeholder="65"
                  value={settings?.retirementAge ?? ""}
                  onChange={(e) => {
                    if (!settings) return;
                    const v = parseInt(e.target.value);
                    updateSettings({ ...settings, retirementAge: isNaN(v) ? undefined : v });
                  }}
                  min={40}
                  max={80}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Čistý mes. príjem (€)</label>
                <Input
                  type="number"
                  placeholder="napr. 2500"
                  value={settings?.monthlyIncome ?? ""}
                  onChange={(e) => {
                    if (!settings) return;
                    const v = parseInt(e.target.value);
                    updateSettings({ ...settings, monthlyIncome: isNaN(v) ? undefined : v });
                  }}
                  min={0}
                />
              </div>
            </div>
            {settings?.birthYear && (
              <p className="text-xs text-muted-foreground">
                Aktuálny vek: <strong>{new Date().getFullYear() - settings.birthYear} rokov</strong>
                {settings.retirementAge && (
                  <> · Do dôchodku: <strong>{Math.max(0, settings.retirementAge - (new Date().getFullYear() - settings.birthYear))} rokov</strong></>
                )}
              </p>
            )}
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
            <CardTitle className="text-base">Export / Import dát</CardTitle>
            <CardDescription>
              Záloha obsahuje všetky dáta: portfólio, ciele, výdavky, poistenie, alerty, nastavenia profilu.
              PIN a API kľúče sa <strong>neexportujú</strong> — zostávajú na zariadení.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
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
            </div>
            <p className="text-xs text-muted-foreground">
              Pri importe sa zlúčia nastavenia profilu. Portfólio, výdavky a ostatné dáta sa prepíšu.
            </p>
          </CardContent>
        </Card>

        {/* QR Transfer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-4 h-4" /> QR prenos (PC ↔ Mobil)
            </CardTitle>
            <CardDescription>
              Prenesie portfólio medzi zariadeniami bez cloudu — naskenuj QR kód z PC na mobile, alebo vlož kód z mobilu na PC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={openQRDialog} disabled={qrLoading}>
                <QrCode className="w-4 h-4 mr-2" />
                Zobraziť QR kód
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Na PC vygeneruj QR → naskenuj mobilom. Na mobile vlož kód (URL z QR) do poľa nižšie.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Vlož QR URL alebo zakódovaný text..."
                value={qrScanInput}
                onChange={(e) => setQrScanInput(e.target.value)}
                className="text-xs font-mono"
              />
              <Button size="sm" onClick={handleQRImport} disabled={qrImportLoading || !qrScanInput}>
                <ScanLine className="w-4 h-4 mr-2" />
                Import
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Google Drive Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="w-4 h-4" /> Google Drive synchronizácia
            </CardTitle>
            <CardDescription>
              Záloha sa uloží do skrytého priečinka tvojho Drive (appDataFolder) — vidí ju len táto appka.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client ID input */}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Google OAuth Client ID</label>
              <div className="flex gap-2">
                <Input
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button size="sm" onClick={saveGoogleClientId}><Save className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings?.googleClientId ? "✓ Client ID uložené" : "Ako získať Client ID — pozri pokyny nižšie"}
              </p>
            </div>

            {/* Sync buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGDriveUpload}
                disabled={gdriveLoading || !settings?.googleClientId}
              >
                <Cloud className={`w-4 h-4 mr-2 ${gdriveLoading ? "animate-pulse" : ""}`} />
                Nahrať na Drive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGDriveDownload}
                disabled={gdriveLoading || !settings?.googleClientId}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                Stiahnuť z Drive
              </Button>
            </div>

            {lastSync && (
              <p className="text-xs text-muted-foreground">
                Posledná synchronizácia: {new Date(lastSync).toLocaleString("sk-SK")}
              </p>
            )}

            {/* Setup instructions */}
            {!settings?.googleClientId && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Ako nastaviť Google Client ID:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Otvor <strong>console.cloud.google.com</strong></li>
                  <li>Vytvor projekt → APIs &amp; Services → Enable APIs → <strong>Google Drive API</strong></li>
                  <li>Credentials → Create Credentials → <strong>OAuth 2.0 Client ID</strong></li>
                  <li>Application type: <strong>Web application</strong></li>
                  <li>Authorized JavaScript origins pridaj: <strong>https://dusanoravsky.github.io</strong></li>
                  <li>Skopíruj Client ID a vlož ho sem</li>
                </ol>
              </div>
            )}
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
                placeholder={settings?.binanceKey ? "Kľúč je uložený — zadaj nový pre zmenu" : "API Key"}
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
                placeholder={settings?.binanceSecret ? "Kľúč je uložený — zadaj nový pre zmenu" : "Secret Key"}
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
              Od roku 2024 CoinGecko vyžaduje API kľúč aj pre free tier — bez neho blokuje requesty z browsera (CORS chyba).
              Registrácia zdarma na <strong>coingecko.com</strong> → Developer Dashboard → Demo API Key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                placeholder={settings?.coingeckoKey ? "Kľúč je uložený — zadaj nový pre zmenu" : "CoinGecko Demo API Key (povinné)"}
                value={coingeckoKey}
                onChange={(e) => setCoingeckoKey(e.target.value)}
                className={keyInputClass}
              />
              <Button size="sm" onClick={() => saveKey("coingeckoKey", coingeckoKey, "CoinGecko API Key")}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings?.coingeckoKey ? "✓ API Key uložený" : "⚠ Bez kľúča sa ceny krypta nenačítajú"}
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
                placeholder={settings?.claudeKey ? "Kľúč je uložený — zadaj nový pre zmenu" : "sk-ant-..."}
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

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR kód prenosu</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrLoading && <p className="text-sm text-muted-foreground">Generujem QR kód...</p>}
            {qrDataUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR kód" className="rounded-lg border w-64 h-64" />
                <p className="text-xs text-muted-foreground text-center">
                  Naskenuj tento kód mobilom (photo app alebo QR scanner). Otvorí sa aplikácia s možnosťou importu.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
