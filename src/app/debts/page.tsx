"use client";

import React, { useState, useMemo } from "react";
import { useStore, Sale } from "@/context/StoreContext";
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
  FileText
} from "lucide-react";

export default function DebtsPage() {
  const { sales, recordDebtPayment, activeStore, activeCashSession } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  
  // Payment modal state
  const [selectedDebt, setSelectedDebt] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // All sales that are credit or have debt tracking
  const debtSales = useMemo(() => {
    return sales.filter(
      (s) => s.paymentMethod === "credit" || (s.remainingAmount !== undefined && s.remainingAmount > 0)
    );
  }, [sales]);

  // Statistics
  const stats = useMemo(() => {
    let totalDue = 0;
    let totalRecovered = 0;
    let debtorsCount = 0;
    let activeDebtsCount = 0;
    const debtorNames = new Set<string>();

    debtSales.forEach((s) => {
      const remaining = s.remainingAmount ?? (s.paymentStatus === "paid" ? 0 : s.total);
      const paid = s.amountPaid ?? (s.paymentStatus === "paid" ? s.total : 0);
      
      totalDue += remaining;
      totalRecovered += paid;
      
      if (remaining > 0) {
        activeDebtsCount++;
        if (s.customerName) debtorNames.add(s.customerName.toLowerCase().trim());
      }
    });

    return {
      totalDue,
      totalRecovered,
      activeDebtsCount,
      uniqueDebtorsCount: debtorNames.size || activeDebtsCount,
    };
  }, [debtSales]);

  // Filtered debts list
  const filteredDebts = useMemo(() => {
    return debtSales.filter((s) => {
      const remaining = s.remainingAmount ?? (s.paymentStatus === "paid" ? 0 : s.total);
      
      // Status filter
      if (statusFilter === "unpaid" && (remaining <= 0 || (s.amountPaid && s.amountPaid > 0))) return false;
      if (statusFilter === "partial" && (remaining <= 0 || !s.amountPaid || s.amountPaid === 0)) return false;
      if (statusFilter === "paid" && remaining > 0) return false;

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const nameMatch = s.customerName?.toLowerCase().includes(query);
        const phoneMatch = s.customerPhone?.toLowerCase().includes(query);
        const idMatch = s.id.toLowerCase().includes(query);
        return nameMatch || phoneMatch || idMatch;
      }

      return true;
    });
  }, [debtSales, statusFilter, search]);

  const handleOpenPayment = (debt: Sale) => {
    setSelectedDebt(debt);
    const rem = debt.remainingAmount ?? debt.total;
    setPaymentAmount(rem.toString());
    setPaymentMethod("cash");
    setPaymentSuccess(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const amt = parseFloat(paymentAmount);
    const currentRem = selectedDebt.remainingAmount ?? selectedDebt.total;
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    try {
      await recordDebtPayment(selectedDebt.id, Math.min(amt, currentRem), paymentMethod);
      setPaymentSuccess(`Versement de ${amt.toLocaleString("fr-FR")} FCFA enregistré avec succès !`);
      setTimeout(() => {
        setSelectedDebt(null);
        setPaymentSuccess(null);
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppLink = (debt: Sale) => {
    if (!debt.customerPhone) return null;
    let cleanPhone = debt.customerPhone.replace(/\D/g, "");
    // Default country prefix if missing (e.g. Benin 229, Togo 228, etc. - if 8 or 10 digits without prefix, keep as is or user can edit)
    if (cleanPhone.length === 8) cleanPhone = "229" + cleanPhone; // Fallback Bénin 8 digits standard
    
    const remaining = debt.remainingAmount ?? debt.total;
    const storeName = activeStore?.name || "Notre Boutique";
    const msg = encodeURIComponent(
      `Bonjour ${debt.customerName || "cher client"}, nous vous remercions pour votre fidélité auprès de ${storeName}. ` +
      `Sauf erreur de notre part, il reste un solde de ${remaining.toLocaleString("fr-FR")} FCFA sur votre achat (Réf: #${debt.id.slice(-6)}). ` +
      `Merci de nous contacter pour votre règlement. Excellente journée !`
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                Carnet de Dettes & Crédits Clients
              </h1>
              <p className="text-sm text-muted-foreground">
                Suivez les arriérés, encaissez les acomptes et relancez vos clients directement sur WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-rose-400">Total Créances Dues</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-500">
              {stats.totalDue.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">À recouvrer auprès des clients</p>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-400">Dettes en Cours</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-500">
              {stats.activeDebtsCount} <span className="text-xs font-normal font-sans">créance(s)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Non encore totalement soldées</p>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-400">Clients Débiteurs</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-400">
              {stats.uniqueDebtorsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Clients concernés</p>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-400">Total Recouvré</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400">
              {stats.totalRecovered.toLocaleString("fr-FR")} <span className="text-xs font-normal">FCFA</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Acomptes & dettes remboursées</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher client, téléphone..."
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
                <th className="py-3.5 px-4">Date de l'Achat</th>
                <th className="py-3.5 px-4">Articles</th>
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
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="font-medium">Aucune créance client trouvée</p>
                    <p className="text-xs mt-1">
                      {search ? "Essayez avec d'autres mots-clés" : "Les ventes effectuées avec le mode 'Crédit / Dette' apparaîtront ici."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => {
                  const remaining = debt.remainingAmount ?? (debt.paymentStatus === "paid" ? 0 : debt.total);
                  const paid = debt.amountPaid ?? (debt.paymentStatus === "paid" ? debt.total : 0);
                  const isFullyPaid = remaining <= 0;
                  const isPartial = paid > 0 && remaining > 0;
                  const waLink = generateWhatsAppLink(debt);

                  return (
                    <tr key={debt.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {debt.customerName || "Client non spécifié"}
                        </div>
                        {debt.customerPhone ? (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {debt.customerPhone}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/50 italic">Pas de numéro</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs text-foreground">
                          {new Date(debt.createdAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(debt.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="truncate text-xs text-muted-foreground" title={debt.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}>
                          {debt.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-foreground whitespace-nowrap">
                        {debt.total.toLocaleString("fr-FR")} F
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-500 font-medium whitespace-nowrap">
                        {paid.toLocaleString("fr-FR")} F
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                        <span className={remaining > 0 ? "text-rose-500" : "text-emerald-500"}>
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
                        <div className="flex items-center justify-end gap-2">
                          {/* WhatsApp Reminder Button */}
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

                          {/* Record Payment Button */}
                          {remaining > 0 ? (
                            <button
                              onClick={() => handleOpenPayment(debt)}
                              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Encaisser
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3 py-1.5 rounded-xl bg-secondary/50 text-muted-foreground text-xs cursor-default flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Payé
                            </button>
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

      {/* Payment Modal */}
      {selectedDebt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl border border-border/80 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Encaisser un Remboursement</h3>
                  <p className="text-xs text-muted-foreground">
                    Client: {selectedDebt.customerName || "Inconnu"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDebt(null)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-emerald-500 font-semibold">{paymentSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmPayment} className="mt-4 space-y-4">
                {/* Debt details breakdown */}
                <div className="p-3.5 rounded-xl bg-secondary/30 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facture d'origine :</span>
                    <span className="font-semibold text-foreground">#{selectedDebt.id.slice(-6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de l'achat :</span>
                    <span className="font-semibold text-foreground">{selectedDebt.total.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Déjà versé :</span>
                    <span className="font-semibold text-emerald-500">{(selectedDebt.amountPaid || 0).toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border/50 text-sm">
                    <span className="font-bold text-rose-500">Reste Dû :</span>
                    <span className="font-bold text-rose-500">
                      {(selectedDebt.remainingAmount ?? selectedDebt.total).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Montant du Versement (FCFA)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedDebt.remainingAmount ?? selectedDebt.total}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/80 text-foreground text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {/* Quick percentage buttons */}
                  <div className="flex gap-2 mt-2">
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
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 font-semibold"
                    >
                      Solder tout (100%)
                    </button>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Mode d'encaissement
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1.5 transition-all ${
                        paymentMethod === "cash"
                          ? "bg-primary/10 border-primary text-primary shadow-sm"
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
                          ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow-sm"
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
                          ? "bg-blue-500/10 border-blue-500 text-blue-500 shadow-sm"
                          : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Carte</span>
                    </button>
                  </div>
                  {paymentMethod === "cash" && activeCashSession && (
                    <p className="text-[11px] text-emerald-500 mt-2 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Sera ajouté au tiroir de la session de caisse en cours.
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDebt(null)}
                    className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-xs hover:bg-secondary/80 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !paymentAmount || parseFloat(paymentAmount) <= 0}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? "Enregistrement..." : "Confirmer le paiement"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
