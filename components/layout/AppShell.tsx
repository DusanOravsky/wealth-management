"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { PINScreen } from "@/components/auth/PINScreen";
import { TrendingUp, Menu, WifiOff } from "lucide-react";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pinState } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  if (pinState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sidebar">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-sidebar-foreground/60 text-sm">Načítavam...</span>
        </div>
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
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
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
        {/* Mobile top bar — matches sidebar style */}
        <div
          className="md:hidden flex items-center h-14 px-4 border-b sticky top-0 z-30"
          style={{ background: "var(--sidebar)", borderColor: "var(--sidebar-border)" }}
        >
          <button
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-3 flex-1">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <TrendingUp className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
              Wealth Manager
            </span>
          </div>
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              <WifiOff className="w-3 h-3" />
              Offline
            </div>
          )}
        </div>

        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
      <PWAInstallBanner />
    </div>
  );
}
