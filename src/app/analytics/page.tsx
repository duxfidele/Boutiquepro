"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  BarChart3,
  TrendingUp,
  Trophy,
  DollarSign,
  ShoppingBag,
  Users,
  ArrowUpRight,
  Calendar,
  Banknote,
  Smartphone,
  CreditCard,
  Package,
  Target,
} from "lucide-react";
import { ProductAvatar } from "@/components/ui/ProductAvatar";

const paymentLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
};

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  mobile_money: <Smartphone className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
};

export default function AnalyticsPage() {
  const { state, formatPrice, totalRevenue, totalOrders, averageBasket, categorySales } = useStore();
  const [period, setPeriod] = useState<"all" | "today" | "week">("all");

  // Computed analytics
  const analytics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const filteredSales = state.sales.filter((s) => {
      if (period === "today") return s.createdAt.startsWith(today);
      if (period === "week") return s.createdAt >= weekAgo;
      return true;
    });

    const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const orders = filteredSales.length;
    const avgBasket = orders > 0 ? revenue / orders : 0;
    const totalDiscount = filteredSales.reduce((sum, s) => sum + s.discount, 0);
    const totalTax = filteredSales.reduce((sum, s) => sum + s.tax, 0);

    // Product sales ranking
    const productSales: Record<string, { name: string; qty: number; revenue: number; image: string }> = {};
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (!productSales[item.productId]) {
          const product = state.products.find((p) => p.id === item.productId);
          productSales[item.productId] = { name: item.productName, qty: 0, revenue: 0, image: product?.image || "📦" };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].revenue += item.total;
      });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);

    // Payment breakdown
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
    filteredSales.forEach((sale) => {
      if (!paymentBreakdown[sale.paymentMethod]) {
        paymentBreakdown[sale.paymentMethod] = { count: 0, amount: 0 };
      }
      paymentBreakdown[sale.paymentMethod].count += 1;
      paymentBreakdown[sale.paymentMethod].amount += sale.total;
    });

    // Margin analysis
    let totalCost = 0;
    let totalSaleRevenue = 0;
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const product = state.products.find((p) => p.id === item.productId);
        if (product) {
          totalCost += product.cost * item.quantity;
          totalSaleRevenue += item.total;
        }
      });
    });
    const marginRate = totalSaleRevenue > 0 ? ((totalSaleRevenue - totalCost) / totalSaleRevenue) * 100 : 0;
    const grossProfit = totalSaleRevenue - totalCost;

    return { revenue, orders, avgBasket, totalDiscount, totalTax, topProducts, paymentBreakdown, marginRate, grossProfit };
  }, [state.sales, state.products, period]);

  const categoryEntries = Object.entries(categorySales).sort((a, b) => b[1] - a[1]);
  const maxCategory = categoryEntries.length > 0 ? categoryEntries[0][1] : 1;
  const categoryColors = [
    "from-primary to-primary/60",
    "from-accent to-accent/60",
    "from-chart-3 to-chart-3/60",
    "from-chart-4 to-chart-4/60",
    "from-chart-5 to-chart-5/60",
  ];

  const kpis = [
    { label: "Chiffre d'affaires", value: formatPrice(analytics.revenue), icon: DollarSign, color: "bg-primary/10 text-primary" },
    { label: "Commandes", value: analytics.orders.toString(), icon: ShoppingBag, color: "bg-accent/10 text-accent" },
    { label: "Panier moyen", value: formatPrice(Math.round(analytics.avgBasket)), icon: Target, color: "bg-chart-3/15 text-chart-3" },
    { label: "Bénéfice brut", value: formatPrice(Math.round(analytics.grossProfit)), icon: TrendingUp, color: "bg-chart-5/15 text-chart-5" },
    { label: "Taux de marge", value: `${analytics.marginRate.toFixed(1)}%`, icon: BarChart3, color: "bg-chart-4/15 text-chart-4" },
    { label: "Clients", value: state.customers.length.toString(), icon: Users, color: "bg-info/15 text-info" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Rapports & Analytique
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyse détaillée de la performance de votre boutique
          </p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-2 bg-secondary/40 rounded-xl p-1">
          {[
            { id: "all" as const, label: "Tout" },
            { id: "week" as const, label: "7 jours" },
            { id: "today" as const, label: "Aujourd'hui" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                period === p.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-border/40 bg-card p-4 hover-lift cursor-default">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.color} mb-3`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-lg font-bold">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="h-5 w-5 text-chart-3" />
            <h2 className="text-base font-semibold">Produits les plus vendus</h2>
          </div>
          <div className="space-y-3">
            {analytics.topProducts.slice(0, 6).map((product, i) => (
              <div key={product.name} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  i === 0 ? "bg-yellow-500/10 text-yellow-600" :
                  i === 1 ? "bg-gray-400/10 text-gray-500" :
                  i === 2 ? "bg-amber-700/10 text-amber-700" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <ProductAvatar name={product.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground">{product.qty} vendus</p>
                </div>
                <p className="text-sm font-semibold whitespace-nowrap">{formatPrice(product.revenue)}</p>
              </div>
            ))}
            {analytics.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune vente pour cette période</p>
            )}
          </div>
        </div>

        {/* Revenue by Category */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Revenus par catégorie</h2>
          </div>
          <div className="space-y-4">
            {categoryEntries.map(([cat, amount], i) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{cat}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{((amount / totalRevenue) * 100).toFixed(0)}%</span>
                    <span className="text-sm font-semibold">{formatPrice(amount)}</span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${categoryColors[i % categoryColors.length]} transition-all duration-700`}
                    style={{ width: `${(amount / maxCategory) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {categoryEntries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <h2 className="text-base font-semibold mb-5">Moyens de paiement</h2>
          <div className="space-y-4">
            {Object.entries(analytics.paymentBreakdown).map(([method, data]) => {
              const percentage = analytics.orders > 0 ? ((data.count / analytics.orders) * 100).toFixed(0) : "0";
              return (
                <div key={method} className="flex items-center gap-4 rounded-xl bg-secondary/30 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                    {paymentIcons[method]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{paymentLabels[method]}</span>
                      <span className="text-sm font-bold">{formatPrice(data.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{data.count} ventes ({percentage}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(analytics.paymentBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune vente</p>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <h2 className="text-base font-semibold mb-5">Résumé financier</h2>
          <div className="space-y-3">
            {[
              { label: "Chiffre d'affaires brut", value: formatPrice(analytics.revenue), color: "text-foreground" },
              
              { label: "Remises accordées", value: `-${formatPrice(analytics.totalDiscount)}`, color: "text-accent" },
              { label: "Bénéfice brut", value: formatPrice(Math.round(analytics.grossProfit)), color: "text-primary font-bold" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-secondary/20 px-4 py-3">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}

            {/* Margin gauge */}
            <div className="mt-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 p-5 border border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Taux de marge global</span>
                <span className="text-2xl font-bold text-gradient">{analytics.marginRate.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                  style={{ width: `${Math.min(100, analytics.marginRate)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Customers */}
      <div className="rounded-2xl border border-border/40 bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Clients fidèles</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {state.customers.map((customer) => (
            <div key={customer.id} className="rounded-xl border border-border/40 p-4 hover-lift">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-sm font-bold text-primary">
                  {customer.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{customer.name}</p>
                  <p className="text-[10px] text-muted-foreground">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total achats</p>
                  <p className="text-sm font-bold">{formatPrice(customer.totalPurchases)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Dernière visite</p>
                  <p className="text-xs font-medium">{new Date(customer.lastVisit).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
