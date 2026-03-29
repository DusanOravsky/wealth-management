"use client";

import { useEffect } from "react";
import { toast } from "sonner";

function showUpdateToast(worker: ServiceWorker) {
  toast("Nová verzia je k dispozícii", {
    description: "Aktualizuj aplikáciu pre najnovšie zmeny.",
    duration: Infinity,
    action: {
      label: "Aktualizovať",
      onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
    },
  });
}

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/wealth-management/sw.js", { scope: "/wealth-management/" })
      .then((registration) => {
        // New SW already waiting (e.g. user came back after update was deployed)
        if (registration.waiting) {
          showUpdateToast(registration.waiting);
        }

        // New SW found while app is open
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast(installing);
            }
          });
        });
      })
      .catch(() => {});

    // After SKIP_WAITING → SW takes control → reload to get fresh bundles
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }, []);

  return null;
}
