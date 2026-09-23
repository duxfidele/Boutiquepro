"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  usePathname } from "next/navigation";
import {
  useStore } from "@/context/StoreContext";
import {
  useAuth } from "@/context/AuthContext";
import {
  LogOut,
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

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { lowStockProducts, state } = useStore();
  const { signOut } = useAuth();

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onClick={onClose} />
      )}
      <aside
        className={`print:hidden fixed z-50 top-0 bottom-0 left-0 h-screen flex flex-col border-r border-border/50 bg-sidebar transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-[72px]" : "w-[260px]"}`}
      >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white font-bold text-sm overflow-hidden">
          {state.settings.logo ? <img src={state.settings.logo} alt="Logo" className="w-full h-full object-cover" /> : state.settings.name.charAt(0).toUpperCase()}
        </div>
        {(!collapsed || isOpen) && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="text-base font-bold text-gradient truncate">{state.settings.name}</h1>
            <p className="text-[10px] text-muted-foreground">Gestion Commerciale</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
        <div className="flex flex-col w-full space-y-1">
          {navItems.map((item) => {
            // Role based filtering
            const { role } = useAuth();
            if (role === 'cashier' && !['/pos', '/products', '/customers', '/orders'].includes(item.href)) {
              return null;
            }

            const isActive = pathname === item.href;
            const Icon = item.icon;
            const showBadge = item.href === "/products" && lowStockProducts.length > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group relative flex flex-row items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
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
                  <span className="truncate animate-fade-in">{item.label}</span>
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
        <div className="block border-t border-border/50 p-3 animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
            <Store className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{state.settings.name}</p>
              <p className="text-[10px] text-muted-foreground">Boutique principale</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex flex-col border-t border-border/50 p-3 gap-2">
        <button
          onClick={signOut}
          className="flex w-full items-center justify-center rounded-xl py-2 text-destructive hover:bg-destructive/10 transition-colors"
          title="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2 text-sm font-medium animate-fade-in">Déconnexion</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-xl py-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
    </>
  );
}
