"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/wealth-management/sw.js", { scope: "/wealth-management/" })
        .catch(() => {});
    }
  }, []);
  return null;
}
