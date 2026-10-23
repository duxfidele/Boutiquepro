"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import {
  SubscriptionTier,
  PlanLimits,
  TIER_LIMITS,
  normalizeTier,
  getTierLimits,
} from "@/lib/subscriptionPlans";
import {
  ModuleKey,
  ModuleStatus,
  resolveModuleStatus,
  DEFAULT_ENABLED_MODULES,
  StoreSector,
} from "@/types/modules";

export interface StoreSubscription {
  plan: string;
  tier: SubscriptionTier;
  status: string;
  endsAt: string | null;
  daysRemaining: number;
  isExpired: boolean;
  isTrial: boolean;
  limits: PlanLimits;
}

interface AuthContextType {
  user: User | null;
  role: "admin" | "cashier" | null;
  stores: any[];
  activeStore: any | null;
  setActiveStore: (store: any) => void;
  subscription: StoreSubscription | null;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
  signOut: () => Promise<void>;
  // Raccourcis de permissions directs
  tier: SubscriptionTier;
  limits: PlanLimits;
  canPrintReceipts: boolean;
  canOfferCredit: boolean;
  canUseInventory: boolean;
  canUseManualOrders: boolean;
  canUseAdvancedAnalytics: boolean;
  canManageTeam: boolean;
  hasMultiStore: boolean;
  // Système de modules
  enabledModules: ModuleKey[];
  businessSector: StoreSector | null;
  getModuleStatus: (moduleKey: ModuleKey) => ModuleStatus;
  isModuleActive: (moduleKey: ModuleKey) => boolean;
  updateStoreModules: (newModules: ModuleKey[], newSector?: StoreSector | null) => Promise<{ success: boolean; error?: string }>;
}

