"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import { importQRPayload } from "@/lib/store";
import { toast } from "sonner";

export default function Home() {
  const { pinState, pin, settings, reloadPortfolio } = useApp();
  const router = useRouter();
  const qrHandledRef = useRef(false);

  useEffect(() => {
    if (pinState !== "unlocked") return;

    // Handle QR import from URL hash
    if (!qrHandledRef.current && typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.startsWith("#qr=")) {
        const encoded = hash.slice(4);
        qrHandledRef.current = true;
        if (pin && settings) {
          importQRPayload(encoded, pin, settings.salt)
            .then(() => reloadPortfolio())
            .then(() => {
              toast.success("Portfólio importované z QR kódu.");
              // Clear hash
              window.history.replaceState(null, "", window.location.pathname);
            })
            .catch(() => toast.error("Neplatný QR kód."));
          return;
        }
      }
    }

    // Handle GitHub Pages 404 SPA redirect
    const redirectPath = sessionStorage.getItem("wm_spa_redirect");
    if (redirectPath && redirectPath !== "/") {
      sessionStorage.removeItem("wm_spa_redirect");
      router.replace(redirectPath);
      return;
    }
    router.replace("/dashboard");
  }, [pinState, pin, settings, router, reloadPortfolio]);

  return <AppShell>{null}</AppShell>;
}
