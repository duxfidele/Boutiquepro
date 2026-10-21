"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
} from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Accueil", icon: LayoutDashboard },
    { href: "/pos", label: "Caisse", icon: ShoppingCart },
    { href: "/products", label: "Produits", icon: Package },
    { href: "/settings", label: "Paramètres", icon: Settings },
  ];

  return (
    <nav
      aria-label="Navigation mobile"
      className="lg:hidden shrink-0 w-full z-40 bg-card border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom,0.6rem))] flex justify-around items-center select-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
            <span className="text-[11px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