export const computeSubscription = (store: any, adminSub?: any): StoreSubscription | null => {
  if (!store || !store.id) return null;

  // 1. Détermination du statut réel : priorité à l'abonnement centralisé admin
  const status = (adminSub?.status || store.subscription_status || "trialing").toLowerCase();
  const isTrial = (status === "trial" || status === "trialing") && status !== "active";

  // 2. Formule
  const rawTier = adminSub?.plan_tier || store.subscription_plan || (isTrial ? "PRO" : "STARTER");
  const tier = normalizeTier(rawTier);
  const plan = (adminSub?.plan_tier || store.subscription_plan || (isTrial ? "TRIAL" : tier)).toUpperCase();

  // 3. Date de fin exacte (sans décalage)
  let endsAtStr: string | null = null;
  if (isTrial) {
    endsAtStr = adminSub?.trial_ends_at || adminSub?.current_period_ends_at || store.subscription_ends_at || null;
    if (!endsAtStr && store.created_at) {
      try {
        endsAtStr = new Date(new Date(store.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      } catch {
        endsAtStr = null;
      }
    }
  } else {
    // Abonnement payant (actif ou en fin de période)
    endsAtStr = adminSub?.current_period_ends_at || store.subscription_ends_at || null;
  }

  // 4. Calcul précis du décompte sans décalage
  let daysRemaining = 0;
  let isExpired = false;

  if (status === "expired" || status === "canceled" || status === "cancelled") {
    isExpired = true;
    daysRemaining = 0;
  } else if (endsAtStr) {
    const endsAtTime = new Date(endsAtStr).getTime();
    const now = Date.now();
    const diffMs = endsAtTime - now;

    if (diffMs <= 0) {
      isExpired = true;
      daysRemaining = 0;
    } else {
      isExpired = false;
      // Arrondi supérieur strict pour décompter chaque tranche de 24h sans décalage
      daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  } else {
    // Forfait sans date de fin explicite
    daysRemaining = 999;
    isExpired = false;
  }

  // Durant l'essai gratuit de 14 jours, l'utilisateur a toutes les fonctionnalités PRO débloquées
  const effectiveTier: SubscriptionTier = isTrial ? "PRO" : tier;
  const limits = TIER_LIMITS[effectiveTier] || TIER_LIMITS.PRO;

  return {
    plan,
    tier: effectiveTier,
    status,
    endsAt: endsAtStr,
    daysRemaining,
    isExpired,
    isTrial,
    limits,
  };
};

const defaultLimits: PlanLimits = TIER_LIMITS.PRO;

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  stores: [],
  activeStore: null,
  setActiveStore: () => {},
  subscription: null,
  refreshSubscription: async () => {},
  loading: true,
  signOut: async () => {},
  tier: "PRO",
  limits: defaultLimits,
  canPrintReceipts: true,
  canOfferCredit: true,
  canUseInventory: true,
  canUseManualOrders: true,
  canUseAdvancedAnalytics: true,
  canManageTeam: true,
  hasMultiStore: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.user) return parsed.user;
          }
        }
      }
    } catch {}
    return null;
  });

  const [activeStore, setActiveStoreState] = useState<any | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("activeStoreObj");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const handleSetActiveStore = (store: any) => {
    setActiveStoreState(store);
    if (store && typeof window !== "undefined") {
      try {
        localStorage.setItem("activeStoreId", store.id);
        localStorage.setItem("activeStoreObj", JSON.stringify(store));
        if (store.enabled_modules && Array.isArray(store.enabled_modules)) {
          localStorage.setItem(`store_modules_${store.id}`, JSON.stringify(store.enabled_modules));
        }
      } catch {}
    }
  };

  const [role, setRole] = useState<"admin" | "cashier" | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("activeStoreObj");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.role || "admin";
      }
    } catch {}
    return null;
  });

  const [stores, setStores] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("cachedStores");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [subscription, setSubscription] = useState<StoreSubscription | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("activeStoreObj");
      if (raw) {
        const parsed = JSON.parse(raw);
        return computeSubscription(parsed);
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          return false; // Token déjà en cache : zéro attente !
        }
      }
    } catch {}
    return false;
  });

  const fetchStores = async (userId: string) => {
    // Si nous sommes hors ligne, ne pas tenter la requête réseau
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    try {
      // 1. Récupération de l'abonnement centralisé admin s'il existe
      let adminSub: any = null;
      try {
        const { data: subData } = await supabase
          .from("admin_subscriptions")
          .select("plan_tier, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_starts_at, current_period_ends_at, max_stores, max_cashiers")
          .eq("user_id", userId)
          .maybeSingle();
        if (subData) {
          adminSub = subData;
        }
      } catch {
        // Table admin_subscriptions non encore créée ou accès restreint
      }

      // A. Sécurité dédiée compte propriétaire payant saasfidele@gmail.com (uniquement si non encore en base)
      const currentUserEmail = user?.email?.toLowerCase();
      const isOwnerEmail = currentUserEmail === "saasfidele@gmail.com" || currentUserEmail === "profidele91@gmail.com";
      if (isOwnerEmail && !adminSub) {
        adminSub = {
          plan_tier: "BUSINESS",
          status: "active",
          billing_cycle: "annual",
          current_period_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          max_stores: 3,
          max_cashiers: 3,
        };
      } else if (adminSub && adminSub.status === "trialing" && adminSub.trial_ends_at) {
        // B. Protection générale des boutiques créées avant le lancement du système :
        // Si leur date d'essai est expirée parce que la boutique date d'il y a des semaines,
        // on accorde 14 jours complets à partir de maintenant au lieu de bloquer brutalement !
        const trialEndTime = new Date(adminSub.trial_ends_at).getTime();
        if (trialEndTime < Date.now()) {
          adminSub.trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      const { data } = await supabase
        .from("store_members")
        .select("role, store_id, stores ( id, name, created_at, owner_id, subscription_plan, subscription_status, subscription_ends_at, enabled_modules, business_sector )")
        .eq("user_id", userId);

      // C. Si l'utilisateur est un caissier, il hérite automatiquement de l'abonnement du propriétaire de sa boutique
      const cashierMember = data?.find((d: any) => d.role === "cashier");
      if (cashierMember) {
        const st = Array.isArray(cashierMember.stores) ? cashierMember.stores[0] : cashierMember.stores;
        const ownerId = st?.owner_id;
        if (ownerId && ownerId !== userId) {
          try {
            const { data: ownerSub } = await supabase
              .from("admin_subscriptions")
              .select("plan_tier, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_starts_at, current_period_ends_at, max_stores, max_cashiers")
              .eq("user_id", ownerId)
              .maybeSingle();
            if (ownerSub) {
              adminSub = ownerSub;
            }
          } catch {}
        }
      }

      if (data && data.length > 0) {
        // @ts-ignore
        const valid = data
          .map((d: any) => {
            const st = Array.isArray(d.stores) ? d.stores[0] : d.stores;
            const isStTrial = (st?.subscription_status || "trial").toLowerCase() === "trial" || (st?.subscription_plan || "TRIAL").toUpperCase() === "TRIAL";
            const fallbackEndsAt = isStTrial && st?.created_at
              ? new Date(new Date(st.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
              : null;

            let cachedModules: string[] | null = null;
            if (typeof window !== "undefined" && (st?.id || d.store_id)) {
              try {
                const raw = localStorage.getItem(`store_modules_${st?.id || d.store_id}`);
                if (raw) cachedModules = JSON.parse(raw);
              } catch {}
            }
            const finalModules = st?.enabled_modules || cachedModules || DEFAULT_ENABLED_MODULES;

            return {
              role: d.role,
              store_id: d.store_id,
              id: st?.id || d.store_id,
              name: st?.name || "Ma Boutique",
              created_at: st?.created_at,
              subscription_plan: adminSub?.plan_tier || st?.subscription_plan || "TRIAL",
              subscription_status: adminSub?.status || st?.subscription_status || "trial",
              subscription_ends_at: (adminSub?.status === 'active' ? adminSub?.current_period_ends_at : (adminSub?.trial_ends_at || adminSub?.current_period_ends_at)) || st?.subscription_ends_at || fallbackEndsAt,
              enabled_modules: finalModules,
              business_sector: st?.business_sector || null,
            };
          })
          .filter((d: any) => d.id);

        // CONTRÔLE D'ÉTANCHÉITÉ STRICTE DU PORTAIL DE CONNEXION
        const cashierStores = valid.filter((d: any) => d.role === "cashier");
        const adminStores = valid.filter((d: any) => d.role === "admin");

        if (typeof window !== "undefined") {
          const requestedPortal = sessionStorage.getItem("auth_portal_mode");
          if (requestedPortal === "manager" && cashierStores.length > 0 && adminStores.length === 0) {
            sessionStorage.removeItem("auth_portal_mode");
            sessionStorage.setItem(
              "login_error_message",
              "Accès refusé sur cet espace : Ce compte est un profil Caissier. Veuillez utiliser l'onglet 'Espace Caisse' pour vous connecter."
            );
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            setStores([]);
            setActiveStoreState(null);
            return;
          }

          if (requestedPortal === "cashier" && adminStores.length > 0 && cashierStores.length === 0) {
            sessionStorage.removeItem("auth_portal_mode");
            sessionStorage.setItem(
              "login_error_message",
              "Accès refusé sur cet espace : Ce compte est un profil Administrateur / Gérant. Veuillez utiliser l'onglet 'Gérant / Admin' pour accéder à votre espace."
            );
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            setStores([]);
            setActiveStoreState(null);
            return;
          }
        }

        // ISOLATION STRICTE : Si l'utilisateur est un caissier

        if (cashierStores.length > 0) {
          // Le caissier ne voit QUE les boutiques auxquelles il est affecté
          const savedStoreId = typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : null;
          let selected = cashierStores.find((s: any) => s.id === savedStoreId);
          if (!selected) {
            selected = cashierStores[0];
          }

          setStores(cashierStores);
          setRole("cashier");
          setActiveStoreState(selected);
          setSubscription(computeSubscription(selected, adminSub));
          try {
            localStorage.setItem("cachedStores", JSON.stringify(cashierStores));
            localStorage.setItem("activeStoreObj", JSON.stringify(selected));
            localStorage.setItem("activeStoreId", selected.id);
            if (selected?.enabled_modules) {
              localStorage.setItem(`store_modules_${selected.id}`, JSON.stringify(selected.enabled_modules));
            }
          } catch {}
          return;
        }

        // Sinon c'est un administrateur : il voit toutes ses boutiques
        setStores(valid);
        setRole("admin");
        try {
          localStorage.setItem("cachedStores", JSON.stringify(valid));
        } catch {}

        const savedStoreId = typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : null;
        let selected = valid.find((s: any) => s.id === savedStoreId);

        if (!selected) {
          selected = valid[0];
        }
        try {
          localStorage.setItem("activeStoreId", selected.id);
          localStorage.setItem("activeStoreObj", JSON.stringify(selected));
          if (selected?.enabled_modules) {
            localStorage.setItem(`store_modules_${selected.id}`, JSON.stringify(selected.enabled_modules));
          }
        } catch {}

        setActiveStoreState(selected);
        setSubscription(computeSubscription(selected, adminSub));
      } else {
        if (!activeStore) {
          const fallback = {
            id: "default",
            name: "Ma Boutique",
            role: "admin",
            subscription_plan: adminSub?.plan_tier || "TRIAL",
            subscription_status: adminSub?.status || "trial",
            subscription_ends_at: adminSub?.current_period_ends_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          };
          setStores([fallback]);
          setActiveStoreState(fallback);
          setSubscription(computeSubscription(fallback, adminSub));
          setRole("admin");
        }
      }
    } catch (e) {
      // En cas d'erreur réseau, préserver la boutique existante
      if (!activeStore) {
        const fallback = {
          id: "default",
          name: "Ma Boutique",
          role: "admin",
          subscription_plan: "TRIAL",
          subscription_status: "trial",
          subscription_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        };
        setStores([fallback]);
        setActiveStoreState(fallback);
        setSubscription(computeSubscription(fallback));
        setRole("admin");
      }
    }
  };

  useEffect(() => {
    if (activeStore) {
      setRole(activeStore.role);
      const sub = computeSubscription(activeStore);
      setSubscription(sub);
      try {
        localStorage.setItem("activeStoreId", activeStore.id);
        localStorage.setItem("activeStoreObj", JSON.stringify(activeStore));
      } catch {}

      // Mise à jour automatique du décompte en temps réel (au réveil du téléphone ou toutes les 30 min)
      const interval = setInterval(() => {
        setSubscription(computeSubscription(activeStore));
      }, 30 * 60 * 1000);

      const handleResume = () => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          setSubscription(computeSubscription(activeStore));
        }
      };

      window.addEventListener("visibilitychange", handleResume);
      window.addEventListener("focus", handleResume);

      return () => {
        clearInterval(interval);
        window.removeEventListener("visibilitychange", handleResume);
        window.removeEventListener("focus", handleResume);
      };
    }
  }, [activeStore]);

  useEffect(() => {
    // Vérification instantanée du cache local pour un chargement immédiat hors-ligne et en-ligne
    const checkCachedSession = () => {
      try {
        if (typeof window === "undefined") return false;

        const cachedStore = localStorage.getItem("activeStoreObj");
        if (cachedStore) {
          try {
            const parsedStore = JSON.parse(cachedStore);
            if (parsedStore?.id) {
              setActiveStoreState(parsedStore);
              setRole(parsedStore.role || "admin");
              setSubscription(computeSubscription(parsedStore));
            }
          } catch {}
        }

        const cachedStoresRaw = localStorage.getItem("cachedStores");
        if (cachedStoresRaw) {
          try {
            const parsedStores = JSON.parse(cachedStoresRaw);
            if (Array.isArray(parsedStores) && parsedStores.length > 0) {
              setStores(parsedStores);
            }
          } catch {}
        }

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.user) {
                setUser(parsed.user);
                return true;
              }
            }
          }
        }
      } catch (e) {}
      return false;
    };

    const hasCached = checkCachedSession();
    // Désactiver le spinner pour l'accès instantané
    setLoading(false);

    // Vérification réseau auprès de Supabase en arrière-plan sans bloquer l'UI
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          if (typeof navigator === "undefined" || navigator.onLine) {
            fetchStores(session.user.id).catch(() => {});
          }
        } else if (!hasCached) {
          setUser(null);
        }
      })
      .catch(() => {
        // En cas d'erreur réseau (hors-ligne), conserver la session du cache local
      });

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        setActiveStoreState(null);
        setSubscription(null);
        setStores([]);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        if (typeof navigator === "undefined" || navigator.onLine) {
          fetchStores(session.user.id).catch(() => {});
        }
        setLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  const refreshSubscription = async () => {
    if (user?.id) {
      await fetchStores(user.id);
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem("activeStoreObj");
      localStorage.removeItem("activeStoreId");
      localStorage.removeItem("cachedStores");
    } catch {}
    await supabase.auth.signOut();
  };

  const currentLimits = subscription?.limits || defaultLimits;
  const currentTier = subscription?.tier || "PRO";
  const isExpired = Boolean(subscription?.isExpired);

  const effectiveEnabledModules: ModuleKey[] = React.useMemo(() => {
    if (activeStore?.enabled_modules && Array.isArray(activeStore.enabled_modules) && activeStore.enabled_modules.length > 0) {
      return activeStore.enabled_modules;
    }
    if (typeof window !== "undefined" && activeStore?.id) {
      try {
        const raw = localStorage.getItem(`store_modules_${activeStore.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_ENABLED_MODULES;
  }, [activeStore]);

  const getModuleStatus = React.useCallback((moduleKey: ModuleKey): ModuleStatus => {
    return resolveModuleStatus(moduleKey, currentTier, effectiveEnabledModules);
  }, [currentTier, effectiveEnabledModules]);

  const isModuleActive = React.useCallback((moduleKey: ModuleKey): boolean => {
    return getModuleStatus(moduleKey) === 'available';
  }, [getModuleStatus]);

  const updateStoreModules = async (
    newModules: ModuleKey[],
    newSector?: StoreSector | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (!activeStore?.id || role !== "admin") {
      return { success: false, error: "Action réservée à l'administrateur de la boutique" };
    }

    try {
      const updates: any = {
        enabled_modules: newModules,
      };
      if (newSector !== undefined) {
        updates.business_sector = newSector;
      }

      const { error } = await supabase
        .from("stores")
        .update(updates)
        .eq("id", activeStore.id);

      if (error) throw error;

      const updatedStore = {
        ...activeStore,
        enabled_modules: newModules,
        ...(newSector !== undefined ? { business_sector: newSector } : {}),
      };

      handleSetActiveStore(updatedStore);
      setStores((prev) =>
        prev.map((s) => (s.id === activeStore.id ? updatedStore : s))
      );

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`store_modules_${activeStore.id}`, JSON.stringify(newModules));
        } catch {}
      }

      return { success: true };
    } catch (err: any) {
      console.error("Erreur mise à jour modules:", err);
      return { success: false, error: err.message || "Erreur lors de l'enregistrement" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        stores,
        activeStore,
        setActiveStore: handleSetActiveStore,
        subscription,
        refreshSubscription,
        loading,
        signOut,
        tier: currentTier,
        limits: currentLimits,
        canPrintReceipts: currentLimits.canPrintReceipts && !isExpired,
        canOfferCredit: currentLimits.canOfferCredit && !isExpired,
        canUseInventory: currentLimits.canUseInventory && !isExpired,
        canUseManualOrders: currentLimits.canUseManualOrders && !isExpired,
        canUseAdvancedAnalytics: currentLimits.canUseAdvancedAnalytics && !isExpired,
        canManageTeam: currentLimits.canManageTeam && !isExpired,
        hasMultiStore: currentLimits.hasMultiStore && !isExpired,
        enabledModules: effectiveEnabledModules,
        businessSector: activeStore?.business_sector || null,
        getModuleStatus,
        isModuleActive,
        updateStoreModules,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
