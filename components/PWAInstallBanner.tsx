"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Capture as early as possible — before React mounts
let _capturedPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _capturedPrompt = e as BeforeInstallPromptEvent;
  });
}

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
}

function isAndroid() {
  return /android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
}

const DISMISSED_KEY = "wm_install_dismissed_until";

function isDismissed() {
  try {
    const until = localStorage.getItem(DISMISSED_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch { return false; }
}

function dismissFor7Days() {
  try { localStorage.setItem(DISMISSED_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch { /* */ }
}

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const ios = isIOS();
    const android = isAndroid();
    if (!ios && !android) return;

    setPlatform(ios ? "ios" : "android");

    if (android) {
      // Use already-captured prompt or wait for it
      if (_capturedPrompt) {
        setPrompt(_capturedPrompt);
        setShow(true);
      } else {
        const handler = (e: Event) => {
          e.preventDefault();
          _capturedPrompt = e as BeforeInstallPromptEvent;
          setPrompt(_capturedPrompt);
          setShow(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
      }
    } else {
      // iOS — show after short delay
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Hide when installed
  useEffect(() => {
    const handler = () => { setShow(false); _capturedPrompt = null; };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      _capturedPrompt = null;
    }
  }

  function dismiss() {
    setShow(false);
    dismissFor7Days();
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl shadow-2xl p-4" style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
      }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <Download className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Inštalovať aplikáciu</p>
            {platform === "ios" ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Klikni <Share className="inline w-3 h-3 mx-0.5 align-middle" /> v Safari → <strong>Pridať na plochu</strong>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Pridaj na domovskú obrazovku pre rýchly offline prístup.
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0 -mt-0.5 -mr-0.5" onClick={dismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {platform === "android" && (
          <Button size="sm" className="mt-3 w-full font-semibold" onClick={install}
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}>
            <Download className="w-4 h-4 mr-2" />
            Inštalovať
          </Button>
        )}
      </div>
    </div>
  );
}
