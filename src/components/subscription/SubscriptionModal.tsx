"use client";

import React, { useState } from "react";
import { X, Check, Sparkles, Loader2, AlertCircle, Lock, LogOut, ArrowRight, ShieldCheck, Smartphone, CreditCard, Zap, Store, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { SubscriptionTier, SUBSCRIPTION_PLANS, formatFCFA, PlanKey } from "@/lib/subscriptionPlans";
import MonerizCheckoutModal from "./MonerizCheckoutModal";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: SubscriptionTier;
  isLocked?: boolean;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  defaultPlan = "PRO",
  isLocked = false,
}: SubscriptionModalProps) {
  const { user, activeStore, subscription, signOut, refreshSubscription } = useAuth();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(defaultPlan);
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Session checkout Moneriz
  const [checkoutSession, setCheckoutSession] = useState<any | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  if (!isOpen) return null;

  const planKey: PlanKey = (
    selectedTier === "STARTER"
      ? (isAnnual ? "starter_annual" : "starter_monthly")
      : selectedTier === "BUSINESS"
      ? (isAnnual ? "business_annual" : "business_monthly")
      : (isAnnual ? "pro_annual" : "pro_monthly")
  );

  const planConfig = SUBSCRIPTION_PLANS[planKey];
  const priceFormatted = formatFCFA(planConfig.amount) + (isAnnual ? " / an" : " / mois");

  const handleStartPayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // 1. Créer la commande d'abonnement avec authentification serveur
      const orderRes = await fetch("/api/subscription/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          planKey,
          storeId: activeStore?.id,
          customerEmail: user?.email,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.order) {
        throw new Error(orderData.error || "Erreur lors de la préparation de la commande.");
      }

      const orderId = orderData.order.orderId;
      setCurrentOrderId(orderId);

      // 2. Créer la session Moneriz
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId,
          planKey,
          storeId: activeStore?.id,
          customerEmail: user?.email,
        }),
      });

      const sessionDataPayload = await checkoutRes.json();
      if (!checkoutRes.ok) {
        if (sessionDataPayload?.error?.code === "CHECKOUT_NOT_CONFIGURED") {
          throw new Error("Le système de paiement Moneriz est en cours de configuration sur le serveur (clé API manquante).");
        }
        throw new Error(sessionDataPayload?.error?.code || "Erreur lors de la création de la session de paiement.");
      }

      setCheckoutSession(sessionDataPayload);
      setShowCheckoutModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Une erreur est survenue lors de la connexion à Moneriz.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
        onClick={(e) => {
          if (!isLocked && e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20 bg-surface-container-low/40">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
                  isLocked ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary text-on-primary"
                }`}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-on-surface">
                  {isLocked
                    ? (subscription?.isTrial ? "Période d'essai de 14 jours terminée" : "Abonnement Expiré")
                    : "Choisir ma formule MaBoutiquePro"}
                </h3>
                <p className="text-xs text-outline font-medium">
                  {isLocked
                    ? "Débloquez l'accès à votre boutique en activant une formule sécurisée"
                    : "Paiement sécurisé par Mobile Money (T-Money, Flooz, Wave, Orange) & Cartes bancaires"}
                </p>
              </div>
            </div>

            {!isLocked && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-outline hover:text-on-surface rounded-xl hover:bg-surface-container transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {isLocked && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3 font-medium">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="leading-relaxed">
                  <span className="font-bold">Accès boutique verrouillé :</span> Vos produits, ventes, caisses et configurations sont parfaitement conservés. Choisissez une formule ci-dessous et réglez en quelques secondes par Mobile Money ou Carte Bancaire pour continuer immédiatement.
                </div>
              </div>
            )}

            {/* Toggle Annuel / Mensuel */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 bg-surface-container-low p-1.5 sm:p-2 rounded-2xl w-fit mx-auto border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  !isAnnual ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Facturation Mensuelle
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isAnnual ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Facturation Annuelle
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase">
                  2 mois offerts
                </span>
              </button>
            </div>

            {/* Grille des 3 Formules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* PLAN STARTER */}
              <div
                onClick={() => setSelectedTier("STARTER")}
                className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between group ${
                  selectedTier === "STARTER"
                    ? "border-blue-500 bg-gradient-to-b from-blue-500/10 via-blue-500/[0.03] to-transparent shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20"
                    : "border-outline-variant/30 hover:border-outline-variant/70 bg-surface-container-lowest hover:bg-surface-container-low/40"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] font-black uppercase">
                      Solo &amp; Démarrage
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedTier === "STARTER" ? "border-blue-600 bg-blue-600 text-white scale-110" : "border-outline-variant"
                    }`}>
                      {selectedTier === "STARTER" && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-on-surface mb-1 flex items-center gap-1.5">
                    <span>STARTER</span>
                  </h4>
                  <div className="text-2xl font-black text-on-surface mb-3">
                    {isAnnual ? "25 000" : "2 500"}{" "}
                    <span className="text-xs font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                  </div>
                  <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-blue-600 font-bold" />
                      </div>
                      <span><b>1 Boutique</b> &amp; 1 Gérant (Admin)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-blue-600 font-bold" />
                      </div>
                      <span>Gestion des produits &amp; du stock</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-blue-600 font-bold" />
                      </div>
                      <span>Ventes directes &amp; Calcul des bénéfices</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-blue-600 font-bold" />
                      </div>
                      <span>PWA &amp; Mode Hors-ligne</span>
                    </li>
                    <li className="flex items-center gap-2 text-outline/70 line-through">
                      <div className="w-4 h-4 rounded-full bg-outline-variant/20 flex items-center justify-center shrink-0">
                        <Minus className="w-3 h-3 text-outline" />
                      </div>
                      <span>Pas de caissier supplémentaire</span>
                    </li>
                    <li className="flex items-center gap-2 text-outline/70 line-through">
                      <div className="w-4 h-4 rounded-full bg-outline-variant/20 flex items-center justify-center shrink-0">
                        <Minus className="w-3 h-3 text-outline" />
                      </div>
                      <span>Pas de reçus ni de carnet de dettes</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* PLAN PRO (RECOMMANDÉ) */}
              <div
                onClick={() => setSelectedTier("PRO")}
                className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between group ${
                  selectedTier === "PRO"
                    ? "border-emerald-500 bg-gradient-to-b from-emerald-500/10 via-emerald-500/[0.03] to-transparent shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                    : "border-outline-variant/30 hover:border-outline-variant/70 bg-surface-container-lowest hover:bg-surface-container-low/40"
                }`}
              >
                <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Recommandé</span>
                </div>
                <div>
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase">
                      Boutique Complète
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedTier === "PRO" ? "border-emerald-600 bg-emerald-600 text-white scale-110" : "border-outline-variant"
                    }`}>
                      {selectedTier === "PRO" && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-on-surface mb-1 flex items-center gap-1.5">
                    <span>PRO</span>
                    <Zap className="w-4 h-4 text-emerald-500" />
                  </h4>
                  <div className="text-2xl font-black text-on-surface mb-3">
                    {isAnnual ? "50 000" : "5 000"}{" "}
                    <span className="text-xs font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                  </div>
                  <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
                    <li className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-600 font-bold" />
                      </div>
                      <span>Tout ce qui est inclus dans Starter</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-600 font-bold" />
                      </div>
                      <span><b>1 Caissier inclus</b> avec compte dédié</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-600 font-bold" />
                      </div>
                      <span><b>Carnet de dettes</b> &amp; Relances WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-600 font-bold" />
                      </div>
                      <span><b>Reçus thermiques</b> &amp; Factures A4</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-600 font-bold" />
                      </div>
                      <span>Inventaires physiques &amp; Ajustements</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-600 font-bold" />
                      </div>
                      <span>Commandes fournisseurs &amp; Analyses</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* PLAN BUSINESS */}
              <div
                onClick={() => setSelectedTier("BUSINESS")}
                className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between group ${
                  selectedTier === "BUSINESS"
                    ? "border-primary bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                    : "border-outline-variant/30 hover:border-outline-variant/70 bg-surface-container-lowest hover:bg-surface-container-low/40"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-black uppercase">
                      Multi-Magasins
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedTier === "BUSINESS" ? "border-primary bg-primary text-white scale-110" : "border-outline-variant"
                    }`}>
                      {selectedTier === "BUSINESS" && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-on-surface mb-1 flex items-center gap-1.5">
                    <span>BUSINESS</span>
                    <Store className="w-4 h-4 text-primary" />
                  </h4>
                  <div className="text-2xl font-black text-on-surface mb-3">
                    {isAnnual ? "100 000" : "10 000"}{" "}
                    <span className="text-xs font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                  </div>
                  <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
                    <li className="flex items-center gap-2 font-bold text-primary">
                      <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary font-bold" />
                      </div>
                      <span>Tout ce qui est inclus dans PRO</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary font-bold" />
                      </div>
                      <span><b>Jusqu'à 3 Boutiques</b> actives</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary font-bold" />
                      </div>
                      <span><b>Jusqu'à 3 Caissiers</b> au total</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary font-bold" />
                      </div>
                      <span>Sélecteur &amp; Affectation par boutique</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary font-bold" />
                      </div>
                      <span>Tableau de bord consolidé</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary font-bold" />
                      </div>
                      <span>Support prioritaire VIP WhatsApp</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="p-5 sm:p-6 border-t border-outline-variant/20 bg-surface-container-low/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-xs text-outline font-medium flex items-center gap-1">
                  <span>Montant total :</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-bold uppercase">Sans frais cachés</span>
                </span>
                <div className="text-2xl font-black text-on-surface tracking-tight">{priceFormatted}</div>
              </div>
              {isLocked && (
                <button
                  type="button"
                  onClick={signOut}
                  className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Quitter</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isLocked && (
                <button
                  type="button"
                  onClick={signOut}
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </button>
              )}

              {/* BOUTON ULTRA-PREMIUM AVEC SHIMMER ET DÉGRADÉ VIBRANT */}
              <button
                type="button"
                onClick={handleStartPayment}
                disabled={loading}
                className="relative group overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-3.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:via-teal-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base tracking-wide shadow-xl shadow-emerald-600/30 hover:shadow-2xl hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 border border-white/20 cursor-pointer"
              >
                <span className="absolute inset-0 w-1/2 h-full bg-white/25 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out" />

                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sécurisation de la commande...</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner group-hover:rotate-6 group-hover:scale-110 transition-all shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                        <span>Paiement Instantané</span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                      </div>
                      <div className="text-sm sm:text-base font-black flex items-center gap-1.5 leading-tight">
                        <span>Payer &amp; Débloquer</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    <div className="ml-2 pl-3 border-l border-white/20 hidden md:flex items-center gap-1 text-[11px] text-white/90">
                      <ShieldCheck className="w-4 h-4 text-emerald-200" />
                      <span>100% Sécurisé</span>
                    </div>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Moyens de paiement africains */}
          <div className="px-6 py-2.5 bg-surface-container-low/90 border-t border-outline-variant/15 flex items-center justify-center gap-3 text-[11px] text-on-surface-variant font-medium flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Moyens acceptés :</span>
            <span className="flex items-center gap-1 font-semibold text-on-surface"><Smartphone className="w-3.5 h-3.5 text-emerald-600" /> T-Money</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-on-surface"><Smartphone className="w-3.5 h-3.5 text-blue-600" /> Moov Flooz</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-on-surface"><Smartphone className="w-3.5 h-3.5 text-cyan-600" /> Wave</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-on-surface"><Smartphone className="w-3.5 h-3.5 text-orange-600" /> Orange Money</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-on-surface"><CreditCard className="w-3.5 h-3.5 text-indigo-600" /> Cartes Bancaires</span>
          </div>
        </div>
      </div>

      {/* Moneriz Liveframe Modal */}
      {showCheckoutModal && checkoutSession && currentOrderId && (
        <MonerizCheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => {
            setShowCheckoutModal(false);
            if (!isLocked) {
              onClose();
            }
          }}
          orderId={currentOrderId}
          session={checkoutSession}
          onSuccess={async () => {
            try {
              await refreshSubscription();
            } catch {}
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          }}
        />
      )}
    </>
  );
}
