"use client";

import React, { useState } from "react";
import { X, Check, Shield, Sparkles, Loader2, AlertCircle, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import MonerizCheckoutModal from "./MonerizCheckoutModal";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: "PRO" | "BUSINESS";
  isLocked?: boolean;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  defaultPlan = "PRO",
  isLocked = false,
}: SubscriptionModalProps) {
  const { user, activeStore, subscription, signOut, refreshSubscription } = useAuth();
  const [selectedTier, setSelectedTier] = useState<"PRO" | "BUSINESS">(defaultPlan);
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Session checkout Moneriz
  const [checkoutSession, setCheckoutSession] = useState<any | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  if (!isOpen) return null;

  const planKey = selectedTier === "PRO"
    ? (isAnnual ? "pro_annual" : "pro_monthly")
    : (isAnnual ? "business_annual" : "business_monthly");

  const priceFormatted = selectedTier === "PRO"
    ? (isAnnual ? "50 000 FCFA / an" : "200 FCFA / mois")
    : (isAnnual ? "150 000 FCFA / an" : "15 000 FCFA / mois");

  const handleStartPayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Créer la commande d'abonnement
      const orderRes = await fetch("/api/subscription/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          planKey,
          storeId: activeStore?.id,
          customerEmail: user?.email,
        }),
      });

      const sessionData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        if (sessionData?.error?.code === "CHECKOUT_NOT_CONFIGURED") {
          throw new Error("Le système de paiement Moneriz est en cours de configuration sur le serveur (clé API manquante).");
        }
        throw new Error(sessionData?.error?.code || "Erreur lors de la création de la session de paiement.");
      }

      setCheckoutSession(sessionData);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (!isLocked && e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col max-h-[92vh]">
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
                <h3 className="text-xl font-black text-on-surface">
                  {isLocked
                    ? (subscription?.isTrial ? "Période d'essai de 14 jours terminée" : "Abonnement Expiré")
                    : "Choisir mon abonnement MaBoutiquePro"}
                </h3>
                <p className="text-xs text-outline font-medium">
                  {isLocked
                    ? "Débloquez l'accès à votre boutique en activant une formule sécurisée"
                    : "Paiement sécurisé par Mobile Money & Cartes bancaires"}
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
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {isLocked && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3 font-medium">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="leading-relaxed">
                  <span className="font-bold">Accès boutique verrouillé :</span> Vos produits, ventes, caisses et configurations sont parfaitement conservés. Choisissez une formule ci-dessous et réglez en quelques secondes par Mobile Money (T-Money, Moov, Wave, Orange) ou Carte Bancaire pour continuer immédiatement.
                </div>
              </div>
            )}

            {/* Toggle Annuel / Mensuel */}
            <div className="flex items-center justify-center gap-4 bg-surface-container-low p-2 rounded-2xl w-fit mx-auto border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  !isAnnual ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Facturation Mensuelle
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isAnnual ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Facturation Annuelle
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase">
                  2 mois offerts
                </span>
              </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PLAN PRO */}
              <div
                onClick={() => setSelectedTier("PRO")}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                  selectedTier === "PRO"
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-outline-variant/30 hover:border-outline-variant/60 bg-surface-container-lowest"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase">
                      Boutique Individuelle
                    </span>
                    <input
                      type="radio"
                      checked={selectedTier === "PRO"}
                      onChange={() => setSelectedTier("PRO")}
                      className="accent-primary w-4 h-4"
                    />
                  </div>
                  <h4 className="text-xl font-black text-on-surface mb-1">PRO</h4>
                  <div className="text-2xl font-black text-on-surface mb-3">
                    {isAnnual ? "50 000" : "200"}{" "}
                    <span className="text-xs font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                  </div>
                  <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> 1 Boutique &amp; Ventes illimitées
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Sessions de Caisse &amp; Rapport Z
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Carnet de Dettes &amp; Relances WhatsApp
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Mode Hors-ligne (PWA)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Reçus thermiques &amp; Factures A4
                    </li>
                  </ul>
                </div>
              </div>

              {/* PLAN BUSINESS */}
              <div
                onClick={() => setSelectedTier("BUSINESS")}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                  selectedTier === "BUSINESS"
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-outline-variant/30 hover:border-outline-variant/60 bg-surface-container-lowest"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-black uppercase">
                      Multi-points de vente
                    </span>
                    <input
                      type="radio"
                      checked={selectedTier === "BUSINESS"}
                      onChange={() => setSelectedTier("BUSINESS")}
                      className="accent-primary w-4 h-4"
                    />
                  </div>
                  <h4 className="text-xl font-black text-on-surface mb-1">BUSINESS</h4>
                  <div className="text-2xl font-black text-on-surface mb-3">
                    {isAnnual ? "150 000" : "15 000"}{" "}
                    <span className="text-xs font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                  </div>
                  <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
                    <li className="flex items-center gap-2 font-bold text-emerald-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Tout ce qui est inclus dans PRO
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> <b>Multi-boutiques</b> &amp; Caissiers
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Gestion multi-magasins centralisée
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Rôles et permissions avancés
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Support prioritaire VIP WhatsApp
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
          <div className="p-6 border-t border-outline-variant/20 bg-surface-container-low/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-xs text-outline font-medium">Total à payer :</span>
                <div className="text-lg font-black text-on-surface">{priceFormatted}</div>
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

              <button
                type="button"
                onClick={handleStartPayment}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connexion à Moneriz...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Payer avec Moneriz (Mobile Money / Carte)</span>
                  </>
                )}
              </button>
            </div>
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
