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
  TrendingUp,
  Sparkles,
  Settings,
  LogOut,
  Sun,
  Moon,
  Target,
  X,
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
  { href: "/goals", label: "Ciele", icon: Target },
  { href: "/advisor", label: "AI Poradca", icon: Sparkles },
  { href: "/settings", label: "Nastavenia", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { lock } = useApp();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-primary">Wealth Manager</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Osobné financie</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden -mr-1">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={onClose}>
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

      <div className="p-3 border-t border-border space-y-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
          {resolvedTheme === "dark" ? "Svetlý režim" : "Tmavý režim"}
        </Button>
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
