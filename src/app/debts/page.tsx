"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useStore, Sale, DebtPayment } from "@/context/StoreContext";
import { 
  BookOpen, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Phone, 
  MessageCircle, 
  CreditCard, 
  Wallet, 
  Calendar, 
  ArrowRight, 
  TrendingDown, 
  UserCheck, 
  Check, 
  X, 
  Printer, 
  History, 
  Receipt, 
  ShoppingCart,
  ArrowUpRight
} from "lucide-react";

export default function DebtsPage() {
  const { 
    state, 
    recordDebtPayment, 
    activeStore, 
    activeCashSession,
    formatPrice 
  } = useStore();

  const sales = useMemo(() => state?.sales || [], [state?.sales]);

  // Tab navigation: "debts" (créances) | "recovery" (journal des recouvrements)
  const [activeTab, setActiveTab] = useState<"debts" | "recovery">("debts");

  // Filters & search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "partial" | "paid" | "overdue">("all");

  // Modals
  const [selectedDebt, setSelectedDebt] = useState<Sale | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    debt: Sale;
    payment: DebtPayment;
    previousPaid: number;
    newRemaining: number;
  } | null>(null);

  // Payment Form State in Modal
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card">("cash");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // All sales that are credit or have debt tracking (issues du panier POS)
  const debtSales = useMemo(() => {
    return sales.filter(
      (s) => s.paymentMethod === "credit" || (s.remainingAmount !== undefined && s.remainingAmount > 0)
    );
  }, [sales]);

  // All recovery payments flattened across all debt sales
  const allRecoveryPayments = useMemo(() => {
    const list: Array<{ payment: DebtPayment; sale: Sale }> = [];
    (debtSales || []).forEach((sale) => {
      if (sale.payments && Array.isArray(sale.payments)) {
        sale.payments.forEach((p) => {
          list.push({ payment: p, sale });
        });
      }
    });
    return list.sort((a, b) => new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime());
  }, [debtSales]);

  // Statistics for Debts
  const stats = useMemo(() => {
    let totalDue = 0;
    let totalRecovered = 0;
    let activeDebtsCount = 0;
    let overdueDebtsCount = 0;
    const debtorNames = new Set<string>();
    const now = new Date();

    (debtSales || []).forEach((s) => {
      if (!s) return;
      const remaining = s.remainingAmount ?? (s.paymentStatus === "paid" ? 0 : s.total);
      const paid = s.amountPaid ?? (s.paymentStatus === "paid" ? s.total : 0);
      
      totalDue += remaining;
      totalRecovered += paid;
      
      if (remaining > 0) {
        activeDebtsCount++;
        if (s.customerName) debtorNames.add(s.customerName.toLowerCase().trim());

        if (s.dueDate) {
          const due = new Date(s.dueDate);
          if (due < now) overdueDebtsCount++;
        }
      }
    });

    // Recovery today
    const todayStr = new Date().toDateString();
    let todayRecovered = 0;
    let cashRecovered = 0;
    let mmRecovered = 0;

    allRecoveryPayments.forEach(({ payment }) => {
      if (new Date(payment.paidAt).toDateString() === todayStr) {
        todayRecovered += payment.amount;
      }
      if (payment.paymentMethod === "cash") cashRecovered += payment.amount;
      if (payment.paymentMethod === "mobile_money") mmRecovered += payment.amount;
    });

    return {
      totalDue,
      totalRecovered,
      activeDebtsCount,
      overdueDebtsCount,
      uniqueDebtorsCount: debtorNames.size || activeDebtsCount,
      todayRecovered,
      cashRecovered,
      mmRecovered
    };
  }, [debtSales, allRecoveryPayments]);

  // Filtered debts
  const filteredDebts = useMemo(() => {
    const now = new Date();
    return debtSales.filter((s) => {
      const remaining = s.remainingAmount ?? (s.paymentStatus === "paid" ? 0 : s.total);
      const isOverdue = remaining > 0 && s.dueDate && new Date(s.dueDate) < now;
      
      if (statusFilter === "unpaid" && (remaining <= 0 || (s.amountPaid && s.amountPaid > 0))) return false;
      if (statusFilter === "partial" && (remaining <= 0 || !s.amountPaid || s.amountPaid === 0)) return false;
      if (statusFilter === "paid" && remaining > 0) return false;
      if (statusFilter === "overdue" && !isOverdue) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const nameMatch = s.customerName?.toLowerCase().includes(query);
        const phoneMatch = s.customerPhone?.toLowerCase().includes(query);
        const idMatch = s.id.toLowerCase().includes(query);
        const descMatch = (s.items || []).some(i => i.productName.toLowerCase().includes(query));
        return nameMatch || phoneMatch || idMatch || descMatch;
      }

      return true;
    });
  }, [debtSales, statusFilter, search]);

  // Open Debt Detail / Payment modal
  const handleOpenDebtDetail = (debt: Sale) => {
    setSelectedDebt(debt);
    const rem = debt.remainingAmount ?? debt.total;
    setPaymentAmount(rem.toString());
    setPaymentMethod("cash");
    setPaymentNote("");
    setPaymentSuccess(null);
  };

  // Submit recovery payment
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const amt = parseFloat(paymentAmount);
    const currentRem = selectedDebt.remainingAmount ?? selectedDebt.total;
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmittingPayment(true);
    try {
      const effectiveAmount = Math.min(amt, currentRem);
      const previousPaid = selectedDebt.amountPaid || 0;
      const newRemaining = Math.max(0, currentRem - effectiveAmount);

      const paymentRecord = await recordDebtPayment(
        selectedDebt.id, 
        effectiveAmount, 
        paymentMethod,
        paymentNote
      );

      setPaymentSuccess(`Encaissement de ${effectiveAmount.toLocaleString("fr-FR")} FCFA enregistré avec succès !`);

      if (paymentRecord) {
        setTimeout(() => {
          setSelectedReceipt({
            debt: {
              ...selectedDebt,
              amountPaid: previousPaid + effectiveAmount,
              remainingAmount: newRemaining,
              paymentStatus: newRemaining === 0 ? "paid" : "partial"
            },
            payment: paymentRecord,
            previousPaid,
            newRemaining
          });
          setSelectedDebt(null);
          setPaymentSuccess(null);
        }, 800);
      } else {
        setTimeout(() => {
          setSelectedDebt(null);
          setPaymentSuccess(null);
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du versement.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // WhatsApp link generator for reminders
  const generateWhatsAppReminder = (debt: Sale) => {
    if (!debt.customerPhone) return null;
    let cleanPhone = debt.customerPhone.replace(/\D/g, "");
    if (cleanPhone.length === 8) cleanPhone = "229" + cleanPhone;
    
    const remaining = debt.remainingAmount ?? debt.total;
    const storeName = activeStore?.name || "Notre Boutique";
    const msg = encodeURIComponent(
      `Bonjour ${debt.customerName || "cher client"}, nous vous remercions pour votre confiance auprès de ${storeName}. ` +
      `Sauf erreur de notre part, il reste un solde de ${remaining.toLocaleString("fr-FR")} FCFA sur votre achat (Réf: #${debt.id.slice(-6)}). ` +
      `Merci de nous contacter pour votre règlement. Excellente journée !`
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  // WhatsApp link for recovery receipt confirmation
  const generateWhatsAppReceiptMessage = (debt: Sale, payment: DebtPayment, rem: number) => {
    if (!debt.customerPhone) return null;
    let cleanPhone = debt.customerPhone.replace(/\D/g, "");
    if (cleanPhone.length === 8) cleanPhone = "229" + cleanPhone;
    
    const storeName = activeStore?.name || "Notre Boutique";
    const statusTxt = rem === 0 ? "Votre dette est désormais TOTALEMENT SOLDÉE. Félicitations !" : `Il vous reste un solde de ${rem.toLocaleString("fr-FR")} FCFA.`;
    const msg = encodeURIComponent(
      `Bonjour ${debt.customerName || "cher client"},\n\n` +
      `Nous confirmons la bonne réception de votre versement de ${payment.amount.toLocaleString("fr-FR")} FCFA effectué le ${new Date(payment.paidAt).toLocaleDateString("fr-FR")} auprès de ${storeName}.\n\n` +
      `Quittance N° #${payment.id.slice(-6)}\n` +
      `${statusTxt}\n\n` +
      `Merci pour votre fidélité et bonne journée !`
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  const handlePrintReceipt = () => {
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Carnet de Dettes & Recouvrement
            </h1>
            <p className="text-sm text-muted-foreground">
              Suivi des crédits clients issus de la caisse, encaissement des acomptes et quittances officielles.
            </p>
          </div>
        </div>

        {/* Action Button: Lien direct vers la Caisse POS */}
        <Link
          href="/pos"
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Nouvelle vente en caisse</span>
        </Link>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-border/50 gap-2">
        <button
          onClick={() => setActiveTab("debts")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "debts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Créances Clients</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-500 font-bold">
            {stats.activeDebtsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("recovery")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "recovery"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Journal des Recouvrements</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-500 font-bold">
            {allRecoveryPayments.length}
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: CRÉANCES CLIENTS */}
      {/* ============================================================== */}
      {activeTab === "debts" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Total Créances Dues</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-rose-500">
                  {stats.totalDue.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">À recouvrer auprès des clients</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Créances en cours</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-amber-500">
                  {stats.activeDebtsCount} <span className="text-xs font-normal font-sans">dossier(s)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Dont <strong className="text-rose-500">{stats.overdueDebtsCount}</strong> en retard d'échéance
                </p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Clients Débiteurs</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-blue-400">
                  {stats.uniqueDebtorsCount} <span className="text-xs font-normal font-sans">client(s)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Portefeuille de débiteurs actifs</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Total Recouvré</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-emerald-400">
                  {stats.totalRecovered.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Acomptes & dettes déjà encaissées</p>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher client, téléphone, article..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Toutes ({debtSales.length})
              </button>
              <button
                onClick={() => setStatusFilter("unpaid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === "unpaid"
                    ? "bg-rose-500 text-white shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Non payées
              </button>
              <button
                onClick={() => setStatusFilter("partial")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === "partial"
                    ? "bg-amber-500 text-white shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Partielles
              </button>
              <button
                onClick={() => setStatusFilter("overdue")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === "overdue"
                    ? "bg-red-600 text-white shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                En retard ({stats.overdueDebtsCount})
              </button>
              <button
                onClick={() => setStatusFilter("paid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === "paid"
                    ? "bg-emerald-500 text-white shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Soldées
              </button>
            </div>
          </div>

          {/* Debts Table */}
          <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Date & Échéance</th>
                    <th className="py-3.5 px-4">Articles du Panier</th>
                    <th className="py-3.5 px-4 text-right">Montant Total</th>
                    <th className="py-3.5 px-4 text-right">Déjà Payé</th>
                    <th className="py-3.5 px-4 text-right">Reste Dû</th>
                    <th className="py-3.5 px-4 text-center">Statut</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredDebts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-muted-foreground">
                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="font-semibold text-base text-foreground">Aucune créance enregistrée</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                          {search 
                            ? "Aucun résultat pour cette recherche." 
                            : "Les ventes passées en caisse avec le mode 'Crédit Client' ou avec un acompte partiel apparaîtront automatiquement ici."}
                        </p>
                        <Link
                          href="/pos"
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Effectuer une vente à crédit en caisse
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    filteredDebts.map((debt) => {
                      const remaining = debt.remainingAmount ?? (debt.paymentStatus === "paid" ? 0 : debt.total);
                      const paid = debt.amountPaid ?? (debt.paymentStatus === "paid" ? debt.total : 0);
                      const isFullyPaid = remaining <= 0;
                      const isPartial = paid > 0 && remaining > 0;
                      const isOverdue = remaining > 0 && debt.dueDate && new Date(debt.dueDate) < new Date();
                      const waLink = generateWhatsAppReminder(debt);
                      const itemsDesc = (debt.items || []).map((i) => `${i.quantity}x ${i.productName}`).join(", ") || debt.notes || "Achat à crédit";

                      return (
                        <tr key={debt.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground">
                              {debt.customerName || "Client non spécifié"}
                            </div>
                            {debt.customerPhone ? (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-primary/70" /> {debt.customerPhone}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground/50 italic">Pas de numéro</div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="text-xs text-foreground font-medium">
                              {new Date(debt.createdAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              })}
                            </div>
                            {debt.dueDate ? (
                              <div className={`text-[11px] flex items-center gap-1 mt-0.5 font-semibold ${isOverdue ? "text-rose-500" : "text-muted-foreground"}`}>
                                <Calendar className="w-3 h-3" />
                                Échéance: {new Date(debt.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                {isOverdue && <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 text-[10px]">Retard</span>}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground/50">Sans échéance</div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-[200px]">
                            <div className="truncate text-xs text-foreground" title={itemsDesc}>
                              {itemsDesc}
                            </div>
                            {debt.notes && debt.notes !== itemsDesc && (
                              <div className="truncate text-[11px] text-muted-foreground italic">
                                Note: {debt.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-medium text-foreground whitespace-nowrap">
                            {debt.total.toLocaleString("fr-FR")} F
                          </td>

                          <td className="py-3.5 px-4 text-right text-emerald-500 font-semibold whitespace-nowrap">
                            {paid.toLocaleString("fr-FR")} F
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                            <span className={remaining > 0 ? "text-rose-500 text-sm" : "text-emerald-500 text-sm"}>
                              {remaining.toLocaleString("fr-FR")} F
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isFullyPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Check className="w-3 h-3" /> Soldé
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Clock className="w-3 h-3" /> Partiel
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" /> Non payé
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Reminder */}
                              {waLink && remaining > 0 && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Envoyer un rappel de paiement sur WhatsApp"
                                  className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors inline-flex items-center justify-center"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}

                              {/* Recouvrer / Consulter */}
                              <button
                                onClick={() => handleOpenDebtDetail(debt)}
                                className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 shadow-sm ${
                                  remaining > 0
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                }`}
                              >
                                {remaining > 0 ? (
                                  <>
                                    <Wallet className="w-3.5 h-3.5" />
                                    Recouvrer
                                  </>
                                ) : (
                                  <>
                                    <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                                    Détails & Reçus
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: JOURNAL DES RECOUVREMENTS */}
      {/* ============================================================== */}
      {activeTab === "recovery" && (
        <div className="space-y-6">
          {/* Recovery KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Recouvré Aujourd'hui</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-emerald-400">
                  {stats.todayRecovered.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Encaissements de la journée</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Cumul Recouvrements</span>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-primary">
                  {stats.totalRecovered.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{allRecoveryPayments.length} versements enregistrés</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Espèces (En caisse)</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-blue-400">
                  {stats.cashRecovered.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Crédités dans le tiroir caisse</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Mobile Money</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Phone className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-amber-500">
                  {stats.mmRecovered.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Règlements Wave / Orange / MTN</p>
              </div>
            </div>
          </div>

          {/* Recovery Log Table */}
          <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">Historique chronologique des versements</h3>
                <p className="text-xs text-muted-foreground">Toutes les quittances d'encaissement délivrées aux clients</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3.5 px-4">Date & Heure</th>
                    <th className="py-3.5 px-4">Réf Quittance</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4 text-right">Montant Versé</th>
                    <th className="py-3.5 px-4">Caissier / Note</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {allRecoveryPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-muted-foreground">
                        <Receipt className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="font-semibold text-base text-foreground">Aucun versement de recouvrement enregistré</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Les versements d'acomptes et de remboursement de vos clients apparaîtront automatiquement ici.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    allRecoveryPayments.map(({ payment, sale }) => {
                      const remaining = sale.remainingAmount ?? 0;
                      return (
                        <tr key={payment.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-medium text-foreground text-xs">
                              {new Date(payment.paidAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              })}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(payment.paidAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                              #{payment.id.slice(-6)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground text-xs">
                              {sale.customerName || "Client non spécifié"}
                            </div>
                            {sale.customerPhone && (
                              <div className="text-[11px] text-muted-foreground">
                                {sale.customerPhone}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-secondary font-medium">
                              {payment.paymentMethod === "cash" ? "💵 Espèces" : payment.paymentMethod === "mobile_money" ? "📱 Mobile Money" : "💳 Carte"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-emerald-500 text-sm whitespace-nowrap">
                            +{payment.amount.toLocaleString("fr-FR")} FCFA
                          </td>

                          <td className="py-3.5 px-4 max-w-[180px]">
                            <div className="text-xs text-foreground font-medium truncate">
                              {payment.cashierName || "Caissier"}
                            </div>
                            {payment.note && (
                              <div className="text-[11px] text-muted-foreground italic truncate">
                                {payment.note}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Print Receipt */}
                              <button
                                onClick={() => setSelectedReceipt({
                                  debt: sale,
                                  payment,
                                  previousPaid: Math.max(0, (sale.amountPaid || 0) - payment.amount),
                                  newRemaining: remaining
                                })}
                                className="px-2.5 py-1.5 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors flex items-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5 text-primary" />
                                Quittance
                              </button>

                              {/* WhatsApp share */}
                              {sale.customerPhone && (
                                <a
                                  href={generateWhatsAppReceiptMessage(sale, payment, remaining) || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                  title="Partager la quittance sur WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: FICHE CRÉANCE & ENCAISSEMENT RECOUVREMENT */}
      {/* ============================================================== */}
      {selectedDebt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-2xl border border-border/80 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Fiche Créance & Recouvrement</h3>
                  <p className="text-xs text-muted-foreground">
                    Client : <strong className="text-foreground">{selectedDebt.customerName || "Inconnu"}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDebt(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <p className="text-emerald-500 font-bold">{paymentSuccess}</p>
                <p className="text-xs text-muted-foreground">Génération de la quittance en cours...</p>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {/* Financial Overview Card */}
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Dossier / Facture :</span>
                    <span className="font-mono font-bold text-foreground">#{selectedDebt.id.slice(-6)}</span>
                  </div>

                  {selectedDebt.customerPhone && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Téléphone :</span>
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3 text-primary" /> {selectedDebt.customerPhone}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Articles achetés :</span>
                    <span className="font-medium text-foreground truncate max-w-[250px]">
                      {(selectedDebt.items || []).map(i => `${i.quantity}x ${i.productName}`).join(", ") || "Vente"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Montant total initial :</span>
                    <span className="font-bold text-foreground">{selectedDebt.total.toLocaleString("fr-FR")} FCFA</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Total déjà recouvré :</span>
                    <span className="font-bold text-emerald-500">
                      {(selectedDebt.amountPaid || 0).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                    <span className="font-black text-rose-500 text-sm">RESTE DÛ À RECOUVRER :</span>
                    <span className="font-black text-rose-500 text-lg">
                      {(selectedDebt.remainingAmount ?? selectedDebt.total).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-1">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, Math.round(((selectedDebt.amountPaid || 0) / selectedDebt.total) * 100))}%` 
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground text-right">
                    {Math.round(((selectedDebt.amountPaid || 0) / selectedDebt.total) * 100)}% remboursé
                  </div>
                </div>

                {/* SECTION 1: ENCAISSER UN VERSEMENT (Si reste > 0) */}
                {(selectedDebt.remainingAmount ?? selectedDebt.total) > 0 ? (
                  <form onSubmit={handleConfirmPayment} className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">
                        Encaisser un versement de recouvrement
                      </h4>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Montant du versement (FCFA) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedDebt.remainingAmount ?? selectedDebt.total}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/80 text-foreground text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />

                      {/* Quick percentage buttons */}
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(Math.round((selectedDebt.remainingAmount ?? selectedDebt.total) * 0.25).toString())}
                          className="px-2.5 py-1 rounded-lg bg-secondary text-xs hover:bg-secondary/80 font-medium"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(Math.round((selectedDebt.remainingAmount ?? selectedDebt.total) * 0.5).toString())}
                          className="px-2.5 py-1 rounded-lg bg-secondary text-xs hover:bg-secondary/80 font-medium"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentAmount((selectedDebt.remainingAmount ?? selectedDebt.total).toString())}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 font-bold ml-auto"
                        >
                          Solder tout (100%)
                        </button>
                      </div>
                    </div>

                    {/* Mode d'encaissement */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Mode de paiement
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1.5 transition-all ${
                            paymentMethod === "cash"
                              ? "bg-primary/10 border-primary text-primary shadow-sm font-bold"
                              : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Espèces</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("mobile_money")}
                          className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1.5 transition-all ${
                            paymentMethod === "mobile_money"
                              ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow-sm font-bold"
                              : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <Phone className="w-4 h-4" />
                          <span>Mobile Money</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("card")}
                          className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1.5 transition-all ${
                            paymentMethod === "card"
                              ? "bg-blue-500/10 border-blue-500 text-blue-500 shadow-sm font-bold"
                              : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Carte</span>
                        </button>
                      </div>
                      {paymentMethod === "cash" && activeCashSession && (
                        <p className="text-[11px] text-emerald-500 mt-2 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Sera automatiquement ajouté au tiroir de votre session de caisse en cours.
                        </p>
                      )}
                    </div>

                    {/* Optional Note */}
                    <div>
                      <input
                        type="text"
                        placeholder="Note ou commentaire (facultatif)"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/50 border border-border/70 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDebt(null)}
                        className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs hover:bg-secondary/80 transition-colors"
                      >
                        Fermer
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {isSubmittingPayment ? "Enregistrement..." : "Valider & Quittance"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-emerald-500 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Dette totalement soldée
                    </div>
                    <p className="text-xs text-muted-foreground">Ce client a réglé l'intégralité de sa créance.</p>
                  </div>
                )}

                {/* SECTION 2: HISTORIQUE DES VERSEMENTS DE CE CLIENT */}
                {selectedDebt.payments && selectedDebt.payments.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-border/50">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-primary" />
                      Versements effectués ({selectedDebt.payments.length})
                    </h4>

                    <div className="space-y-2">
                      {selectedDebt.payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-secondary/40 border border-border/40 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-foreground">
                              +{p.amount.toLocaleString("fr-FR")} FCFA
                              <span className="ml-2 font-normal text-muted-foreground text-[11px]">
                                ({p.paymentMethod === "cash" ? "Espèces" : p.paymentMethod === "mobile_money" ? "Mobile Money" : "Carte"})
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(p.paidAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} à {new Date(p.paidAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              {p.note && ` • Note: ${p.note}`}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceipt({
                                debt: selectedDebt,
                                payment: p,
                                previousPaid: Math.max(0, (selectedDebt.amountPaid || 0) - p.amount),
                                newRemaining: selectedDebt.remainingAmount ?? 0
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" /> Reçu
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: QUITTANCE / REÇU DE RECOUVREMENT IMPRIMABLE */}
      {/* ============================================================== */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-2xl border border-border/80 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="font-bold text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-primary" /> Quittance Officielle
              </span>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div className="receipt-printable my-4 p-4 rounded-xl bg-white text-black font-mono text-xs shadow-inner border border-gray-200">
              <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-0.5">
                <h2 className="text-sm font-black uppercase tracking-wider">{activeStore?.name || "BOUTIQUE PRO"}</h2>
                <p className="text-[10px] text-gray-600">QUITTANCE DE RECOUVREMENT</p>
                <p className="text-[10px] text-gray-500">Réf: #{selectedReceipt.payment.id.slice(-6)}</p>
                <p className="text-[10px] text-gray-500">
                  {new Date(selectedReceipt.payment.paidAt).toLocaleDateString("fr-FR")} à {new Date(selectedReceipt.payment.paidAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Client :</span>
                  <span className="font-bold">{selectedReceipt.debt.customerName || "Client"}</span>
                </div>
                {selectedReceipt.debt.customerPhone && (
                  <div className="flex justify-between">
                    <span>Téléphone :</span>
                    <span>{selectedReceipt.debt.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Vente N° :</span>
                  <span>#{selectedReceipt.debt.id.slice(-6)}</span>
                </div>
              </div>

              <div className="py-3 border-b border-dashed border-gray-400 space-y-1.5">
                <div className="flex justify-between font-black text-sm text-black">
                  <span>MONTANT REÇU :</span>
                  <span>{selectedReceipt.payment.amount.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-600">
                  <span>Mode de paiement :</span>
                  <span className="capitalize">{selectedReceipt.payment.paymentMethod}</span>
                </div>
              </div>

              <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Total achat initial :</span>
                  <span>{selectedReceipt.debt.total.toLocaleString("fr-FR")} F</span>
                </div>
                <div className="flex justify-between">
                  <span>Total déjà payé :</span>
                  <span>{(selectedReceipt.debt.amountPaid || selectedReceipt.payment.amount).toLocaleString("fr-FR")} F</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-300">
                  <span>NOUVEAU SOLDE DÛ :</span>
                  <span className={selectedReceipt.newRemaining === 0 ? "text-green-700" : "text-red-700"}>
                    {selectedReceipt.newRemaining.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              </div>

              <div className="pt-3 text-center space-y-1">
                <p className="text-[10px] font-bold">
                  {selectedReceipt.newRemaining === 0 ? "★ DETTE TOTALEMENT SOLDÉE ★" : "★ MERCI POUR VOTRE VERSEMENT ★"}
                </p>
                <p className="text-[9px] text-gray-500">Document valant reçu officiel de versement.</p>
              </div>
            </div>

            {/* Actions: Print and WhatsApp */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                Imprimer le reçu (Ticket 80mm)
              </button>

              {selectedReceipt.debt.customerPhone && (
                <a
                  href={generateWhatsAppReceiptMessage(selectedReceipt.debt, selectedReceipt.payment, selectedReceipt.newRemaining) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md text-center"
                >
                  <MessageCircle className="w-4 h-4" />
                  Envoyer la quittance sur WhatsApp
                </a>
              )}

              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="w-full py-2 rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs hover:bg-secondary/80 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
