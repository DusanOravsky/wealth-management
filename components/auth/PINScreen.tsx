"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH } from "@/lib/constants";
import { Lock, Shield } from "lucide-react";

export function PINScreen() {
  const { pinState, pinError, setupPIN, unlock } = useApp();
  const [pin, setPinInput] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSetup = pinState === "setup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
      setLocalError(`PIN musí mať ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} číslice.`);
      return;
    }

    if (isSetup && pin !== confirm) {
      setLocalError("PINy sa nezhodujú.");
      return;
    }

    setLoading(true);
    try {
      if (isSetup) {
        await setupPIN(pin);
      } else {
        await unlock(pin);
      }
    } finally {
      setLoading(false);
      setPinInput("");
      setConfirm("");
    }
  }

  const error = localError || pinError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            {isSetup ? (
              <Shield className="w-10 h-10 text-primary" />
            ) : (
              <Lock className="w-10 h-10 text-primary" />
            )}
          </div>
          <CardTitle>{isSetup ? "Nastavenie PINu" : "Odomknúť aplikáciu"}</CardTitle>
          <CardDescription>
            {isSetup
              ? "Vytvor PIN na ochranu tvojich dát. Dáta sú šifrované AES-256."
              : "Zadaj PIN pre prístup k tvojmu portfóliu."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                maxLength={PIN_MAX_LENGTH}
                autoFocus
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {isSetup && (
              <div>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Potvrď PIN"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
                  maxLength={PIN_MAX_LENGTH}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Spracovávam..." : isSetup ? "Vytvoriť PIN" : "Odomknúť"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
