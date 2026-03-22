"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Coins,
  Wallet,
  Building2,
  Bitcoin,
  PiggyBank,
  BarChart3,
  Sparkles,
  Settings,
  LogOut,
  Sun,
  Moon,
  Target,
  X,
  TrendingUp,
  LineChart,
  Home,
  Bell,
  ShieldCheck,
  Receipt,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#60a5fa" },
  { href: "/commodities", label: "Komodity", icon: Coins, color: "#fbbf24" },
  { href: "/cash", label: "Hotovosť", icon: Wallet, color: "#34d399" },
  { href: "/pension", label: "II. Pilier", icon: PiggyBank, color: "#a78bfa" },
  { href: "/bank", label: "Bankové účty", icon: Building2, color: "#38bdf8" },
  { href: "/crypto", label: "Krypto", icon: Bitcoin, color: "#fb923c" },
  { href: "/stocks", label: "Akcie", icon: LineChart, color: "#60a5fa" },
  { href: "/realestate", label: "Nehnuteľnosti", icon: Home, color: "#10b981" },
  { href: "/budget", label: "Výdavky", icon: Receipt, color: "#f472b6" },
  { href: "/insurance", label: "Poistenie", icon: ShieldCheck, color: "#34d399" },
  { href: "/alerts", label: "Alerty", icon: Bell, color: "#fbbf24" },
  { href: "/planning", label: "Plánovanie", icon: BarChart3, color: "#818cf8" },
  { href: "/goals", label: "Ciele", icon: Target, color: "#f472b6" },
  { href: "/advisor", label: "AI Poradca", icon: Sparkles, color: "#c084fc" },
  { href: "/settings", label: "Nastavenia", icon: Settings, color: "#94a3b8" },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { lock } = useApp();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="w-64 flex flex-col h-screen bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 4px 14px rgba(99,102,241,0.4)" }}
            >
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground leading-tight">Wealth Manager</p>
              <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>Osobné financie</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-md transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, color }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} onClick={onClose}>
              <span
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground/90"
                )}
              >
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: isActive ? color : undefined }}
                />
                {label}
                {isActive && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-0.5">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground/90"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4" style={{ color: "#fbbf24" }} />
          ) : (
            <Moon className="w-4 h-4" style={{ color: "#818cf8" }} />
          )}
          {resolvedTheme === "dark" ? "Svetlý režim" : "Tmavý režim"}
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground/90"
          onClick={lock}
        >
          <LogOut className="w-4 h-4" style={{ color: "#f87171" }} />
          Zamknúť
        </button>
        <p className="text-center text-xs px-3 pt-1 pb-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </div>
    </aside>
  );
}
