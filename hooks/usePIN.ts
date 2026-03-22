"use client";

import { useState, useEffect, useCallback } from "react";
import { loadSettings, saveSettings, setSession, getSession, clearSession } from "@/lib/store";
import { hashPIN, verifyPIN, generateSalt } from "@/lib/crypto";
import type { AppSettings } from "@/lib/types";

type PINState = "loading" | "setup" | "locked" | "unlocked";

export function usePIN() {
  const [state, setState] = useState<PINState>("loading");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSettings();
    if (!stored) {
      setState("setup");
      return;
    }
    setSettings(stored);
    // Check if session already unlocked
    const sessionPin = getSession();
    if (sessionPin) {
      verifyPIN(sessionPin, stored.pinHash).then((valid) => {
        if (valid) {
          setPin(sessionPin);
          setState("unlocked");
        } else {
          clearSession();
          setState("locked");
        }
      });
    } else {
      setState("locked");
    }
  }, []);

  const setupPIN = useCallback(async (newPin: string) => {
    setError(null);
    try {
      const salt = generateSalt();
      const pinHash = await hashPIN(newPin);
      const newSettings: AppSettings = {
        pinHash,
        salt,
        baseCurrency: "EUR",
      };
      saveSettings(newSettings);
      setSettings(newSettings);
      setSession(newPin);
      setPin(newPin);
      setState("unlocked");
    } catch (e) {
      setError("Nepodarilo sa nastaviť PIN. Skús to znova.");
      console.error(e);
    }
  }, []);

  const unlock = useCallback(
    async (enteredPin: string) => {
      if (!settings) return;
      setError(null);
      try {
        const valid = await verifyPIN(enteredPin, settings.pinHash);
        if (valid) {
          setSession(enteredPin);
          setPin(enteredPin);
          setState("unlocked");
        } else {
          setError("Nesprávny PIN. Skús to znova.");
        }
      } catch (e) {
        setError("Chyba pri overovaní PINu.");
        console.error(e);
      }
    },
    [settings]
  );

  const lock = useCallback(() => {
    clearSession();
    setPin(null);
    setState("locked");
  }, []);

  const updateSettings = useCallback((updated: AppSettings) => {
    saveSettings(updated);
    setSettings(updated);
  }, []);

  return { state, settings, pin, error, setupPIN, unlock, lock, updateSettings };
}
