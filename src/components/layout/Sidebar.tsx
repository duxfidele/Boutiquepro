"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import {
  LayoutDashboard, ClipboardList, Receipt,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Store,
  Truck,
  HelpCircle,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/products", label: "Produits & Stock", icon: Package },
  { href: "/inventory", label: "Inventaire", icon: ClipboardList },
  { href: "/pos", label: "Point de Vente", icon: ShoppingCart },
  { href: "/expenses", label: "Dépenses", icon: Receipt },
  { href: "/analytics", label: "Analytique", icon: BarChart3 },
  { href: "/orders", label: "Commandes", icon: Truck },
  { href: "/settings", label: "Paramètres", icon: Settings },
  { href: "/support", label: "Aide & Support", icon: HelpCircle },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { lowStockProducts, state } = useStore();

  return (
    <aside
      className={`print:hidden fixed z-40 lg:left-0 lg:top-0 bottom-0 w-full lg:h-screen flex flex-row lg:flex-col border-t lg:border-r lg:border-t-0 border-border/50 bg-sidebar transition-all duration-300 ease-out ${
        collapsed ? "lg:w-[72px]" : "lg:w-[260px]"
      }`}
    >
      {/* Logo / Brand */}
      <div className="hidden lg:flex h-16 items-center gap-3 border-b border-border/50 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white font-bold text-sm overflow-hidden">
          {state.settings.logo ? <img src={state.settings.logo} alt="Logo" className="w-full h-full object-cover" /> : state.settings.name.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="text-base font-bold text-gradient truncate">{state.settings.name}</h1>
            <p className="text-[10px] text-muted-foreground">Gestion Commerciale</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-x-auto lg:overflow-y-auto lg:py-4 lg:px-3 p-1.5 no-scrollbar flex items-center lg:block">
        <div className="flex flex-row lg:flex-col w-full justify-around lg:space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const showBadge = item.href === "/products" && lowStockProducts.length > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex lg:flex-row flex-col items-center justify-center lg:justify-start gap-1 lg:gap-3 rounded-xl px-2 lg:px-3 py-1.5 lg:py-2.5 text-[10px] lg:text-sm font-medium transition-all duration-200 flex-1 lg:flex-none ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-primary" : ""}`} />
                {!collapsed && (
                  <span className="truncate animate-fade-in hidden lg:block">{item.label}</span>
                )}
                {showBadge && (
                  <span className={`badge-pulse flex h-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white ${collapsed ? "absolute -right-1 -top-1 w-5" : "ml-auto min-w-[20px] px-1.5"}`}>
                    {lowStockProducts.length}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Store selector */}
      {!collapsed && (
        <div className="hidden lg:block border-t border-border/50 p-3 animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
            <Store className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{state.settings.name}</p>
              <p className="text-[10px] text-muted-foreground">Boutique principale</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="hidden lg:block border-t border-border/50 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-xl py-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
