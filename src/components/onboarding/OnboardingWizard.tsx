"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import {
  StoreSector,
  STORE_SECTORS,
  SECTOR_PRESETS,
  ModuleKey,
} from "@/types/modules";
import {
  Store,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  Package,
  Calendar,
  Scale,
  FileText,
  BookOpen,
  Users,
  Coins,
  Phone,
  Building,
  CheckCircle,
  HelpCircle,
  Layers,
  ShoppingBag,
  Zap,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
  canSkip?: boolean;
}

export default function OnboardingWizard({ onComplete, canSkip = true }: OnboardingWizardProps) {
  const { activeStore, updateStoreModules } = useAuth();
  const { state, dispatch } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedSector, setSelectedSector] = useState<StoreSector>(
    (activeStore?.business_sector as StoreSector) || "general_store"
  );

  // Étape 2 : Pratiques & Besoins
  const preset = SECTOR_PRESETS[selectedSector] || SECTOR_PRESETS.general_store;
  const [features, setFeatures] = useState({
    multiUnits: preset.features.multiUnits,
    batchesExpiry: preset.features.batchesExpiry,
    fractionalSales: preset.features.fractionalSales,
    quotes: preset.features.quotes,
    debts: preset.features.debts,
    team: preset.features.team,
    receiptsInvoices: preset.features.receiptsInvoices,
  });

  // Étape 3 : Identité
  const [storeName, setStoreName] = useState(
    state.settings.name || activeStore?.name || "Ma Boutique"
  );
  const [currency, setCurrency] = useState(state.settings.currency || "FCFA");
  const [phone, setPhone] = useState(state.settings.phone || "");

  // Étape 4 : Chargement & Animation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  // Mettre à jour les options préconisées quand l'utilisateur change de secteur
  const handleSelectSector = (secKey: StoreSector) => {
    setSelectedSector(secKey);
    const p = SECTOR_PRESETS[secKey];
    if (p) {
      setFeatures({
        multiUnits: p.features.multiUnits,
        batchesExpiry: p.features.batchesExpiry,
        fractionalSales: p.features.fractionalSales,
        quotes: p.features.quotes,
        debts: p.features.debts,
        team: p.features.team,
        receiptsInvoices: p.features.receiptsInvoices,
      });
    }
  };

  const handleToggleFeature = (key: keyof typeof features) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Finalisation et enregistrement
  const handleFinalize = async () => {
    setIsSubmitting(true);
    setStep(4);

    // Calcul de la liste des modules à activer selon les choix de l'utilisateur
    const modulesToEnable: ModuleKey[] = ["core", "expenses", "analytics"];
    if (features.debts) modulesToEnable.push("debts");
    if (features.receiptsInvoices) modulesToEnable.push("receipts_invoices");
    if (features.quotes) modulesToEnable.push("quotes");
    if (features.multiUnits) modulesToEnable.push("multi_units");
    if (features.team) modulesToEnable.push("team");
    // Par défaut, inventory et orders sont recommandés pour la bonne gestion
    modulesToEnable.push("inventory", "orders");

    // Animation pas-à-pas pour l'effet "Wahou"
    setAnimationStep(1); // Application du secteur
    await new Promise((r) => setTimeout(r, 600));

    setAnimationStep(2); // Sculpture des modules
    await updateStoreModules(modulesToEnable, selectedSector);
    await new Promise((r) => setTimeout(r, 600));

    setAnimationStep(3); // Enregistrement des paramètres de caisse
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: {
        name: storeName.trim() || "Ma Boutique",
        currency: currency.trim() || "FCFA",
        phone: phone.trim() || undefined,
        allowNegativeStock: selectedSector === "general_store" || selectedSector === "hardware",
      },
    });

    if (typeof window !== "undefined") {
      sessionStorage.setItem("onboarding_completed", "true");
      if (activeStore?.id) {
        localStorage.setItem(`onboarding_completed_${activeStore.id}`, "true");
      }
    }

    setAnimationStep(4); // Prêt !
    await new Promise((r) => setTimeout(r, 700));

    setIsSubmitting(false);
    onComplete();
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("onboarding_completed", "true");
      if (activeStore?.id) {
        localStorage.setItem(`onboarding_completed_${activeStore.id}`, "true");
      }
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[92vh]">
        
        {/* En-tête avec barre de progression */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Configuration de votre Boutique
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  {step === 1 && "Étape 1 sur 3 • Quel est votre métier ?"}
                  {step === 2 && "Étape 2 sur 3 • Vos pratiques de vente au quotidien"}
                  {step === 3 && "Étape 3 sur 3 • L'identité de votre enseigne"}
                  {step === 4 && "Création de votre interface sur-mesure..."}
                </p>
              </div>
            </div>

            {canSkip && step !== 4 && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                Passer pour le moment
              </button>
            )}
          </div>

          {/* Indicateur de progression visuel */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </div>

        {/* CONTENU SELON L'ÉTAPE */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ============================================================ */}
          {/* ÉTAPE 1 : CHOIX DU SECTEUR D'ACTIVITÉ */}
          {/* ============================================================ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center sm:text-left">
                <h3 className="text-xl font-black text-foreground">
                  Sélectionnez votre secteur principal
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  MaBoutiquePro adaptera instantanément votre caisse tactile, vos menus et vos outils de stock selon votre activité.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {STORE_SECTORS.map((sec) => {
                  const isSelected = selectedSector === sec.key;
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => handleSelectSector(sec.key)}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl text-left border transition-all duration-200 relative group ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border/70 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-3xl shrink-0 p-1.5 bg-background rounded-xl shadow-xs border border-border/50">
                        {sec.icon}
                      </div>
                      <div className="flex-1 min-w-0 pr-5">
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <span>{sec.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                          {sec.tagline}
                        </p>
                      </div>

                      <div
                        className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 text-transparent group-hover:border-primary/50"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ÉTAPE 2 : PRATIQUES COMMERCIALES & BESOINS */}
          {/* ============================================================ */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-foreground">
                  Personnalisez vos fonctions quotidiennes
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Nous avons pré-activé les modules recommandés pour <b>{preset.label}</b>. Vous pouvez les ajuster en 1 clic :
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* 1. Multi-Unités */}
                <div
                  onClick={() => handleToggleFeature("multiUnits")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    features.multiUnits ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Vente par Cartons / Packs et au Détail</p>
                      <p className="text-xs text-muted-foreground">Conditionnements multiples avec décompte automatique des stocks</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.multiUnits}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary pointer-events-none"
                  />
                </div>

                {/* 2. Péremptions FEFO */}
                <div
                  onClick={() => handleToggleFeature("batchesExpiry")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    features.batchesExpiry ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Dates de Péremption & Numéros de Lot (FEFO)</p>
                      <p className="text-xs text-muted-foreground">Alertes anti-gaspillage (30 jours) et priorité aux lots expirant en premier</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.batchesExpiry}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary pointer-events-none"
                  />
                </div>

                {/* 3. Vente au montant / vrac */}
                <div
                  onClick={() => handleToggleFeature("fractionalSales")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    features.fractionalSales ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Ventes au Vrac & au Montant (ex: 100 F, 250 F)</p>
                      <p className="text-xs text-muted-foreground">Bouton rapide en caisse pour taper le montant demandé par le client</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.fractionalSales}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary pointer-events-none"
                  />
                </div>

                {/* 4. Devis & Proformas */}
                <div
                  onClick={() => handleToggleFeature("quotes")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    features.quotes ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Devis Commerciaux & Factures Proforma A4</p>
                      <p className="text-xs text-muted-foreground">Chiffrage officiel, partage WhatsApp et conversion directe en vente</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.quotes}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary pointer-events-none"
                  />
                </div>

                {/* 5. Carnet de dettes */}
                <div
                  onClick={() => handleToggleFeature("debts")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    features.debts ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Ventes à Crédit & Carnet de Dettes</p>
                      <p className="text-xs text-muted-foreground">Suivi des impayés clients et relances automatiques par WhatsApp</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.debts}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary pointer-events-none"
                  />
                </div>

                {/* 6. Équipe et caissiers */}
                <div
                  onClick={() => handleToggleFeature("team")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    features.team ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Gestion d'Équipe & Accès Caissiers</p>
                      <p className="text-xs text-muted-foreground">Comptes sécurisés pour vos vendeurs sans accès aux marges du patron</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.team}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary pointer-events-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ÉTAPE 3 : IDENTITÉ DE L'ENSEIGNE */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-black text-foreground">
                  L'identité de votre établissement
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ces informations apparaîtront sur vos tickets de caisse, reçus et factures proforma.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                    Nom de votre boutique / Enseigne
                  </label>
                  <div className="relative">
                    <Building className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ex: Supérette La Grâce, Boutique Élégance..."
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-semibold outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                      Devise Monétaire
                    </label>
                    <div className="relative">
                      <Coins className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-semibold outline-hidden appearance-none"
                      >
                        <option value="FCFA">FCFA (XOF / XAF)</option>
                        <option value="GNF">GNF (Franc guinéen)</option>
                        <option value="CDF">CDF (Franc congolais)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                      Numéro WhatsApp (Pour les tickets)
                    </label>
                    <div className="relative">
                      <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ex: +228 90 00 00 00"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-semibold outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Récapitulatif visuel du secteur */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 flex items-center gap-3.5 mt-2">
                  <div className="text-3xl p-2 bg-background rounded-xl border border-border/50">
                    {preset.icon}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">Profil métier sélectionné</p>
                    <p className="text-sm font-black text-foreground">{preset.label}</p>
                    <p className="text-xs text-muted-foreground">{preset.sampleUnits.join(" • ")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ÉTAPE 4 : ANIMATION DE CRÉATION SUR-MESURE */}
          {/* ============================================================ */}
          {step === 4 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping opacity-30" />
                <div className="w-20 h-20 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl animate-pulse">
                  <Sparkles className="w-10 h-10" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-foreground">
                  Sculpture de votre espace dédié...
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Nous configurons votre boutique sur mesure pour une expérience fluide et ultra-rapide.
                </p>
              </div>

              <div className="w-full max-w-md space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${animationStep >= 1 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className={animationStep >= 1 ? "text-foreground font-bold" : "text-muted-foreground"}>
                    Profil métier : {preset.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${animationStep >= 2 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className={animationStep >= 2 ? "text-foreground font-bold" : "text-muted-foreground"}>
                    Personnalisation de la caisse et des menus de stock
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${animationStep >= 3 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className={animationStep >= 3 ? "text-foreground font-bold" : "text-muted-foreground"}>
                    Enregistrement de l'enseigne ({storeName}) et de la devise ({currency})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PIED DE PAGE AVEC ACTIONS */}
        {step !== 4 && (
          <div className="px-6 py-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:bg-muted font-bold text-sm text-foreground transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-md transition-all group"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalize}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-black text-sm shadow-lg shadow-emerald-600/20 transition-all group animate-bounce-subtle"
              >
                <Sparkles className="w-4 h-4" />
                <span>Accéder à ma boutique sur-mesure</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
