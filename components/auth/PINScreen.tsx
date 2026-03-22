"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH } from "@/lib/constants";
import { Lock, Shield, TrendingUp } from "lucide-react";

export function PINScreen() {
  const { pinState, pinError, lockoutRemaining, setupPIN, unlock } = useApp();
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
  const dots = Array.from({ length: PIN_MAX_LENGTH }, (_, i) => i < pin.length);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, oklch(0.09 0.025 264) 0%, oklch(0.12 0.018 290) 100%)" }}
    >
      {/* Background glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
            }}
          >
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Wealth Manager</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {isSetup ? "Nastav PIN na ochranu dát" : "Zadaj PIN pre prístup"}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "oklch(0.18 0.02 264 / 80%)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
          }}
        >
          {/* Icon */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              {isSetup ? (
                <Shield className="w-4 h-4" style={{ color: "#818cf8" }} />
              ) : (
                <Lock className="w-4 h-4" style={{ color: "#818cf8" }} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {isSetup ? "Nastavenie PINu" : "Odomknúť"}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {isSetup ? "AES-256 šifrovanie" : "Tvoje dáta sú v bezpečí"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* PIN dots */}
            <div className="flex justify-center gap-3 py-2">
              {dots.map((filled, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full transition-all duration-150"
                  style={{
                    background: filled
                      ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                      : "rgba(255,255,255,0.15)",
                    boxShadow: filled ? "0 0 8px rgba(99,102,241,0.6)" : "none",
                    transform: filled ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>

            <Input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              maxLength={PIN_MAX_LENGTH}
              autoFocus
              className="text-center text-xl tracking-widest"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
              }}
            />

            {isSetup && (
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Potvrď PIN"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
                maxLength={PIN_MAX_LENGTH}
                className="text-center text-xl tracking-widest"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              />
            )}

            {lockoutRemaining > 0 && (
              <p className="text-sm text-center" style={{ color: "#fca5a5" }}>
                Zablokované — skús za {lockoutRemaining}s
              </p>
            )}

            {error && !lockoutRemaining && (
              <p className="text-sm text-center" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loading || lockoutRemaining > 0}
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                border: "none",
                boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
              }}
            >
              {loading ? "Spracovávam..." : isSetup ? "Vytvoriť PIN" : "Odomknúť"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
