"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function PWARegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/wealth-management/sw.js", { scope: "/wealth-management/" })
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
            }
          });
        });
      })
      .catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }, []);

  function update() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waitingWorker) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white"
      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
      <span>🚀 Nová verzia je k dispozícii</span>
      <Button size="sm" variant="secondary" onClick={update} className="shrink-0 gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" />
        Aktualizovať
      </Button>
    </div>
  );
}
