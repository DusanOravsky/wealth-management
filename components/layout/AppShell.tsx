"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "./Sidebar";
import { PINScreen } from "@/components/auth/PINScreen";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pinState } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transition-transform duration-300
          md:static md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center h-14 px-4 border-b border-border bg-card sticky top-0 z-30">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="ml-3 font-semibold text-primary text-sm">Wealth Manager</span>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
