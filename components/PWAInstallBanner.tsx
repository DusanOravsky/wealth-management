"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

type Platform = "android" | "ios" | null;

function detectPlatform(): Platform {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isStandalone =
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) return null; // already installed
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "wm_pwa_dismissed";

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
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    } else {
      // iOS: show instructions banner after short delay
      const t = setTimeout(() => setVisible(true), 2000);
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
    if (outcome === "accepted") dismiss();
    else setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm">Inštalovať aplikáciu</p>
            {platform === "android" ? (
              <p className="text-xs text-muted-foreground mt-1">
                Pridaj Wealth Manager na domovskú obrazovku pre rýchly prístup.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Klikni na{" "}
                <Share className="inline w-3.5 h-3.5 mx-0.5 align-middle" />
                {" "}v Safari a zvol <strong>„Pridať na plochu"</strong>.
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 -mt-1 -mr-1 h-7 w-7 p-0" onClick={dismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {platform === "android" && (
          <Button size="sm" className="mt-3 w-full" onClick={install}>
            <Download className="w-4 h-4 mr-2" />
            Inštalovať
          </Button>
        )}
      </div>
    </div>
  );
}
