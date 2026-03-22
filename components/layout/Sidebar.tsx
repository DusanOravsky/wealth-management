"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Coins,
  Wallet,
  Building2,
  Bitcoin,
  PiggyBank,
  TrendingUp,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/commodities", label: "Komodity", icon: Coins },
  { href: "/cash", label: "Hotovosť", icon: Wallet },
  { href: "/pension", label: "II. Pilier", icon: PiggyBank },
  { href: "/bank", label: "Bankové účty", icon: Building2 },
  { href: "/crypto", label: "Krypto", icon: Bitcoin },
  { href: "/planning", label: "Plánovanie", icon: TrendingUp },
  { href: "/advisor", label: "AI Poradca", icon: Sparkles },
  { href: "/settings", label: "Nastavenia", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { lock } = useApp();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <h1 className="text-lg font-bold text-primary">Wealth Manager</h1>
        <p className="text-xs text-muted-foreground mt-1">Osobné financie</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={lock}
        >
          <LogOut className="w-4 h-4" />
          Zamknúť
        </Button>
      </div>
    </aside>
  );
}
