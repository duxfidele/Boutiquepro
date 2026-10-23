"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
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
  BookOpen,
  HelpCircle,
  Wallet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Phone,
  MessageCircle,
  Check,
  ShieldAlert,
  ShieldCheck,
  Calendar
} from "lucide-react";
import { ProductAvatar } from "@/components/ui/ProductAvatar";
import {
  DatePeriodFilter,
  PeriodType,
  toLocalDateString,
  formatDayDisplay,
  formatDayShort
} from "@/components/ui/DatePeriodFilter";

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5" />,
  mobile_money: <Smartphone className="h-3.5 w-3.5" />,
  card: <CreditCard className="h-3.5 w-3.5" />,
  credit: <BookOpen className="h-3.5 w-3.5" />,
};

const paymentLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
  credit: "Crédit Client",
};

export default function Dashboard() {
  const { role, activeStore } = useAuth();
  const router = useRouter();

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
    unpaidDebts,
    totalDebtsAmount,
    totalCreditSales,
    totalRecoveredAmount,
    totalCollectedRevenue,
    recoveryRate,
    overdueDebtsCount,
    collectedNetProfit,
    closedCashSessions,
    totalCashDifference,
    totalCashShortage,
    totalCashSurplus,
    todayCashDifference,
    todayCashShortage,
    cashDiscrepancyRate,
    totalPhysicalCashAndBank,
    discrepantSessionsCount,
    lastClosedCashSession,
    activeCashSession,
    currentSessionStats,
    currentSessionSales,
  } = useStore();

  const [period, setPeriod] = useState<PeriodType>("today");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return toLocalDateString(y);
  });
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalDateString(d);
  });
  const [endDate, setEndDate] = useState<string>(() => toLocalDateString(new Date()));

  const periodStats = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalDateString(now);

    // Semaine calendaire stricte : Lundi 00:00:00 -> Dimanche 23:59:59
    const currentDay = now.getDay(); // 0 = Dimanche, 1 = Lundi, ...
    const diffToMonday = (currentDay + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    const mondayStr = toLocalDateString(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const sundayStr = toLocalDateString(sunday);

    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const matchDate = (dStr: string) => {
      if (!dStr) return false;
      if (period === "today") return dStr === todayStr;
      if (period === "week") return dStr >= mondayStr && dStr <= sundayStr;
      if (period === "month") return dStr.startsWith(currentMonthStr);
      if (period === "all") return true;
      if (period === "custom_day") return dStr === selectedDate;
      if (period === "custom_range") {
        if (startDate && endDate) return dStr >= startDate && dStr <= endDate;
        if (startDate) return dStr >= startDate;
        if (endDate) return dStr <= endDate;
        return true;
      }
      return true;
    };

    // Ventes de la période sélectionnée avec déduplication stricte par ID unique
    const uniqueSalesMap = new Map<string, any>();
    (state.sales || []).forEach((s) => {
      if (s && s.id && !uniqueSalesMap.has(s.id)) {
        uniqueSalesMap.set(s.id, s);
      }
    });

    const filteredSales = Array.from(uniqueSalesMap.values()).filter((s) => {
      if (!s || !s.createdAt) return false;
      const d = new Date(s.createdAt);
      if (isNaN(d.getTime())) return false;
      const dStr = toLocalDateString(d);
      return matchDate(dStr);
    });

    // Dépenses de la période sélectionnée
    const filteredExpenses = (state.expenses || []).filter((e) => {
      if (!e || !e.date) return false;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return false;
      const dStr = toLocalDateString(d);
      return matchDate(dStr);
    });

    // Clôtures de caisse de la période sélectionnée
    const filteredSessions = (closedCashSessions || []).filter((cs) => {
      const rawDate = cs.closedAt || cs.openedAt;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return false;
      const dStr = toLocalDateString(d);
      return matchDate(dStr);
    });

    const revenue = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const ordersCount = filteredSales.length;

    // Dépenses totales sur la période
    const periodExpenses = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    // Coût d'achat des marchandises vendues (COGS) sur la période
    let totalCost = 0;
    filteredSales.forEach((s) => {
      (s.items || []).forEach((item) => {
        const prod = (state.products || []).find((p) => p.id === item.productId);
        if (prod) {
          totalCost += (Number(prod.cost) || 0) * (Number(item.quantity) || 0);
        }
      });
    });

    // Écarts & déficits de caisse sur la période
    const cashDiff = filteredSessions.reduce((acc, cs) => acc + (Number(cs.difference) || 0), 0);
    const cashShortage = filteredSessions
      .filter((cs) => (Number(cs.difference) || 0) < 0)
      .reduce((acc, cs) => acc + Math.abs(Number(cs.difference) || 0), 0);
    const cashSurplus = filteredSessions
      .filter((cs) => (Number(cs.difference) || 0) > 0)
      .reduce((acc, cs) => acc + (Number(cs.difference) || 0), 0);
    const discrepantCount = filteredSessions.filter((cs) => Math.abs(Number(cs.difference) || 0) > 0).length;

    // Crédits & recouvrement sur la période
    const creditSalesPeriod = filteredSales.filter(
      (s) => s && (s.paymentMethod === "credit" || (s.remainingAmount !== undefined && s.remainingAmount > 0))
    );
    const periodCreditAmount = creditSalesPeriod.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const periodRemainingDebts = creditSalesPeriod.reduce(
      (acc, s) => {
        if (!s) return acc;
        const total = Number.isFinite(Number(s.total)) ? Number(s.total) : 0;
        const paid = Number.isFinite(Number(s.amountPaid)) ? Number(s.amountPaid) : 0;
        const calculatedRem = Math.max(0, total - paid);
        const rem = (typeof s.remainingAmount === "number" && Number.isFinite(s.remainingAmount) && s.remainingAmount > 0)
          ? s.remainingAmount
          : calculatedRem;
        const isPaid = (s.paymentStatus === "paid" && paid >= total) || rem <= 0;
        return acc + (isPaid ? 0 : rem);
      },
      0
    );
    const periodCollected = Math.max(0, revenue - periodRemainingDebts);
    const physicalCashAndBank = Math.max(0, periodCollected - cashShortage);

    const grossProfit = revenue - totalCost;
    const netProfitPeriod = grossProfit - periodExpenses;
    const collectedNetProfitPeriod = periodCollected - totalCost - periodExpenses - cashShortage;

    return {
      revenue,
      ordersCount,
      periodExpenses,
      totalCost,
      cashDiff,
      cashShortage,
      cashSurplus,
      discrepantCount,
      sessionsCount: filteredSessions.length,
      periodCreditAmount,
      periodRemainingDebts,
      periodCollected,
      physicalCashAndBank,
      grossProfit,
      netProfit: netProfitPeriod,
      collectedNetProfit: collectedNetProfitPeriod,
      filteredSales,
      filteredSessions,
      monday,
      sunday,
    };
  }, [state.sales, state.expenses, state.products, closedCashSessions, period, selectedDate, startDate, endDate]);

  const periodLabel = useMemo(() => {
    if (period === "today") return "Aujourd'hui";
    if (period === "week") return "Cette Semaine";
    if (period === "month") return "Ce Mois-ci";
    if (period === "all") return "Tout l'historique";
    if (period === "custom_day") {
      if (!selectedDate) return "Jour sélectionné";
      const now = new Date();
      const todayStr = toLocalDateString(now);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterday);
      if (selectedDate === todayStr) return "Aujourd'hui";
      if (selectedDate === yesterdayStr) return `Hier (${formatDayDisplay(selectedDate)})`;
      return formatDayDisplay(selectedDate);
    }
    if (period === "custom_range") {
      if (startDate && endDate) {
        if (startDate === endDate) return formatDayDisplay(startDate);
        return `Du ${formatDayShort(startDate)} au ${formatDayShort(endDate)}`;
      }
      if (startDate) return `Depuis le ${formatDayShort(startDate)}`;
      if (endDate) return `Jusqu'au ${formatDayShort(endDate)}`;
      return "Période personnalisée";
    }
    return "Période";
  }, [period, selectedDate, startDate, endDate]);

  const adminKpis = [
    {
      label: `Chiffre d'affaires (${periodLabel})`,
      value: formatPrice(periodStats.revenue),
      subValue: period === "today" 
        ? `${periodStats.ordersCount} vente(s) enregistrée(s)`
        : `Aujourd'hui: ${formatPrice(todayRevenue)} • ${periodStats.ordersCount} vente(s)`,
      icon: TrendingUp,
      trend: periodLabel,
      trendUp: true,
      gradient: "from-primary/10 to-indigo-500/10",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      label: `Trésorerie Encaissée (${periodLabel})`,
      value: formatPrice(periodStats.physicalCashAndBank),
      subValue: periodStats.cashShortage > 0 
        ? `Théorique: ${formatPrice(periodStats.periodCollected)} • Manquant: -${formatPrice(periodStats.cashShortage)}`
        : "100% net en caisse & banque",
      icon: Wallet,
      trend: periodStats.cashShortage > 0 ? "Perte Caisse !" : "Encaissé Réel",
      trendUp: periodStats.cashShortage === 0,
      gradient: periodStats.cashShortage > 0 ? "from-amber-500/15 to-rose-500/10" : "from-emerald-500/15 to-emerald-500/5",
      iconBg: periodStats.cashShortage > 0 ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500",
    },
    {
      label: `Écarts de Caisse (${periodLabel})`,
      value: periodStats.cashDiff === 0 
        ? "0 FCFA" 
        : periodStats.cashDiff < 0 
          ? `-${formatPrice(Math.abs(periodStats.cashDiff))}` 
          : `+${formatPrice(periodStats.cashDiff)}`,
      subValue: periodStats.cashShortage > 0 
        ? `${periodStats.discrepantCount} clôture(s) avec déficit sur la période` 
        : `${periodStats.sessionsCount} clôture(s) enregistrée(s)`,
      icon: periodStats.cashShortage > 0 ? ShieldAlert : ShieldCheck,
      trend: periodStats.cashDiff < 0 ? "Manquant Caisse" : periodStats.cashDiff > 0 ? "Surplus" : "Conforme",
      trendUp: periodStats.cashDiff >= 0,
      gradient: periodStats.cashDiff < 0 ? "from-rose-500/15 to-rose-500/5" : "from-emerald-500/15 to-emerald-500/5",
      iconBg: periodStats.cashDiff < 0 ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-500",
    },
    {
      label: "Créances Clients (Reste Dû)",
      value: formatPrice(totalDebtsAmount),
      subValue: `${unpaidDebts.length} dossier(s) • ${overdueDebtsCount} en retard`,
      icon: BookOpen,
      trend: overdueDebtsCount > 0 ? "Retards !" : "À recouvrer",
      trendUp: overdueDebtsCount === 0,
      gradient: overdueDebtsCount > 0 ? "from-rose-500/15 to-rose-500/5" : "from-amber-500/15 to-amber-500/5",
      iconBg: overdueDebtsCount > 0 ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500",
    },
    {
      label: `Bénéfice Net Réel (${periodLabel})`,
      value: formatPrice(periodStats.collectedNetProfit),
      subValue: `Marge: ${formatPrice(periodStats.grossProfit)} • Dépenses: -${formatPrice(periodStats.periodExpenses)}`,
      icon: Banknote,
      trend: periodStats.collectedNetProfit >= 0 ? "Bénéfice Net" : "Déficit Réel",
      trendUp: periodStats.collectedNetProfit >= 0,
      gradient: periodStats.collectedNetProfit >= 0 ? "from-accent/15 to-primary/5" : "from-destructive/15 to-destructive/5",
      iconBg: periodStats.collectedNetProfit >= 0 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive",
    },
  ];

  const cashierLastDiff = Number(lastClosedCashSession?.difference) || 0;
  const cashierKpis = [
    {
      label: `CA Encaissé (${periodLabel})`,
      value: formatPrice(periodStats.physicalCashAndBank),
      subValue: `Aujourd'hui: ${formatPrice(todayRevenue)} • ${periodStats.ordersCount} vente(s)`,
      icon: TrendingUp,
      trend: periodLabel,
      trendUp: true,
      gradient: "from-primary/10 to-indigo-500/10",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      label: "Session Caisse Active",
      value: activeCashSession ? formatPrice(currentSessionStats.total) : "Caisse Fermée",
      subValue: activeCashSession 
        ? `${currentSessionStats.count} vente(s) • Tiroir: ${formatPrice(currentSessionStats.expectedCashInDrawer)}` 
        : "Compteur à 0 • Prêt pour ouverture",
      icon: Wallet,
      trend: activeCashSession ? "En cours" : "Fermée",
      trendUp: !!activeCashSession,
      gradient: activeCashSession ? "from-emerald-500/15 to-emerald-500/5" : "from-secondary to-muted/20",
      iconBg: activeCashSession ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
    },
    {
      label: `Écart de Caisse (${periodLabel})`,
      value: periodStats.cashDiff === 0 
        ? "0 FCFA" 
        : periodStats.cashDiff < 0 
          ? `-${formatPrice(Math.abs(periodStats.cashDiff))}` 
          : `+${formatPrice(periodStats.cashDiff)}`,
      subValue: periodStats.cashShortage > 0 
        ? `Déficit de -${formatPrice(periodStats.cashShortage)} sur la période` 
        : `${periodStats.sessionsCount} clôture(s) enregistrée(s)`,
      icon: (periodStats.cashDiff < 0 || (lastClosedCashSession && cashierLastDiff < 0)) ? ShieldAlert : ShieldCheck,
      trend: periodStats.cashDiff < 0 ? "Manquant Caisse !" : "Conforme",
      trendUp: periodStats.cashDiff >= 0,
      gradient: periodStats.cashDiff < 0 ? "from-rose-500/15 to-rose-500/5" : "from-emerald-500/15 to-emerald-500/5",
      iconBg: periodStats.cashDiff < 0 ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-500",
    },
    {
      label: "Créances Clients en Attente",
      value: formatPrice(totalDebtsAmount),
      subValue: `${unpaidDebts.length} créance(s) active(s)`,
      icon: BookOpen,
      trend: "À recouvrer",
      trendUp: false,
      gradient: "from-amber-500/15 to-amber-500/5",
      iconBg: "bg-amber-500/15 text-amber-500",
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
    }
  ];

  const kpis = role === 'cashier' ? cashierKpis : adminKpis;

  // Weekly sales chart data : Semaine calendaire stricte du Lundi au Dimanche (remise à 0 le lundi)
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const weeklyData = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  
  // Calcul du Lundi de la semaine en cours à 00:00:00
  const currentDayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi, ...
  const diffToMonday = (currentDayOfWeek + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7); // Exclusif

  let currentWeekTotal = 0;
  (state.sales || []).forEach((sale) => {
    if (!sale || !sale.createdAt) return;
    const saleDate = new Date(sale.createdAt);
    if (saleDate >= startOfWeek && saleDate < endOfWeek) {
      const dayIndex = (saleDate.getDay() + 6) % 7;
      weeklyData[dayIndex] += Number(sale.total) || 0;
      currentWeekTotal += Number(sale.total) || 0;
    }
  });

  const maxWeekly = Math.max(...weeklyData, 1);
  const weeklyPercentages = weeklyData.map((val) => (val / maxWeekly) * 100);
  const todayIndex = (now.getDay() + 6) % 7;

  // Category breakdown
  const categoryEntries = Object.entries(categorySales).sort((a, b) => b[1] - a[1]);
  const maxCategory = categoryEntries.length > 0 ? categoryEntries[0][1] : 1;



  const categoryColors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec Sélecteur de Période en 1 clic */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {role === 'cashier' ? "Mon Tableau de bord" : "Tableau de bord de Direction"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === 'cashier' 
              ? "Suivi de vos ventes, encaissements et crédits — " 
              : "Concordance financière, trésorerie et recouvrement — "}
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Sélecteur de Période & Calendrier */}
          <DatePeriodFilter
            period={period}
            setPeriod={setPeriod}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            periodLabel={periodLabel}
          />

          <div className="flex gap-2">
            <Link href="/debts" className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-500 px-3.5 py-2 text-sm font-semibold hover:bg-amber-500/20 transition-colors">
              <BookOpen className="h-4 w-4" />
              Carnet de Dettes ({unpaidDebts.length})
            </Link>
            <Link href="/pos" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm">
              <ShoppingCart className="h-4 w-4" />
              Nouvelle vente
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
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
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  kpi.trendUp ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                }`}>
                  {kpi.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.trend}
                </span>
              </div>
              <p className="text-2xl font-black tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-sans">{kpi.subValue}</p>
            </div>
          );
        })}
      </div>

            {/* ================================================================ */}
      {/* SECTION AUDIT & CONTRÔLE DES CAISSES : CLÔTURES & RAPPORTS Z */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                totalCashShortage > 0 
                  ? "bg-destructive/10 text-destructive border border-destructive/20" 
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {role === 'admin' ? "Audit Patron : Contrôle des Caisses & Clôtures (Rapports Z)" : "Audit & Clôtures de ma Caisse (Rapports Z)"}
                  {totalCashShortage > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-destructive text-white animate-pulse">
                      Déficit: -{formatPrice(totalCashShortage)}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Contrôle des montants attendus vs fonds réels déclarés lors des clôtures.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeCashSession ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Caisse Active : Ouverte (Fond: {formatPrice(activeCashSession.openingAmount)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-semibold">
                  Caisse Actuelle : Clôturée
                </span>
              )}
            </div>
          </div>

          {/* Alerte Patron Manquant */}
          {totalCashShortage > 0 && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-sm">Alerte Déficit de Caisse Constaté</p>
                <p className="font-medium text-destructive/90">
                  Un montant total de <span className="font-extrabold underline">{formatPrice(totalCashShortage)}</span> manque à l&apos;appel sur les clôtures de caisse enregistrées. Ce montant a été automatiquement déduit de votre trésorerie réelle.
                </p>
              </div>
            </div>
          )}

          {/* Tableau des Clôtures */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Date &amp; Heure Clôture</th>
                  <th className="py-2.5 px-3">Caissier / Opérateur</th>
                  <th className="py-2.5 px-3 text-right">Fond Initial</th>
                  <th className="py-2.5 px-3 text-right">Ventes Espèces</th>
                  <th className="py-2.5 px-3 text-right">Théorique Attendu</th>
                  <th className="py-2.5 px-3 text-right">Réel Compté</th>
                  <th className="py-2.5 px-3 text-right">Écart Constaté</th>
                  <th className="py-2.5 px-3">Motif / Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {closedCashSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      Aucune clôture de caisse enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  closedCashSessions.slice(0, 5).map((cs) => {
                    const diff = Number(cs.difference) || 0;
                    const hasShortage = diff < 0;
                    const hasSurplus = diff > 0;
                    return (
                      <tr key={cs.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-3 font-medium whitespace-nowrap">
                          {cs.closedAt ? new Date(cs.closedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td className="py-3 px-3 font-semibold text-foreground">
                          {cs.cashierName || "Gérant"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {formatPrice(cs.openingAmount || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {formatPrice(cs.totalCashSales || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {formatPrice(cs.expectedAmount || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {formatPrice(cs.closingAmount || 0)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {hasShortage ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-black text-xs">
                              <AlertTriangle className="w-3 h-3" />
                              -{formatPrice(Math.abs(diff))}
                            </span>
                          ) : hasSurplus ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-xs">
                              +{formatPrice(diff)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              0 F (Conforme)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground max-w-xs truncate italic">
                          {cs.notes || "Aucune remarque"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* ================================================================ */}
      {/* SECTION CONCORDANCE FINANCIÈRE & ÉTAT DE RECOUVREMENT DES CRÉDITS */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                Concordance Trésorerie & Recouvrement des Crédits
                {overdueDebtsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                    {overdueDebtsCount} retard(s)
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Déduction exacte : Chiffre d'affaires facturé vs Argent réellement encaissé en caisse
              </p>
            </div>
          </div>

          <Link
            href="/debts"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            Gérer le carnet & recouvrer <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 3 Pillars Summary avec synchronisation période */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/40">
            <div className="text-xs text-muted-foreground font-medium">1. Total Facturé ({periodLabel})</div>
            <div className="text-xl font-black text-foreground mt-1">
              {formatPrice(periodStats.revenue)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Ventes de la période ({periodStats.ordersCount} commande(s))
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 2. Encaissé Réel ({periodLabel})
            </div>
            <div className="text-xl font-black text-emerald-500 mt-1">
              {formatPrice(periodStats.periodCollected)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Fonds nets rentrés sur la période
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="text-xs text-rose-500 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 3. Crédits en Attente ({periodLabel})
            </div>
            <div className="text-xl font-black text-rose-500 mt-1">
              {formatPrice(periodStats.periodRemainingDebts)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Restes dus sur les ventes de la période
            </div>
          </div>
        </div>

        {/* Recovery Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground">
              Performance de Recouvrement des Dettes
            </span>
            <span className="font-bold text-primary">
              {recoveryRate}% ({formatPrice(totalRecoveredAmount)} déjà récupéré sur {formatPrice(totalCreditSales || totalDebtsAmount)})
            </span>
          </div>
          <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-500"
              style={{ width: `${recoveryRate}%` }}
            />
          </div>
        </div>

        {/* Overdue alert banner if any */}
        {overdueDebtsCount > 0 && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-rose-500 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Attention : {overdueDebtsCount} créance(s) client(s) ont dépassé la date d'échéance convenue.
              </span>
            </div>
            <Link
              href="/debts"
              className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors whitespace-nowrap"
            >
              Relancer sur WhatsApp
            </Link>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Sales Chart (Semaine du Lundi au Dimanche avec remise à 0 automatique) */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Ventes hebdomadaires</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  Du Lun. {startOfWeek.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au Dim. {new Date(startOfWeek.getTime() + 6 * 86400000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cycle hebdomadaire strict • Le graphique redémarre à zéro chaque lundi
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                Total semaine : {formatPrice(currentWeekTotal)}
              </span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 h-48">
            {weekDays.map((day, i) => {
              const isToday = i === todayIndex;
              const hasSales = weeklyData[i] > 0;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative flex items-end justify-center" style={{ height: "180px" }}>
                    <div
                      className={`w-full max-w-[42px] rounded-t-xl transition-all duration-500 cursor-pointer relative group ${
                        isToday
                          ? "bg-gradient-to-t from-emerald-500 to-emerald-400 shadow-md shadow-emerald-500/20"
                          : hasSales
                          ? "bg-gradient-to-t from-primary to-primary/60 hover:from-accent hover:to-accent/60"
                          : "bg-secondary/40 hover:bg-secondary/60"
                      }`}
                      style={{
                        height: `${Math.max(weeklyPercentages[i], hasSales ? 6 : 2)}%`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    >
                      {/* Tooltip interactif */}
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] font-bold px-2 py-1 rounded-lg border border-border shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {formatPrice(weeklyData[i])}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-[10px] font-semibold ${isToday ? "text-emerald-500 font-bold" : "text-muted-foreground"}`}>
                      {day}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 animate-pulse" title="Aujourd'hui" />
                    )}
                  </div>
                </div>
              );
            })}
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
        {/* Recent Transactions with Debt badges */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Transactions & Ventes ({periodLabel})</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodStats.filteredSales.length} opération(s) enregistrée(s)
              </p>
            </div>
            <Link href="/debts" className="text-xs text-primary hover:underline font-medium">
              Voir carnet de dettes →
            </Link>
          </div>
          <div className="space-y-3">
            {periodStats.filteredSales.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground italic rounded-xl bg-secondary/20 border border-dashed border-border/50">
                Aucune transaction enregistrée pour {periodLabel.toLowerCase()}.
              </div>
            ) : (
              periodStats.filteredSales.slice(0, 8).map((sale) => {
              const isCredit = sale.paymentMethod === "credit";
              const remaining = sale.remainingAmount ?? (isCredit ? sale.total : 0);
              const isSold = remaining <= 0;

              return (
                <div
                  key={sale.id}
                  className="flex items-center gap-4 rounded-xl bg-secondary/30 p-3.5 hover:bg-secondary/50 transition-colors"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isCredit ? "bg-amber-500/10 text-amber-500" : "bg-secondary text-muted-foreground"
                  }`}>
                    {paymentIcons[sale.paymentMethod] || <Receipt className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <span>{(sale.items || []).map((i) => i?.productName || "").join(", ") || "Vente"}</span>
                      {isCredit && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isSold 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : "bg-rose-500/10 text-rose-500"
                        }`}>
                          {isSold ? "Soldé" : `Dû: ${formatPrice(remaining)}`}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" • "}
                      {sale.customerName ? `Client: ${sale.customerName} • ` : ""}
                      {paymentLabels[sale.paymentMethod] || "Paiement"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black whitespace-nowrap">{formatPrice(sale.total)}</p>
                    {isCredit && !isSold && (
                      <p className="text-[10px] text-rose-500 font-semibold">Reste: {formatPrice(remaining)}</p>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Quick Actions & Low Stock */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/40 bg-card p-6">
            <h2 className="text-base font-semibold mb-4">Actions rapides</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/pos", label: "Caisse POS", icon: ShoppingCart, color: "bg-primary/10 text-primary hover:bg-primary/20" },
                { href: "/debts", label: "Recouvrement", icon: BookOpen, color: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" },
                { href: "/products", label: "Produits", icon: Package, color: "bg-accent/10 text-accent hover:bg-accent/20" },
                { href: "/analytics", label: "Analytique", icon: BarChart3, color: "bg-chart-3/15 text-chart-3 hover:bg-chart-3/25" },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${action.color}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-semibold">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Low Stock Alerts */}
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
