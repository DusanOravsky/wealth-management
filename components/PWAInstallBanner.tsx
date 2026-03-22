"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

type Platform = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Capture the event as early as possible (before React mounts)
let _capturedPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _capturedPrompt = e as BeforeInstallPromptEvent;
  });
}

const DISMISSED_KEY = "wm_pwa_dismissed";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isStandalone =
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) return null;
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  return null;
}

export function PWAInstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const p = detectPlatform();
    if (!p) return;
    setPlatform(p);

    if (p === "android") {
      // Use already-captured prompt or listen for it
      if (_capturedPrompt) {
        setDeferredPrompt(_capturedPrompt);
        setVisible(true);
      } else {
        const handler = (e: Event) => {
          e.preventDefault();
          _capturedPrompt = e as BeforeInstallPromptEvent;
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
      }
    } else {
      // iOS: show instructions after short delay
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      dismiss();
      _capturedPrompt = null;
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div
        className="rounded-xl shadow-2xl p-4"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">Inštalovať aplikáciu</p>
              {platform === "android" ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pridaj na domovskú obrazovku pre rýchly prístup offline.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  V Safari klikni{" "}
                  <Share className="inline w-3.5 h-3.5 mx-0.5 align-middle" />
                  {" "}→ <strong>Pridať na plochu</strong>
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 -mt-1 -mr-1 h-7 w-7 p-0" onClick={dismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {platform === "android" && (
          <Button size="sm" className="mt-3 w-full" onClick={install}
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}>
            <Download className="w-4 h-4 mr-2" />
            Inštalovať
          </Button>
        )}
      </div>
    </div>
  );
}
