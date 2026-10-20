"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import SubscriptionModal from "@/components/subscription/SubscriptionModal";
import { SubscriptionTier } from "@/lib/subscriptionPlans";
import {
  LogOut,
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  Receipt,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  Sparkles, ShieldCheck, Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Store,
  Truck,
  HelpCircle,
  Users,
  Lock,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: false },
  { href: "/pos", label: "Point de Vente", icon: ShoppingCart, adminOnly: false },
  { href: "/debts", label: "Carnet de Dettes", icon: BookOpen, adminOnly: false, proFeature: true },
  { href: "/products", label: "Produits & Stock", icon: Package, adminOnly: false },
  { href: "/inventory", label: "Inventaire", icon: ClipboardList, adminOnly: true, proFeature: true },
  { href: "/expenses", label: "Dépenses", icon: Receipt, adminOnly: true },
  { href: "/analytics", label: "Analytique", icon: BarChart3, adminOnly: true, proFeature: true },
  { href: "/orders", label: "Commandes", icon: Truck, adminOnly: true, proFeature: true },
  { href: "/team", label: "Mon Équipe", icon: Users, adminOnly: true, proFeature: true },
  { href: "/settings", label: "Paramètres", icon: Settings, adminOnly: true },
  { href: "/support", label: "Aide & Support", icon: HelpCircle, adminOnly: false },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { lowStockProducts, state, unpaidDebts } = useStore();
  const {
    user,
    role,
    signOut,
    stores,
    activeStore,
    setActiveStore,
    subscription,
    tier,
    limits,
    canOfferCredit,
    canUseInventory,
    canUseManualOrders,
    canUseAdvancedAnalytics,
    canManageTeam,
    hasMultiStore,
  } = useAuth();
  const [cashierName, setCashierName] = useState<string | null>(null);

  // Modal d'abonnement / mise à niveau
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalDefaultPlan, setSubModalDefaultPlan] = useState<SubscriptionTier>("PRO");

  useEffect(() => {
    const fetchCashier = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (activeStore && activeStore.role === "admin") {
        try {
          const { data: member } = await supabase
            .from("store_members")
            .select("user_id")
            .eq("store_id", activeStore.id)
            .eq("role", "cashier")
            .limit(1)
            .maybeSingle();

          if (member?.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", member.user_id)
              .maybeSingle();

            setCashierName(profile?.full_name || profile?.email || "Caissier");
          } else {
            setCashierName("Aucun caissier");
          }
        } catch {
          setCashierName("Aucun caissier");
        }
      } else {
        setCashierName(null);
      }
    };
    fetchCashier();
  }, [activeStore]);

  const handleCreateStore = async (storeName: string) => {
    if (!hasMultiStore || (stores && stores.length >= limits.maxStores)) {
      setSubModalDefaultPlan("BUSINESS");
      setSubModalOpen(true);
      return;
    }
    try {
      const { data: storeId, error } = await supabase.rpc("create_new_store", { p_name: storeName });
      if (error) throw error;
      if (storeId) {
        alert("Boutique créée avec succès !");
        window.location.reload();
      }
    } catch (e: any) {
      alert("Erreur lors de la création : " + e.message);
    }
  };

  const isStoreQuotaReached = Boolean(!hasMultiStore || (stores && stores.length >= limits.maxStores));

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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs overflow-hidden p-1 border border-border/40">
            <img src={state.settings.logo || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
          </div>
          {(!collapsed || isOpen) && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-base font-bold text-gradient truncate">MaBoutiquePro</h1>
              <p className="text-[10px] text-muted-foreground">Gestion Commerciale</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
          <div className="flex flex-col w-full space-y-1">
            {navItems
              .filter((item) => !item.adminOnly || role === "admin")
              .map((item) => {
                // Role based filtering : le caissier a accès à son tableau de bord, à la caisse, aux produits et au support
                if (role === "cashier" && !["/", "/pos", "/products", "/debts", "/support"].includes(item.href)) {
                  return null;
                }

                const isActive = pathname === item.href;
                const Icon = item.icon;
                const isProductsBadge = item.href === "/products" && Boolean(lowStockProducts && lowStockProducts.length > 0);
                const isDebtsBadge = item.href === "/debts" && Boolean(unpaidDebts && unpaidDebts.length > 0);
                const showBadge = isProductsBadge || isDebtsBadge;
                const badgeCount = isProductsBadge ? lowStockProducts?.length || 0 : isDebtsBadge ? unpaidDebts?.length || 0 : 0;
                const badgeColor = isDebtsBadge ? "bg-amber-500" : "bg-destructive";

                // Vérification du verrouillage Pro
                let isLockedForUser = false;
                if (item.href === "/debts" && !canOfferCredit) isLockedForUser = true;
                if (item.href === "/inventory" && !canUseInventory) isLockedForUser = true;
                if (item.href === "/orders" && !canUseManualOrders) isLockedForUser = true;
                if (item.href === "/analytics" && !canUseAdvancedAnalytics) isLockedForUser = true;
                if (item.href === "/team" && !canManageTeam) isLockedForUser = true;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={(e) => {
                      if (isLockedForUser) {
                        e.preventDefault();
                        setSubModalDefaultPlan("PRO");
                        setSubModalOpen(true);
                        if (onClose) onClose();
                      } else if (onClose) {
                        onClose();
                      }
                    }}
                    className={`group relative flex flex-row items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                    <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-primary" : ""}`} />
                    {!collapsed && (
                      <span className="truncate animate-fade-in flex-1">
                        {role === "cashier" && item.href === "/" ? "Mon Tableau de bord" : item.label}
                      </span>
                    )}
                    {isLockedForUser && !collapsed && (
                      <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">
                        <Lock className="w-2.5 h-2.5" />
                        PRO
                      </span>
                    )}
                    {showBadge && !isLockedForUser && (
                      <span
                        className={`badge-pulse flex h-5 items-center justify-center rounded-full ${badgeColor} text-[10px] font-bold text-white ${
                          collapsed ? "absolute -right-1 -top-1 w-5" : "ml-auto min-w-[20px] px-1.5"
                        }`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        </nav>

        {/* Store display / selector */}
        {!collapsed && (
          <div className="block border-t border-border/50 p-3 animate-fade-in space-y-2">
            {role === "admin" ? (
              /* ADMIN : Sélecteur de ses boutiques */
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                <Store className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <select
                    value={activeStore?.id || ""}
                    onChange={(e) => {
                      const s = stores.find((x) => x.id === e.target.value);
                      if (s) {
                        setActiveStore(s);
                        window.location.reload();
                      }
                    }}
                    className="w-full bg-transparent text-xs font-bold truncate outline-none cursor-pointer appearance-none text-foreground"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground truncate">
                    <span className="text-primary font-medium">{cashierName ? `Caisse: ${cashierName}` : "Gérant"}</span>
                  </p>
                </div>
              </div>
            ) : (
              /* CAISSIER : Boutique FIXE et VERROUILLÉE, aucun changement possible */
              <div className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2.5 border border-border/40">
                <Store className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{activeStore?.name || "Ma Boutique"}</p>
                  <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider">Caisse active</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bouton de création : STRICTEMENT RÉSERVÉ AUX ADMINS */}
        {!collapsed && role === "admin" && (
          <div className="px-3 pb-3">
            <button
              onClick={() => {
                if (isStoreQuotaReached) {
                  setSubModalDefaultPlan("BUSINESS");
                  setSubModalOpen(true);
                } else {
                  const name = window.prompt("Nom de la nouvelle boutique :");
                  if (name && name.trim().length > 0) {
                    handleCreateStore(name.trim());
                  }
                }
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl py-2 px-3 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-semibold"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">+</span>
                <span>Créer une boutique</span>
              </div>
              {isStoreQuotaReached && (
                <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[9px] font-black uppercase flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Business
                </span>
              )}
            </button>
          </div>
        )}

        {/* WIDGET COMPTE À REBOURS ABONNEMENT & ESSAI */}
        {role === "admin" && subscription && (
          <div className="px-3 pb-2 animate-fade-in">
            {!collapsed ? (
              <div
                onClick={() => {
                  setSubModalDefaultPlan(subscription.isTrial ? "PRO" : tier);
                  setSubModalOpen(true);
                }}
                className={`group relative cursor-pointer p-3 rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  subscription.isTrial
                    ? subscription.daysRemaining <= 3
                      ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60 text-amber-900 dark:text-amber-200"
                      : "bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/50 text-foreground"
                    : "bg-primary/5 border-primary/20 hover:border-primary/40 text-foreground"
                }`}
              >
                {/* En-tête du widget */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {subscription.isTrial ? (
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-[11px] font-black uppercase tracking-wider truncate">
                      {subscription.isTrial ? "Essai 14j (PRO)" : `Formule ${tier}`}
                    </span>
                  </div>

                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase shrink-0 ${
                      subscription.isTrial
                        ? subscription.daysRemaining <= 3
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-600 text-white"
                        : "bg-primary/20 text-primary"
                    }`}
                  >
                    {subscription.isTrial ? `J-${subscription.daysRemaining}` : "Actif"}
                  </span>
                </div>

                {/* Barre de progression dynamique */}
                {subscription.isTrial && (
                  <div className="space-y-1 mb-1.5">
                    <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          subscription.daysRemaining <= 3
                            ? "bg-amber-500"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500"
                        }`}
                        style={{
                          width: `${Math.max(8, Math.min(100, ((14 - subscription.daysRemaining) / 14) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground">
                      <span className="text-foreground font-bold">
                        {subscription.daysRemaining} jour{subscription.daysRemaining > 1 ? "s" : ""} restant{subscription.daysRemaining > 1 ? "s" : ""}
                      </span>
                      <span className="text-[9px] uppercase font-black text-primary group-hover:underline">
                        Activer
                      </span>
                    </div>
                  </div>
                )}

                {!subscription.isTrial && subscription.endsAt && (
                  <div className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>{subscription.daysRemaining} jours restants</span>
                    <span className="text-[9px] text-primary font-bold group-hover:underline">
                      Gérer
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Vue repliée (icône seule animée) */
              <button
                type="button"
                onClick={() => {
                  setSubModalDefaultPlan(subscription.isTrial ? "PRO" : tier);
                  setSubModalOpen(true);
                }}
                title={
                  subscription.isTrial
                    ? `Essai gratuit : ${subscription.daysRemaining} jours restants`
                    : `Formule ${tier}`
                }
                className="w-full relative flex items-center justify-center p-2 rounded-xl bg-secondary/60 hover:bg-secondary text-primary transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="absolute -top-1 -right-1 px-1 rounded-full bg-emerald-600 text-[8px] font-black text-white">
                  {subscription.daysRemaining}j
                </span>
              </button>
            )}
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex flex-col border-t border-border/50 p-3 gap-2">
          <Link
            href="/profile"
            prefetch={true}
            className="flex w-full items-center gap-3 rounded-xl py-2 px-3 hover:bg-secondary transition-colors group"
          >
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold uppercase shrink-0">
              {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {user?.user_metadata?.full_name || "Mon Profil"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
          </Link>
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

      {/* Modal d'abonnement ou mise à niveau */}
      <SubscriptionModal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        defaultPlan={subModalDefaultPlan}
      />
    </>
  );
}
