"use client";

import React from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import {
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  ShoppingCart,
  BarChart3,
  CreditCard,
  Smartphone,
  Banknote,
} from "lucide-react";
import { ProductAvatar } from "@/components/ui/ProductAvatar";

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5" />,
  mobile_money: <Smartphone className="h-3.5 w-3.5" />,
  card: <CreditCard className="h-3.5 w-3.5" />,
};

const paymentLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
};

export default function Dashboard() {
  const {
    state,
    formatPrice,
    totalRevenue,
    todayRevenue,
    totalOrders,
    todayOrders,
    averageBasket,
    lowStockProducts,
    categorySales,
    totalExpenses,
    netProfit,
  } = useStore();

  const kpis = [
    {
      label: "Chiffre d'affaires",
      value: formatPrice(totalRevenue),
      subValue: `Aujourd'hui: ${formatPrice(todayRevenue)}`,
      icon: TrendingUp,
      trend: "+12.5%",
      trendUp: true,
      gradient: "from-primary/10 to-accent/10",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      label: "Bénéfice Net (Est.)",
      value: formatPrice(netProfit),
      subValue: "CA - Achats - Dépenses",
      icon: Banknote,
      trend: netProfit >= 0 ? "Positif" : "Négatif",
      trendUp: netProfit >= 0,
      gradient: netProfit >= 0 ? "from-accent/10 to-primary/5" : "from-destructive/10 to-destructive/5",
      iconBg: netProfit >= 0 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive",
    },
    {
      label: "Total Dépenses",
      value: formatPrice(totalExpenses),
      subValue: "Loyer, salaires, etc.",
      icon: Receipt,
      trend: "Charges",
      trendUp: false,
      gradient: "from-chart-3/10 to-chart-5/5",
      iconBg: "bg-chart-3/20 text-chart-3",
    },
    {
      label: "Stock critique",
      value: lowStockProducts.length.toString(),
      subValue: `Sur ${state.products.length} produits`,
      icon: AlertTriangle,
      trend: lowStockProducts.length > 0 ? "Attention" : "OK",
      trendUp: lowStockProducts.length === 0,
      gradient: lowStockProducts.length > 0 ? "from-destructive/10 to-destructive/5" : "from-accent/10 to-accent/5",
      iconBg: lowStockProducts.length > 0 ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent",
    },
  ];

  // Weekly sales chart data (simulated bar heights)
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const weeklyData = [65, 45, 80, 55, 90, 100, 70];

  // Category breakdown
  const categoryEntries = Object.entries(categorySales).sort((a, b) => b[1] - a[1]);
  const maxCategory = categoryEntries.length > 0 ? categoryEntries[0][1] : 1;

  const categoryColors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d&apos;ensemble de votre boutique — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/products" className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm hover:bg-secondary transition-colors">
            <Package className="h-4 w-4" />
            Produits
          </Link>
          <Link href="/pos" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
            <ShoppingCart className="h-4 w-4" />
            Nouvelle vente
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`group relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br ${kpi.gradient} p-5 hover-lift cursor-default`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  kpi.trendUp ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                }`}>
                  {kpi.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.trend}
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{kpi.subValue}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Sales Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold">Ventes hebdomadaires</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Performance de la semaine en cours</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-accent font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              +15.3% vs semaine précédente
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 h-48">
            {weekDays.map((day, i) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative flex items-end justify-center" style={{ height: "180px" }}>
                  <div
                    className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-primary to-primary/60 transition-all duration-500 hover:from-accent hover:to-accent/60 cursor-pointer"
                    style={{
                      height: `${weeklyData[i]}%`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <h2 className="text-base font-semibold mb-1">Répartition par catégorie</h2>
          <p className="text-xs text-muted-foreground mb-6">Chiffre d&apos;affaires par catégorie</p>
          <div className="space-y-4">
            {categoryEntries.map(([cat, amount], i) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{cat}</span>
                  <span className="text-xs text-muted-foreground">{formatPrice(amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${categoryColors[i % categoryColors.length]} transition-all duration-700`}
                    style={{ width: `${(amount / maxCategory) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Transactions récentes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Dernières ventes enregistrées</p>
            </div>
            <Link href="/analytics" className="text-xs text-primary hover:underline font-medium">
              Tout voir →
            </Link>
          </div>
          <div className="space-y-3">
            {state.sales.slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center gap-4 rounded-xl bg-secondary/30 p-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  {paymentIcons[sale.paymentMethod]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {sale.items.map((i) => i.productName).join(", ")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" • "}
                    {paymentLabels[sale.paymentMethod]}
                  </p>
                </div>
                <p className="text-sm font-semibold whitespace-nowrap">{formatPrice(sale.total)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & Low Stock Alerts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-border/40 bg-card p-6">
            <h2 className="text-base font-semibold mb-4">Actions rapides</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/pos", label: "Vente", icon: ShoppingCart, color: "bg-primary/10 text-primary hover:bg-primary/20" },
                { href: "/products", label: "Produit", icon: Package, color: "bg-accent/10 text-accent hover:bg-accent/20" },
                { href: "/analytics", label: "Rapports", icon: BarChart3, color: "bg-chart-3/15 text-chart-3 hover:bg-chart-3/25" },
                { href: "/products", label: "Stock", icon: AlertTriangle, color: "bg-chart-4/15 text-chart-4 hover:bg-chart-4/25" },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${action.color}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Low Stock */}
          {lowStockProducts.length > 0 && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-base font-semibold text-destructive">Stock critique</h2>
              </div>
              <div className="space-y-2.5">
                {lowStockProducts.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <ProductAvatar name={p.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-destructive/20 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-destructive"
                            style={{ width: `${Math.min(100, (p.stock / p.minStock) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-destructive font-semibold">{p.stock}/{p.minStock}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
