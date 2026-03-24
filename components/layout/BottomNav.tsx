"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, BarChart3, Sparkles, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const BOTTOM_TABS = [
  { href: "/dashboard", label: "Prehľad", icon: LayoutDashboard },
  { href: "/budget",    label: "Výdavky", icon: Receipt },
  { href: "/planning",  label: "Plán",    icon: BarChart3 },
  { href: "/advisor",   label: "AI",      icon: Sparkles },
];

interface BottomNavProps {
  onMoreClick: () => void;
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur-sm">
      <div className="grid grid-cols-5 h-16">
        {BOTTOM_TABS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
          Viac
        </button>
      </div>
    </nav>
  );
}
