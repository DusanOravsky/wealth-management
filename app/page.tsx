"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  const { pinState } = useApp();
  const router = useRouter();

  useEffect(() => {
    // Handle GitHub Pages 404 SPA redirect
    const redirectPath = sessionStorage.getItem("wm_spa_redirect");
    if (redirectPath && redirectPath !== "/") {
      sessionStorage.removeItem("wm_spa_redirect");
      if (pinState === "unlocked") {
        router.replace(redirectPath);
        return;
      }
    }
    if (pinState === "unlocked") {
      router.replace("/dashboard");
    }
  }, [pinState, router]);

  return <AppShell>{null}</AppShell>;
}
