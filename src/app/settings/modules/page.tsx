"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import SubscriptionModal from "@/components/subscription/SubscriptionModal";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import {
  MODULES_CATALOG,
  ModuleKey,
  ModuleDefinition,
  StoreSector,
  STORE_SECTORS,
  DEFAULT_ENABLED_MODULES,
  resolveModuleStatus,
} from "@/types/modules";
import {
  ArrowLeft,
  Check,
  Lock,
  Sparkles,
  AlertTriangle,
  Save,
  CheckCircle2,
  Store,
  Layers,
  Info,
  ShieldCheck,
  Loader2,
} from "lucide-react";

export default function StoreModulesPage() {
  const router = useRouter();
  const { role, activeStore, tier, updateStoreModules, subscription } = useAuth();
  const { unpaidDebts } = useStore();

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Redirection immédiate si rôle caissier
  useEffect(() => {
    if (role === "cashier") {
      router.replace("/pos");
    }
  }, [role, router]);

  // État local des modules activés avec priorité au cache local de la boutique
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(() => {
    let cached: string[] | null = null;
    if (typeof window !== "undefined" && activeStore?.id) {
      try {
        const raw = localStorage.getItem(`store_modules_${activeStore.id}`);
        if (raw) cached = JSON.parse(raw);
      } catch {}
    }
    const initial = (cached && Array.isArray(cached) && cached.length > 0)
      ? cached
      : (activeStore?.enabled_modules && Array.isArray(activeStore.enabled_modules) && activeStore.enabled_modules.length > 0
        ? activeStore.enabled_modules
        : DEFAULT_ENABLED_MODULES);
    return new Set(initial as ModuleKey[]);
  });

  // Profil métier
  const [selectedSector, setSelectedSector] = useState<StoreSector | null>(
    (activeStore?.business_sector as StoreSector) || null
  );

  const currentStoreIdRef = React.useRef(activeStore?.id);
  useEffect(() => {
    if (activeStore?.id && activeStore.id !== currentStoreIdRef.current) {
      currentStoreIdRef.current = activeStore.id;
      let cached: string[] | null = null;
      try {
        const raw = localStorage.getItem(`store_modules_${activeStore.id}`);
        if (raw) cached = JSON.parse(raw);
      } catch {}
      const initial = (cached && Array.isArray(cached) && cached.length > 0)
        ? cached
        : (activeStore?.enabled_modules && Array.isArray(activeStore.enabled_modules) && activeStore.enabled_modules.length > 0
          ? activeStore.enabled_modules
          : DEFAULT_ENABLED_MODULES);
      setSelectedModules(new Set(initial as ModuleKey[]));
      if (activeStore?.business_sector) {
        setSelectedSector(activeStore.business_sector as StoreSector);
      }
    }
  }, [activeStore?.id]);

  const toggleModule = (key: ModuleKey, isLocked: boolean, isCore?: boolean) => {
    if (isCore) return; // Core ne peut jamais être désactivé
    if (isLocked) {
      setSubModalOpen(true);
      return;
    }

    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const modulesArray = Array.from(selectedModules);
    const res = await updateStoreModules(modulesArray, selectedSector);

    setSaving(false);
    if (res.success) {
      setJustSaved(true);
      setSuccessMessage("Configuration des modules enregistrée avec succès !");
      setTimeout(() => {
        setJustSaved(false);
        setSuccessMessage(null);
      }, 4000);
    } else {
      setErrorMessage(res.error || "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  // Liste ordonnée des modules opérationnels (hors placeholders)
  const operationalModules: ModuleDefinition[] = Object.values(MODULES_CATALOG).filter(
    (m) => !m.isPlaceholder
  );

  const debtsActive = selectedModules.has("debts");
  const showDebtsWarning = !debtsActive && unpaidDebts && unpaidDebts.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Header avec retour */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            title="Retour aux paramètres"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              <span>Modules de la boutique</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personnalisez l&apos;interface selon vos besoins. Désactiver un module le masque sans rien supprimer en base.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs shadow-xs transition-all"
            title="Relancer l'assistant pour personnaliser automatiquement votre boutique"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Assistant Métier</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${
              justSaved
                ? "bg-emerald-600 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
            } disabled:opacity-50`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : justSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Enregistré !</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Enregistrer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm font-semibold animate-scale-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold animate-scale-in">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Avertissement de descente de formule */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-900 dark:text-indigo-200 animate-scale-in">
        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold">Information sur la descente de formule (Downgrade)</h4>
          <p className="text-xs leading-relaxed text-indigo-800 dark:text-indigo-300">
            En cas de passage à une formule inférieure (ex: Pro vers Starter), les modules non inclus dans la nouvelle formule sont automatiquement verrouillés dans l'interface, sans aucune perte de données. Vos historiques de ventes, stocks et créances restent archivés en toute sécurité et réapparaîtront immédiatement lors d'une remise à niveau.
          </p>
        </div>
      </div>

      {/* Alerte contextuelle crédits impayés */}
      {showDebtsWarning && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 animate-scale-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Attention : Créances clients en cours ({unpaidDebts.length} dossier(s))</h4>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Votre boutique compte actuellement des crédits clients impayés. Désactiver le module <b>Carnet de Dettes</b> masque la rubrique du menu et les relances WhatsApp, mais <b>ne supprime aucune créance</b>. À la réactivation du module, tout l&apos;historique réapparaîtra instantanément.
            </p>
          </div>
        </div>
      )}

      {/* Carte d'information Formule Active */}
      <div className="p-4 rounded-2xl border border-border/50 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Formule active :</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-black">
                {subscription?.isTrial ? "ESSAI GRATUIT (PRO)" : `FORMULE ${tier}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Boutique : <b>{activeStore?.name || "Ma Boutique"}</b> • Les modules inclus dans votre abonnement sont configurables ci-dessous.
            </p>
          </div>
        </div>

        {tier === "STARTER" && (
          <button
            type="button"
            onClick={() => setSubModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-black transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Débloquer tous les modules Pro</span>
          </button>
        )}
      </div>

      {/* Profil Métier (Secteur d'activité) */}
      <div className="p-5 rounded-2xl border border-border/50 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Secteur d&apos;activité de la boutique</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Indiquez votre activité principale pour adapter au mieux les options d&apos;affichage.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
          {STORE_SECTORS.map((s) => {
            const isSelected = selectedSector === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedSector(s.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border/50 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground"
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-xs truncate">{s.label}</span>
                {isSelected && <Check className="w-4 h-4 ml-auto text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste des Modules */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">
          Catalogue des modules disponibles
        </h3>

        <div className="space-y-3">
          {operationalModules.map((mod) => {
            const isCore = Boolean(mod.isCore);
            const status = resolveModuleStatus(mod.key, tier, Array.from(selectedModules));
            const isLocked = status === "locked";
            const isEnabled = isCore || selectedModules.has(mod.key);

            return (
              <div
                key={mod.key}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCore
                    ? "bg-secondary/30 border-border/40"
                    : isLocked
                    ? "bg-muted/30 border-border/30 opacity-75"
                    : isEnabled
                    ? "bg-card border-primary/30 shadow-xs"
                    : "bg-card/60 border-border/40"
                }`}
              >
                {/* Infos du module */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isCore
                        ? "bg-emerald-500/10 text-emerald-600"
                        : isLocked
                        ? "bg-muted text-muted-foreground"
                        : isEnabled
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {isLocked ? <Lock className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground">{mod.label}</h4>
                      {isCore && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-black uppercase">
                          Système / Requis
                        </span>
                      )}
                      {isLocked && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Requis {mod.minTier}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Commutateur On / Off */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {isCore ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      Toujours actif
                    </span>
                  ) : isLocked ? (
                    <button
                      type="button"
                      onClick={() => setSubModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-black transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Passer à {mod.minTier}</span>
                    </button>
                  ) : (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleModule(mod.key, isLocked, isCore)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      <span className="ml-2.5 text-xs font-bold text-foreground min-w-[50px]">
                        {isEnabled ? "Activé" : "Masqué"}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied de page action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/50">
        <div className="w-full sm:w-auto">
          {successMessage && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-scale-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold animate-scale-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${
            justSaved
              ? "bg-emerald-600 text-white"
              : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
          } disabled:opacity-50`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enregistrement en cours...</span>
            </>
          ) : justSaved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Modifications enregistrées !</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Enregistrer les modifications</span>
            </>
          )}
        </button>
      </div>

      {/* Modal d'abonnement */}
      <SubscriptionModal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        defaultPlan="PRO"
      />
      {/* Assistant Métier réactivable à tout moment */}
      {showWizard && (
        <OnboardingWizard
          onComplete={() => setShowWizard(false)}
          canSkip={true}
        />
      )}
    </div>
  );
}
