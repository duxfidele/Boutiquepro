"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import {
  Search,
  Bell,
  ShoppingCart,
  AlertTriangle,
  Sun,
  Moon,
  User,
  LogOut,
  Settings as SettingsIcon,
  X,
  Download,
} from "lucide-react";

export default function Header() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    }
  };

  const { user, signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const { lowStockProducts, state, formatPrice, todayRevenue, todayOrders, dispatch } = useStore();
  const pathname = usePathname();
  const [showNotif, setShowNotif] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  };

  const filteredProducts = searchQuery.length > 1
    ? state.products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="print:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-6">
      {/* Left - Page context */}
      <div className="flex items-center gap-4">{deferredPrompt && (
          <button onClick={handleInstall} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg glow-primary animate-fade-in">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Installer l&apos;App</span>
          </button>
        )}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            En ligne
          </span>
        </div>
      </div>

      {/* Center - Search */}
      <div className="relative flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher produits, ventes..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full rounded-xl border border-border/60 bg-secondary/30 py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setShowSearch(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {showSearch && filteredProducts.length > 0 && (
          <div className="absolute top-full mt-2 w-full rounded-xl border border-border/50 bg-popover p-2 shadow-soft-lg animate-scale-in">
            {filteredProducts.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href="/products"
                onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
              >
                <span className="text-xl">{p.image}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sku} • {formatPrice(p.price)}</p>
                </div>
                {p.stock <= p.minStock && (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        {/* Quick stats */}
        <div className="hidden lg:flex items-center gap-4 mr-4 text-xs">
          <div className="text-right">
            <p className="text-muted-foreground">Aujourd&apos;hui</p>
            <p className="font-semibold text-foreground">{formatPrice(todayRevenue)}</p>
          </div>
          <div className="h-8 w-px bg-border/50" />
          <div className="text-right">
            <p className="text-muted-foreground">Ventes</p>
            <p className="font-semibold text-foreground">{todayOrders}</p>
          </div>
        </div>

        {/* Quick sale */}
        <Link
          href="/pos"
          onClick={() => {
            if (pathname === '/pos') dispatch({ type: 'CLEAR_CART' });
          }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Nouvelle vente</span>
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
          >
            <Bell className="h-4.5 w-4.5 text-muted-foreground" />
            {lowStockProducts.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white badge-pulse">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border/50 bg-popover p-3 shadow-soft-lg animate-scale-in">
              <h3 className="text-sm font-semibold mb-2">Alertes de stock</h3>
              {lowStockProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucune alerte 🎉</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {lowStockProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg bg-destructive/5 p-2.5">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Stock: <span className="text-destructive font-semibold">{p.stock}</span> / Min: {p.minStock}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
        >
          {dark ? <Sun className="h-4.5 w-4.5 text-muted-foreground" /> : <Moon className="h-4.5 w-4.5 text-muted-foreground" />}
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-accent/80 text-white text-xs font-bold cursor-pointer hover:shadow-md transition-all active:scale-95"
          >
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border/50 bg-popover shadow-soft-lg animate-scale-in overflow-hidden">
              <div className="p-3 border-b border-border/50 bg-secondary/30">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Administrateur</p>
              </div>
              
              <div className="p-1">
                <Link
                  href="/profile"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  <User className="h-4 w-4" />
                  Mon Profil
                </Link>
                
                <Link
                  href="/settings"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  <SettingsIcon className="h-4 w-4" />
                  Paramètres Boutique
                </Link>

                <div className="h-px bg-border/50 my-1 mx-2" />

                <button
                  onClick={() => {
                    setShowProfile(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
