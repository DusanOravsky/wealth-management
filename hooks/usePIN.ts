"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { loadSettings, saveSettings, setSession, getSession, clearSession, loadPortfolio, savePortfolio } from "@/lib/store";
import { hashPIN, verifyPIN, generateSalt } from "@/lib/crypto";
import type { AppSettings } from "@/lib/types";
import { PIN_MAX_ATTEMPTS, PIN_LOCKOUT_MS, AUTO_LOCK_DEFAULT_MINUTES } from "@/lib/constants";

type PINState = "loading" | "setup" | "locked" | "unlocked";

export function usePIN() {
  const [state, setState] = useState<PINState>("loading");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset auto-lock timer on any user activity
  const resetAutoLock = useCallback((currentSettings: AppSettings | null, currentPin: string | null) => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    if (!currentSettings || !currentPin) return;
    const minutes = currentSettings.autoLockMinutes ?? AUTO_LOCK_DEFAULT_MINUTES;
    autoLockTimer.current = setTimeout(() => {
      clearSession();
      setPin(null);
      setState("locked");
    }, minutes * 60 * 1000);
  }, []);

  useEffect(() => {
    // Safety net: if something hangs, don't leave app stuck on "loading"
    const timeout = setTimeout(() => {
      setState((s) => (s === "loading" ? "locked" : s));
    }, 3000);

    let cancelled = false;
    const stored = loadSettings();
    if (!stored) {
      clearTimeout(timeout);
      setState("setup");
      return;
    }
    setSettings(stored);
    const sessionPin = getSession();
    if (sessionPin) {
      verifyPIN(sessionPin, stored.pinHash)
        .then((valid) => {
          if (cancelled) return;
          clearTimeout(timeout);
          if (valid) {
            setPin(sessionPin);
            setState("unlocked");
            resetAutoLock(stored, sessionPin);
          } else {
            clearSession();
            setState("locked");
          }
        })
        .catch(() => {
          if (cancelled) return;
          clearTimeout(timeout);
          clearSession();
          setState("locked");
        });
    } else {
      clearTimeout(timeout);
      setState("locked");
    }
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    };
  }, [resetAutoLock]);

  // Track user activity to reset auto-lock
  useEffect(() => {
    if (state !== "unlocked") return;
    const handler = () => resetAutoLock(settings, pin);
    window.addEventListener("mousemove", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [state, settings, pin, resetAutoLock]);

  // Lockout countdown timer
  useEffect(() => {
    if (!settings?.pinLockedUntil) return;
    const remaining = settings.pinLockedUntil - Date.now();
    if (remaining <= 0) return;
    setLockoutRemaining(Math.ceil(remaining / 1000));
    const interval = setInterval(() => {
      const r = Math.ceil((settings.pinLockedUntil! - Date.now()) / 1000);
      if (r <= 0) {
        setLockoutRemaining(0);
        clearInterval(interval);
      } else {
        setLockoutRemaining(r);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [settings?.pinLockedUntil]);

  const setupPIN = useCallback(async (newPin: string) => {
    setError(null);
    try {
      const salt = generateSalt();
      const pinHash = await hashPIN(newPin);
      const newSettings: AppSettings = { pinHash, salt, baseCurrency: "EUR", autoLockMinutes: AUTO_LOCK_DEFAULT_MINUTES };
      saveSettings(newSettings);
      setSettings(newSettings);
      setSession(newPin);
      setPin(newPin);
      setState("unlocked");
      resetAutoLock(newSettings, newPin);
    } catch {
      setError("Nepodarilo sa nastaviť PIN. Skús to znova.");
    }
  }, [resetAutoLock]);

  const unlock = useCallback(async (enteredPin: string) => {
    if (!settings) return;
    setError(null);

    // Check lockout
    if (settings.pinLockedUntil && settings.pinLockedUntil > Date.now()) {
      const secs = Math.ceil((settings.pinLockedUntil - Date.now()) / 1000);
      setError(`Príliš veľa pokusov. Skús za ${secs}s.`);
      return;
    }

    try {
      const valid = await verifyPIN(enteredPin, settings.pinHash);
      if (valid) {
        const updated = { ...settings, pinAttempts: 0, pinLockedUntil: undefined };
        saveSettings(updated);
        setSettings(updated);
        setSession(enteredPin);
        setPin(enteredPin);
        setState("unlocked");
        resetAutoLock(updated, enteredPin);
      } else {
        const attempts = (settings.pinAttempts ?? 0) + 1;
        const lockedUntil = attempts >= PIN_MAX_ATTEMPTS ? Date.now() + PIN_LOCKOUT_MS : undefined;
        const updated = { ...settings, pinAttempts: attempts, pinLockedUntil: lockedUntil };
        saveSettings(updated);
        setSettings(updated);
        if (lockedUntil) {
          setError(`Príliš veľa pokusov. Zablokované na ${PIN_LOCKOUT_MS / 1000}s.`);
        } else {
          setError(`Nesprávny PIN. Zostáva ${PIN_MAX_ATTEMPTS - attempts} pokus(ov).`);
        }
      }
    } catch {
      setError("Chyba pri overovaní PINu.");
    }
  }, [settings, resetAutoLock]);

  const changePIN = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    if (!settings) return false;
    const valid = await verifyPIN(currentPin, settings.pinHash);
    if (!valid) return false;

    // Re-encrypt portfolio with new PIN
    const portfolio = await loadPortfolio(currentPin, settings.salt);
    const newSalt = generateSalt();
    const newPinHash = await hashPIN(newPin);
    const newSettings = { ...settings, pinHash: newPinHash, salt: newSalt, pinAttempts: 0, pinLockedUntil: undefined };

    if (portfolio) await savePortfolio(portfolio, newPin, newSalt);

    // Re-encrypt API keys
    const { encrypt: enc, decrypt: dec } = await import("@/lib/crypto");
    const keyFields = ["binanceKey", "binanceSecret", "coingeckoKey", "claudeKey"] as const;
    for (const field of keyFields) {
      if (settings[field]) {
        try {
          const plain = await dec(settings[field]!, currentPin, settings.salt);
          newSettings[field] = await enc(plain, newPin, newSalt);
        } catch { /* skip if decrypt fails */ }
      }
    }

    saveSettings(newSettings);
    setSettings(newSettings);
    setSession(newPin);
    setPin(newPin);
    resetAutoLock(newSettings, newPin);
    return true;
  }, [settings, resetAutoLock]);

  const lock = useCallback(() => {
    clearSession();
    setPin(null);
    setState("locked");
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
  }, []);

  const updateSettings = useCallback((updated: AppSettings) => {
    saveSettings(updated);
    setSettings(updated);
    if (updated.autoLockMinutes !== settings?.autoLockMinutes) {
      resetAutoLock(updated, pin);
    }
  }, [settings?.autoLockMinutes, pin, resetAutoLock]);

  return { state, settings, pin, error, lockoutRemaining, setupPIN, unlock, lock, changePIN, updateSettings };
}
