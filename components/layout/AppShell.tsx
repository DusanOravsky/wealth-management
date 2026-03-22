"use client";

import { useApp } from "@/context/AppContext";
import { Sidebar } from "./Sidebar";
import { PINScreen } from "@/components/auth/PINScreen";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pinState } = useApp();

  if (pinState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground text-sm">Načítavam...</div>
      </div>
    );
  }

  if (pinState === "setup" || pinState === "locked") {
    return <PINScreen />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
