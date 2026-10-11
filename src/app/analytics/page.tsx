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
  BookOpen,
  Smartphone,
  CreditCard,
  Package,
  Target,
  FileSpreadsheet,
  Download,
  FileText,
  CheckCircle2,
  X,
  Wallet,
  Clock,
  Phone,
  MessageCircle,
  AlertTriangle,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import {
  exportSalesJournal,
  exportExpensesJournal,
  exportInventoryValuation,
  exportGeneralLedger,
  ExportFormat,
  DateFilterOptions
} from "@/lib/accountingExport";
import { ProductAvatar } from "@/components/ui/ProductAvatar";

const paymentLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
  credit: "Crédit Client",
};

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  mobile_money: <Smartphone className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  credit: <BookOpen className="h-4 w-4" />,
};

export default function AnalyticsPage() {
  const { 
    state, 
    formatPrice, 
    totalRevenue, 
    totalOrders, 
    averageBasket, 
    categorySales,
    unpaidDebts,
    totalDebtsAmount,
    totalCreditSales,
    totalRecoveredAmount,
    totalCollectedRevenue,
    recoveryRate,
    overdueDebtsCount,
    collectedNetProfit
  } = useStore();
  const [period, setPeriod] = useState<"all" | "today" | "week">("all");
  
  // Modal Export Comptable
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<"sales" | "expenses" | "inventory" | "ledger">("sales");
  const [exportPeriod, setExportPeriod] = useState<"all" | "month" | "last_month" | "week" | "today">("month");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");
  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(null);

  const handleRunExport = () => {
    const filter: DateFilterOptions = { period: exportPeriod };
    const currency = state.settings.currency || "FCFA";

    if (exportType === "sales") {
      exportSalesJournal(state.sales, currency, exportFormat, filter);
      setExportSuccessNotice("Journal des Ventes téléchargé avec succès !");
    } else if (exportType === "expenses") {
      exportExpensesJournal(state.expenses || [], currency, exportFormat, filter);
      setExportSuccessNotice("Journal des Dépenses téléchargé avec succès !");
    } else if (exportType === "inventory") {
      exportInventoryValuation(state.products, currency, exportFormat);
      setExportSuccessNotice("Valorisation des Stocks téléchargée avec succès !");
    } else if (exportType === "ledger") {
      exportGeneralLedger(state.sales, state.expenses || [], state.products, currency, exportFormat, filter);
      setExportSuccessNotice("Grand Livre & Compte de Résultat téléchargé !");
    }

    setTimeout(() => {
      setExportSuccessNotice(null);
      setShowExportModal(false);
    }, 1500);
  };

  // Computed analytics (Concordance stricte avec le tableau de bord et prise en compte des remises)
  const analytics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const filteredSales = state.sales.filter((s) => {
      if (period === "today") return s.createdAt.startsWith(today);
      if (period === "week") return s.createdAt >= weekAgo;
      return true;
    });

    const filteredExpenses = (state.expenses || []).filter((e) => {
      if (period === "today") return e.date?.startsWith(today);
      if (period === "week") return e.date >= weekAgo;
      return true;
    });

    // CA net encaissé
    const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const orders = filteredSales.length;
    const avgBasket = orders > 0 ? revenue / orders : 0;
    const totalDiscount = filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const totalTax = filteredSales.reduce((sum, s) => sum + (s.tax || 0), 0);
    // CA brut avant remises
    const grossRevenue = revenue + totalDiscount;
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Ventes par produit (avec prorata de remise pour concorder avec le montant net)
    const productSales: Record<string, { name: string; qty: number; revenue: number; image: string }> = {};
    filteredSales.forEach((sale) => {
      const discountRatio = sale.subtotal > 0 ? (sale.total / sale.subtotal) : 1;
      (sale.items || []).forEach((item) => {
        if (!productSales[item.productId]) {
          const product = state.products.find((p) => p.id === item.productId);
          productSales[item.productId] = { name: item.productName, qty: 0, revenue: 0, image: product?.image || "📦" };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].revenue += Math.round(item.total * discountRatio);
      });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);

    // Moyens de paiement
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
    filteredSales.forEach((sale) => {
      if (!paymentBreakdown[sale.paymentMethod]) {
        paymentBreakdown[sale.paymentMethod] = { count: 0, amount: 0 };
      }
      paymentBreakdown[sale.paymentMethod].count += 1;
      paymentBreakdown[sale.paymentMethod].amount += sale.total;
    });

    // Coût total des produits vendus (Achats)
    let totalCost = 0;
    filteredSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const product = state.products.find((p) => p.id === item.productId);
        if (product) {
          totalCost += (product.cost || 0) * item.quantity;
        }
      });
    });

    // BÉNÉFICE BRUT RÉEL : CA net facturé - Coût d'achat
    const grossProfit = revenue - totalCost;
    // BÉNÉFICE NET : Bénéfice brut - Dépenses
    const netProfit = grossProfit - totalExpenses;
    // Taux de marge réel calculé sur le CA net
    const marginRate = revenue > 0 ? ((grossProfit) / revenue) * 100 : 0;

    // Métriques Crédits & Recouvrement pour la période sélectionnée
    const creditSalesPeriod = filteredSales.filter(
      (s) => s.paymentMethod === "credit" || (s.remainingAmount !== undefined && s.remainingAmount > 0)
    );
    const periodCreditAmount = creditSalesPeriod.reduce((sum, s) => sum + s.total, 0);
    const periodRemainingDebts = creditSalesPeriod.reduce((sum, s) => sum + (s.remainingAmount ?? (s.paymentStatus === 'paid' ? 0 : s.total)), 0);
    const periodRecovered = creditSalesPeriod.reduce((sum, s) => sum + (s.amountPaid ?? (s.paymentStatus === 'paid' ? s.total : 0)), 0);
    const periodCollectedRevenue = Math.max(0, revenue - periodRemainingDebts);
    const periodRecoveryRate = periodCreditAmount > 0 ? Math.min(100, Math.round((periodRecovered / periodCreditAmount) * 100)) : 100;
    const periodCollectedNetProfit = periodCollectedRevenue - totalCost - totalExpenses;

    // Top clients débiteurs
    const debtorsMap: Record<string, { name: string; phone?: string; remaining: number; totalCredit: number; dueDate?: string }> = {};
    (state.sales || []).forEach((s) => {
      const rem = s.remainingAmount ?? (s.paymentMethod === 'credit' && s.paymentStatus !== 'paid' ? s.total : 0);
      if (rem > 0 && s.customerName) {
        const key = s.customerName.toLowerCase().trim();
        if (!debtorsMap[key]) {
          debtorsMap[key] = {
            name: s.customerName,
            phone: s.customerPhone,
            remaining: 0,
            totalCredit: 0,
            dueDate: s.dueDate
          };
        }
        debtorsMap[key].remaining += rem;
        debtorsMap[key].totalCredit += s.total;
        if (s.dueDate && (!debtorsMap[key].dueDate || s.dueDate < debtorsMap[key].dueDate!)) {
          debtorsMap[key].dueDate = s.dueDate;
        }
      }
    });
    const topDebtors = Object.values(debtorsMap).sort((a, b) => b.remaining - a.remaining).slice(0, 5);

    return { 
      revenue, 
      grossRevenue, 
      orders, 
      avgBasket, 
      totalDiscount, 
      totalTax, 
      totalCost,
      totalExpenses, 
      topProducts, 
      paymentBreakdown, 
      marginRate, 
      grossProfit,
      netProfit,
      periodCreditAmount,
      periodRemainingDebts,
      periodRecovered,
      periodCollectedRevenue,
      periodRecoveryRate,
      periodCollectedNetProfit,
      topDebtors
    };
  }, [state.sales, state.products, state.expenses, period]);

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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bouton Export Comptable */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shadow-sm active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Comptable (Excel / CSV)</span>
          </button>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
            {[
              { id: "all" as const, label: "Tout" },
              { id: "week" as const, label: "7 jours" },
              { id: "today" as const, label: "Aujourd'hui" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  period === p.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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

      {/* ================================================================ */}
      {/* SECTION CONCORDANCE FINANCIÈRE & ÉTAT DE RECOUVREMENT DES CRÉDITS */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/30 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Concordance Financière & Déduction Trésorerie / Crédits
              </h2>
              <p className="text-xs text-muted-foreground">
                Distinction comptable entre Chiffre d'Affaires Facturé et Trésorerie Réellement Encaissée
              </p>
            </div>
          </div>

          <a
            href="/debts"
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-xs hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <BookOpen className="w-4 h-4" />
            Gérer le Carnet de Dettes & Recouvrements →
          </a>
        </div>

        {/* 4 Concordance Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">1. CA Total Facturé</span>
            <div className="text-2xl font-black text-foreground mt-1">
              {formatPrice(analytics.revenue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ventes totales enregistrées</p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs text-emerald-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 2. Encaissé Réel (En Caisse)
            </span>
            <div className="text-2xl font-black text-emerald-500 mt-1">
              {formatPrice(analytics.periodCollectedRevenue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Comptant + Acomptes reçus</p>
          </div>

          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-xs text-rose-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 3. Crédits en Attente
            </span>
            <div className="text-2xl font-black text-rose-500 mt-1">
              {formatPrice(analytics.periodRemainingDebts)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reste dû à recouvrer</p>
          </div>

          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> 4. Taux de Recouvrement
            </span>
            <div className="text-2xl font-black text-primary mt-1">
              {analytics.periodRecoveryRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPrice(analytics.periodRecovered)} déjà recouvré</p>
          </div>
        </div>

        {/* Detailed Financial Deduction Table & Top Debtors Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Table de déduction et concordance stricte */}
          <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Tableau de Concordance de Trésorerie
            </h3>
            <p className="text-xs text-muted-foreground">
              Déduction exacte de l'argent disponible en poche vs le résultat comptable
            </p>

            <div className="space-y-2 pt-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted-foreground">Ventes payées au comptant (Espèces, MM, Carte) :</span>
                <span className="font-bold text-foreground">
                  {formatPrice(analytics.revenue - analytics.periodCreditAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-emerald-500 font-medium">(+) Versements & recouvrements encaissés :</span>
                <span className="font-bold text-emerald-500">
                  +{formatPrice(analytics.periodRecovered)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50 bg-secondary/30 px-2 rounded-lg font-bold">
                <span className="text-foreground">(=) TOTAL TRÉSORERIE RÉELLEMENT ENCAISSÉE :</span>
                <span className="text-emerald-500 font-black">
                  {formatPrice(analytics.periodCollectedRevenue)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-rose-500 font-medium">(+) Crédits accordés en attente de paiement :</span>
                <span className="font-bold text-rose-500">
                  +{formatPrice(analytics.periodRemainingDebts)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50 font-bold">
                <span className="text-foreground">(=) Chiffre d'affaires Global Facturé :</span>
                <span className="font-bold text-foreground">{formatPrice(analytics.revenue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-destructive font-medium">(-) Dépenses d'exploitation décaissées :</span>
                <span className="font-bold text-destructive">-{formatPrice(analytics.totalExpenses)}</span>
              </div>
              <div className="flex justify-between py-2 bg-primary/10 border border-primary/20 px-2 rounded-lg font-bold">
                <span className="text-primary font-bold">BÉNÉFICE NET RÉELLEMENT ENCAISSÉ :</span>
                <span className="text-primary font-black">
                  {formatPrice(Math.round(analytics.periodCollectedNetProfit))}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground/80 italic text-right">
                (Bénéfice théorique si tout était soldé : {formatPrice(Math.round(analytics.netProfit))})
              </div>
            </div>
          </div>

          {/* Top Débiteurs & Relances WhatsApp */}
          <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Créances Prioritaires à Recouvrer
                </h3>
                <p className="text-xs text-muted-foreground">Top clients ayant les plus gros arriérés</p>
              </div>
              <a href="/debts" className="text-xs text-primary font-bold hover:underline">
                Voir tout ({unpaidDebts.length}) →
              </a>
            </div>

            <div className="space-y-2.5 pt-2">
              {analytics.topDebtors.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/40 mb-2" />
                  Aucune créance client en attente. Votre trésorerie est à 100% à jour !
                </div>
              ) : (
                analytics.topDebtors.map((debtor) => {
                  const isOverdue = debtor.dueDate && new Date(debtor.dueDate) < new Date();
                  const waClean = debtor.phone ? (debtor.phone.replace(/\D/g, "").length === 8 ? "229" + debtor.phone.replace(/\D/g, "") : debtor.phone.replace(/\D/g, "")) : null;
                  const waMsg = encodeURIComponent(
                    `Bonjour ${debtor.name}, sauf erreur de notre part, il reste un solde de ${debtor.remaining.toLocaleString("fr-FR")} FCFA sur votre compte client auprès de ${state.settings.name || "BoutiquePro"}. Merci de nous contacter pour votre règlement.`
                  );
                  const waUrl = waClean ? `https://wa.me/${waClean}?text=${waMsg}` : null;

                  return (
                    <div
                      key={debtor.name}
                      className="p-3 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between text-xs hover:bg-secondary/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                          <span>{debtor.name}</span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 text-[10px] font-black">
                              Échéance dépassée
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {debtor.phone ? debtor.phone : "Pas de numéro"}
                          {debtor.dueDate ? ` • Échéance: ${new Date(debtor.dueDate).toLocaleDateString("fr-FR")}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-black text-rose-500 text-sm">
                            {formatPrice(debtor.remaining)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            sur {formatPrice(debtor.totalCredit)}
                          </div>
                        </div>

                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                            title="Relancer sur WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
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
                    <span className="text-xs text-muted-foreground">
                      {totalRevenue > 0 ? Math.min(100, Math.round((amount / totalRevenue) * 100)) : 0}%
                    </span>
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
              { label: "Chiffre d'affaires brut", value: formatPrice(analytics.grossRevenue), color: "text-foreground" },
              { label: "Remises accordées", value: `-${formatPrice(analytics.totalDiscount)}`, color: "text-amber-500 font-semibold" },
              { label: "Chiffre d'affaires net", value: formatPrice(analytics.revenue), color: "text-foreground font-semibold" },
              { label: "Coût des achats (produits)", value: `-${formatPrice(analytics.totalCost)}`, color: "text-muted-foreground" },
              { label: "Dépenses d'exploitation", value: `-${formatPrice(analytics.totalExpenses)}`, color: "text-destructive" },
              { label: "Bénéfice net (réel)", value: formatPrice(Math.round(analytics.netProfit)), color: "text-primary font-bold text-base" },
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION : CENTRE D'EXPORTATION COMPTABLE & FISCAL             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Centre d'Exportation Comptable & Fiscal
            </h2>
            <p className="text-xs text-muted-foreground">
              Générez vos journaux officiels conformes pour votre expert-comptable ou logiciels fiscaux
            </p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 self-start sm:self-auto">
            Formats Excel (.xls) & CSV
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 : Ventes */}
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Journal des Ventes
                </span>
                <span className="text-[10px] text-muted-foreground">{state.sales.length} ventes</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Détail de chaque encaissement, articles, remises et modes de règlement.
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => exportSalesJournal(state.sales, state.settings.currency, "excel")}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format Excel"
              >
                <FileSpreadsheet className="h-3 w-3" /> Excel
              </button>
              <button
                onClick={() => exportSalesJournal(state.sales, state.settings.currency, "csv")}
                className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format CSV"
              >
                <FileText className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>

          {/* Card 2 : Dépenses */}
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-orange-500" />
                  Journal des Dépenses
                </span>
                <span className="text-[10px] text-muted-foreground">{state.expenses?.length || 0} frais</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Charges d'exploitation, factures, loyers, salaires et frais divers.
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => exportExpensesJournal(state.expenses || [], state.settings.currency, "excel")}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format Excel"
              >
                <FileSpreadsheet className="h-3 w-3" /> Excel
              </button>
              <button
                onClick={() => exportExpensesJournal(state.expenses || [], state.settings.currency, "csv")}
                className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format CSV"
              >
                <FileText className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>

          {/* Card 3 : Valorisation Stocks */}
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-blue-500" />
                  Valorisation Stocks
                </span>
                <span className="text-[10px] text-muted-foreground">{state.products.length} réf.</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Inventaire physique, valorisation au coût d'achat et au prix de vente.
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => exportInventoryValuation(state.products, state.settings.currency, "excel")}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format Excel"
              >
                <FileSpreadsheet className="h-3 w-3" /> Excel
              </button>
              <button
                onClick={() => exportInventoryValuation(state.products, state.settings.currency, "csv")}
                className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format CSV"
              >
                <FileText className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>

          {/* Card 4 : Compte de Résultat */}
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  Compte de Résultat
                </span>
                <span className="text-[10px] text-muted-foreground">P&L Bilan</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Synthèse générale : CA, COGS, marge brute, charges et résultat net.
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => exportGeneralLedger(state.sales, state.expenses || [], state.products, state.settings.currency, "excel")}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format Excel"
              >
                <FileSpreadsheet className="h-3 w-3" /> Excel
              </button>
              <button
                onClick={() => exportGeneralLedger(state.sales, state.expenses || [], state.products, state.settings.currency, "csv")}
                className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1"
                title="Télécharger en format CSV"
              >
                <FileText className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL : EXPORT COMPTABLE SUR-MESURE AVEC FILTRES             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card border border-border/60 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Export Comptable & Fiscal</h3>
                  <p className="text-xs text-muted-foreground">Choisissez le document, la période et le format</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {exportSuccessNotice ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-bold text-foreground">{exportSuccessNotice}</p>
                <p className="text-xs text-muted-foreground">Le fichier s'est ouvert dans vos téléchargements.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Type de rapport */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-2">1. Type de document à exporter</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "sales" as const, label: "Journal des Ventes", desc: "Recettes & modes paiement" },
                      { id: "expenses" as const, label: "Journal des Dépenses", desc: "Charges & factures" },
                      { id: "inventory" as const, label: "Valorisation Stocks", desc: "Coûts, prix & marges" },
                      { id: "ledger" as const, label: "Compte de Résultat", desc: "Bilan global & bénéfice net" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setExportType(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          exportType === t.id 
                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/40 font-bold" 
                            : "border-border/50 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
                        }`}
                      >
                        <p className="text-xs font-bold text-foreground">{t.label}</p>
                        <p className="text-[10px] opacity-80 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Période (si applicable) */}
                {exportType !== "inventory" && (
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-2">2. Période couverte</label>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        { id: "month" as const, label: "Ce mois-ci" },
                        { id: "last_month" as const, label: "Mois dernier" },
                        { id: "week" as const, label: "7 derniers jours" },
                        { id: "today" as const, label: "Aujourd'hui" },
                        { id: "all" as const, label: "Tout l'historique" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setExportPeriod(p.id)}
                          className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                            exportPeriod === p.id 
                              ? "border-primary bg-primary/10 text-primary font-bold" 
                              : "border-border/50 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Format */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-2">
                    {exportType === "inventory" ? "2. Format du fichier" : "3. Format du fichier"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportFormat("excel")}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                        exportFormat === "excel"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500 font-bold"
                          : "border-border/50 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                      <div className="text-left">
                        <p className="text-xs font-bold text-foreground">Microsoft Excel (.xls)</p>
                        <p className="text-[10px] opacity-80">Mise en forme stylisée & totaux</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat("csv")}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                        exportFormat === "csv"
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary font-bold"
                          : "border-border/50 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <FileText className="h-6 w-6 text-primary" />
                      <div className="text-left">
                        <p className="text-xs font-bold text-foreground">Fichier CSV (.csv)</p>
                        <p className="text-[10px] opacity-80">Format standard universel (UTF-8)</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border/60 text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleRunExport}
                    className="flex-[1.5] py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger le document
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
