"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  clearSensitiveSnapshotsForUser,
  markOutboxAuthPaused,
  subscribeOfflineEvents,
} from "@/lib/offlineDb";
import { isNetworkLikeError, withNetworkTimeout } from "@/lib/offlineQueue";
import { probeServerHealth } from "@/lib/networkMonitor";
import {
  SubscriptionTier,
  PlanLimits,
  TIER_LIMITS,
  normalizeTier,
} from "@/lib/subscriptionPlans";
import {
  ModuleKey,
  ModuleStatus,
  resolveModuleStatus,
  DEFAULT_ENABLED_MODULES,
  StoreSector,
} from "@/types/modules";

export type AuthStatus =
  | "authenticated"
  | "offline_cached"
  | "session_expired"
  | "unauthenticated";

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
  authStatus: AuthStatus;
  sessionExpired: boolean;
  markSessionExpired: () => void;
  markSessionRestored: () => void;
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
  updateStoreModules: (
    newModules: ModuleKey[],
    newSector?: StoreSector | null
  ) => Promise<{ success: boolean; error?: string }>;
}

// ─── Helpers d'isolation localStorage par userId ─────────────────────────────

const scopedStoreObjKey = (uid: string) => `bp_active_store_${uid}`;
const scopedStoreIdKey = (uid: string) => `bp_active_store_id_${uid}`;
const scopedStoresListKey = (uid: string) => `bp_cached_stores_${uid}`;
const LAST_AUTH_UID_KEY = "bp_last_auth_uid";

function readCachedSupabaseToken(): {
  user: User | null;
  accessToken: string | null;
  expiresAtSec: number | null;
} {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null, expiresAtSec: null };
  }
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.user?.id) {
          return {
            user: parsed.user as User,
            accessToken: parsed.access_token || null,
            expiresAtSec:
              typeof parsed.expires_at === "number" ? parsed.expires_at : null,
          };
        }
      }
    }
  } catch {}
  return { user: null, accessToken: null, expiresAtSec: null };
}

function readUserScopedStore(uid: string): any | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const rawScoped = window.localStorage.getItem(scopedStoreObjKey(uid));
    if (rawScoped) {
      const parsed = JSON.parse(rawScoped);
      if (parsed?.id && parsed.id !== "default") return parsed;
    }
    // Repli ponctuel vers l'ancien cache global uniquement si le dernier userId correspond
    const lastUid = window.localStorage.getItem(LAST_AUTH_UID_KEY);
    if (!lastUid || lastUid === uid) {
      const legacyRaw = window.localStorage.getItem("activeStoreObj");
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed?.id && parsed.id !== "default") return parsed;
      }
    }
  } catch {}
  return null;
}

function readUserScopedStores(uid: string): any[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const rawScoped = window.localStorage.getItem(scopedStoresListKey(uid));
    if (rawScoped) {
      const parsed = JSON.parse(rawScoped);
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => s?.id && s.id !== "default");
      }
    }
    const lastUid = window.localStorage.getItem(LAST_AUTH_UID_KEY);
    if (!lastUid || lastUid === uid) {
      const legacyRaw = window.localStorage.getItem("cachedStores");
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => s?.id && s.id !== "default");
        }
      }
    }
  } catch {}
  return [];
}

function persistUserScopedStores(
  uid: string,
  storesList: any[],
  selectedStore: any | null
): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    window.localStorage.setItem(LAST_AUTH_UID_KEY, uid);
    window.localStorage.setItem(
      scopedStoresListKey(uid),
      JSON.stringify(storesList)
    );
    window.localStorage.setItem("cachedStores", JSON.stringify(storesList));

    if (selectedStore?.id && selectedStore.id !== "default") {
      window.localStorage.setItem(
        scopedStoreObjKey(uid),
        JSON.stringify(selectedStore)
      );
      window.localStorage.setItem(scopedStoreIdKey(uid), selectedStore.id);
      window.localStorage.setItem(
        "activeStoreObj",
        JSON.stringify(selectedStore)
      );
      window.localStorage.setItem("activeStoreId", selectedStore.id);
      if (
        selectedStore.enabled_modules &&
        Array.isArray(selectedStore.enabled_modules)
      ) {
        window.localStorage.setItem(
          `store_modules_${selectedStore.id}`,
          JSON.stringify(selectedStore.enabled_modules)
        );
      }
    }
  } catch {}
}

export const computeSubscription = (
  store: any,
  adminSub?: any
): StoreSubscription | null => {
  if (!store || !store.id || store.id === "default") return null;

  // 1. Détermination du statut réel : priorité à l'abonnement centralisé admin
  const status = (
    adminSub?.status ||
    store.subscription_status ||
    "trialing"
  ).toLowerCase();
  const isTrial =
    (status === "trial" || status === "trialing") && status !== "active";

  // 2. Formule
  const rawTier =
    adminSub?.plan_tier ||
    store.subscription_plan ||
    (isTrial ? "PRO" : "STARTER");
  const tier = normalizeTier(rawTier);
  const plan = (
    adminSub?.plan_tier ||
    store.subscription_plan ||
    (isTrial ? "TRIAL" : tier)
  ).toUpperCase();

  // 3. Date de fin exacte (sans décalage)
  let endsAtStr: string | null = null;
  if (isTrial) {
    endsAtStr =
      adminSub?.trial_ends_at ||
      adminSub?.current_period_ends_at ||
      store.subscription_ends_at ||
      null;
    if (!endsAtStr && store.created_at) {
      try {
        endsAtStr = new Date(
          new Date(store.created_at).getTime() + 14 * 24 * 60 * 60 * 1000
        ).toISOString();
      } catch {
        endsAtStr = null;
      }
    }
  } else {
    endsAtStr =
      adminSub?.current_period_ends_at || store.subscription_ends_at || null;
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
      daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  } else {
    daysRemaining = 999;
    isExpired = false;
  }

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
  authStatus: "unauthenticated",
  sessionExpired: false,
  markSessionExpired: () => {},
  markSessionRestored: () => {},
  tier: "PRO",
  limits: defaultLimits,
  canPrintReceipts: true,
  canOfferCredit: true,
  canUseInventory: true,
  canUseManualOrders: true,
  canUseAdvancedAnalytics: true,
  canManageTeam: true,
  hasMultiStore: false,
  enabledModules: DEFAULT_ENABLED_MODULES,
  businessSector: null,
  getModuleStatus: () => "available",
  isModuleActive: () => true,
  updateStoreModules: async () => ({ success: true }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const initialTokenCache =
    typeof window !== "undefined" ? readCachedSupabaseToken() : null;

  const [user, setUser] = useState<User | null>(
    () => initialTokenCache?.user || null
  );

  const [activeStore, setActiveStoreState] = useState<any | null>(() =>
    initialTokenCache?.user?.id
      ? readUserScopedStore(initialTokenCache.user.id)
      : null
  );

  const [role, setRole] = useState<"admin" | "cashier" | null>(() => {
    const uid = initialTokenCache?.user?.id;
    const st = uid ? readUserScopedStore(uid) : null;
    return st?.role || null;
  });

  const [stores, setStores] = useState<any[]>(() =>
    initialTokenCache?.user?.id
      ? readUserScopedStores(initialTokenCache.user.id)
      : []
  );

  const [subscription, setSubscription] = useState<StoreSubscription | null>(
    () => {
      const uid = initialTokenCache?.user?.id;
      const st = uid ? readUserScopedStore(uid) : null;
      return st ? computeSubscription(st) : null;
    }
  );

  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (!initialTokenCache?.user) return "unauthenticated";
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "offline_cached";
    }
    return "authenticated";
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return false;
  });

  const activeUserRef = useRef<User | null>(user);
  const activeStoreRef = useRef<any | null>(activeStore);
  activeUserRef.current = user;
  activeStoreRef.current = activeStore;

  const handleSetActiveStore = useCallback((store: any) => {
    if (store && store.id === "default") return;
    setActiveStoreState(store);
    const uid = activeUserRef.current?.id;
    if (store && uid && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LAST_AUTH_UID_KEY, uid);
        window.localStorage.setItem(scopedStoreIdKey(uid), store.id);
        window.localStorage.setItem(
          scopedStoreObjKey(uid),
          JSON.stringify(store)
        );
        window.localStorage.setItem("activeStoreId", store.id);
        window.localStorage.setItem("activeStoreObj", JSON.stringify(store));
        if (store.enabled_modules && Array.isArray(store.enabled_modules)) {
          window.localStorage.setItem(
            `store_modules_${store.id}`,
            JSON.stringify(store.enabled_modules)
          );
        }
      } catch {}
    }
  }, []);

  const markSessionExpired = useCallback(() => {
    setAuthStatus((prev) =>
      prev === "unauthenticated" ? "unauthenticated" : "session_expired"
    );
  }, []);

  const markSessionRestored = useCallback(() => {
    setAuthStatus("authenticated");
  }, []);

  const fetchStores = useCallback(
    async (userId: string, userEmail?: string | null) => {
      if (!userId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      try {
        // 1. Récupération de l'abonnement centralisé admin s'il existe
        let adminSub: any = null;
        try {
          const { data: subData } = await withNetworkTimeout(
            supabase
              .from("admin_subscriptions")
              .select(
                "plan_tier, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_starts_at, current_period_ends_at, max_stores, max_cashiers"
              )
              .eq("user_id", userId)
              .maybeSingle(),
            5000
          );
          if (subData) adminSub = subData;
        } catch {
          // Table absente ou hors ligne
        }

        // Utiliser userEmail passé explicitement (jamais la closure `user?.email` qui peut être obsolète)
        const currentUserEmail = (
          userEmail ?? activeUserRef.current?.email
        )?.toLowerCase();
        const isOwnerEmail =
          currentUserEmail === "saasfidele@gmail.com" ||
          currentUserEmail === "profidele91@gmail.com";
        if (isOwnerEmail && !adminSub) {
          adminSub = {
            plan_tier: "BUSINESS",
            status: "active",
            billing_cycle: "annual",
            current_period_ends_at: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString(),
            max_stores: 3,
            max_cashiers: 3,
          };
        } else if (
          adminSub &&
          adminSub.status === "trialing" &&
          adminSub.trial_ends_at
        ) {
          const trialEndTime = new Date(adminSub.trial_ends_at).getTime();
          if (trialEndTime < Date.now()) {
            adminSub.trial_ends_at = new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000
            ).toISOString();
          }
        }

        let data: any = null;
        const res = await withNetworkTimeout(
          supabase
            .from("store_members")
            .select(
              "role, store_id, stores ( id, name, created_at, owner_id, subscription_plan, subscription_status, subscription_ends_at, enabled_modules, business_sector )"
            )
            .eq("user_id", userId),
          6000
        );

        if (res.error) {
          if (isNetworkLikeError(res.error)) {
            return; // Conserver le cache local sans altérer stores/role
          }
          const fallbackRes = await withNetworkTimeout(
            supabase
              .from("store_members")
              .select(
                "role, store_id, stores ( id, name, created_at, owner_id, subscription_plan, subscription_status, subscription_ends_at )"
              )
              .eq("user_id", userId),
            6000
          );
          if (fallbackRes.error && isNetworkLikeError(fallbackRes.error)) {
            return;
          }
          data = fallbackRes.data;
        } else {
          data = res.data;
        }

        // Héritage d'abonnement du propriétaire pour les caissiers
        const cashierMember = data?.find((d: any) => d.role === "cashier");
        if (cashierMember) {
          const st = Array.isArray(cashierMember.stores)
            ? cashierMember.stores[0]
            : cashierMember.stores;
          const ownerId = st?.owner_id;
          if (ownerId && ownerId !== userId) {
            try {
              const { data: ownerSub } = await withNetworkTimeout(
                supabase
                  .from("admin_subscriptions")
                  .select(
                    "plan_tier, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_starts_at, current_period_ends_at, max_stores, max_cashiers"
                  )
                  .eq("user_id", ownerId)
                  .maybeSingle(),
                5000
              );
              if (ownerSub) adminSub = ownerSub;
            } catch {}
          }
        }

        if (data && data.length > 0) {
          const valid = data
            .map((d: any) => {
              const st = Array.isArray(d.stores) ? d.stores[0] : d.stores;
              const isStTrial =
                (st?.subscription_status || "trial").toLowerCase() ===
                  "trial" ||
                (st?.subscription_plan || "TRIAL").toUpperCase() === "TRIAL";
              const fallbackEndsAt =
                isStTrial && st?.created_at
                  ? new Date(
                      new Date(st.created_at).getTime() +
                        14 * 24 * 60 * 60 * 1000
                    ).toISOString()
                  : null;

              let cachedModules: string[] | null = null;
              if (typeof window !== "undefined" && (st?.id || d.store_id)) {
                try {
                  const raw = window.localStorage.getItem(
                    `store_modules_${st?.id || d.store_id}`
                  );
                  if (raw) cachedModules = JSON.parse(raw);
                } catch {}
              }
              const finalModules =
                cachedModules &&
                Array.isArray(cachedModules) &&
                cachedModules.length > 0
                  ? cachedModules
                  : st?.enabled_modules || DEFAULT_ENABLED_MODULES;

              let cachedSector: string | null = null;
              if (typeof window !== "undefined" && (st?.id || d.store_id)) {
                try {
                  cachedSector = window.localStorage.getItem(
                    `store_sector_${st?.id || d.store_id}`
                  );
                } catch {}
              }
              const finalSector = cachedSector || st?.business_sector || null;

              return {
                role: d.role,
                store_id: d.store_id,
                id: st?.id || d.store_id,
                name: st?.name || "Ma Boutique",
                created_at: st?.created_at,
                subscription_plan:
                  adminSub?.plan_tier || st?.subscription_plan || "TRIAL",
                subscription_status:
                  adminSub?.status || st?.subscription_status || "trial",
                subscription_ends_at:
                  (adminSub?.status === "active"
                    ? adminSub?.current_period_ends_at
                    : adminSub?.trial_ends_at ||
                      adminSub?.current_period_ends_at) ||
                  st?.subscription_ends_at ||
                  fallbackEndsAt,
                enabled_modules: finalModules,
                business_sector: finalSector,
              };
            })
            .filter((d: any) => d.id && d.id !== "default");

          // CONTRÔLE D'ÉTANCHÉITÉ DU PORTAIL DE CONNEXION
          const isCashierAccount =
            Boolean(
              currentUserEmail?.endsWith("@caisse.maboutique.app")
            ) ||
            (typeof window !== "undefined" &&
              window.sessionStorage.getItem("auth_portal_mode") === "cashier");

          const cashierStores = valid.filter((d: any) => d.role === "cashier");
          const adminStores = isCashierAccount
            ? []
            : valid.filter((d: any) => d.role === "admin");

          if (typeof window !== "undefined") {
            const requestedPortal =
              window.sessionStorage.getItem("auth_portal_mode");
            if (
              requestedPortal === "manager" &&
              cashierStores.length > 0 &&
              adminStores.length === 0
            ) {
              window.sessionStorage.removeItem("auth_portal_mode");
              window.sessionStorage.setItem(
                "login_error_message",
                "Accès refusé sur cet espace : Ce compte est un profil Caissier. Veuillez utiliser l'onglet 'Espace Caisse' pour vous connecter."
              );
              await supabase.auth.signOut();
              setUser(null);
              setRole(null);
              setStores([]);
              setActiveStoreState(null);
              setAuthStatus("unauthenticated");
              return;
            }

            if (
              requestedPortal === "cashier" &&
              adminStores.length > 0 &&
              cashierStores.length === 0
            ) {
              window.sessionStorage.removeItem("auth_portal_mode");
              window.sessionStorage.setItem(
                "login_error_message",
                "Accès refusé sur cet espace : Ce compte est un profil Administrateur / Gérant. Veuillez utiliser l'onglet 'Gérant / Admin' pour accéder à votre espace."
              );
              await supabase.auth.signOut();
              setUser(null);
              setRole(null);
              setStores([]);
              setActiveStoreState(null);
              setAuthStatus("unauthenticated");
              return;
            }
          }

          const savedStoreId =
            typeof window !== "undefined"
              ? window.localStorage.getItem(scopedStoreIdKey(userId)) ||
                window.localStorage.getItem("activeStoreId")
              : null;

          if (cashierStores.length > 0) {
            const selected =
              cashierStores.find((s: any) => s.id === savedStoreId) ||
              cashierStores[0];

            setStores(cashierStores);
            setRole("cashier");
            setActiveStoreState(selected);
            setSubscription(computeSubscription(selected, adminSub));
            persistUserScopedStores(userId, cashierStores, selected);
            return;
          }

          const selected =
            valid.find((s: any) => s.id === savedStoreId) || valid[0];
          setStores(valid);
          setRole("admin");
          setActiveStoreState(selected);
          setSubscription(computeSubscription(selected, adminSub));
          persistUserScopedStores(userId, valid, selected);
        } else {
          // Aucune boutique associée côté serveur : ne JAMAIS fabriquer une fausse boutique "default"
          const cached = readUserScopedStores(userId);
          if (cached.length === 0) {
            setStores([]);
            setActiveStoreState(null);
            setSubscription(null);
            setRole(null);
          }
        }
      } catch {
        // Réseau / erreur transitoire : préserver la boutique cachée existante
      }
    },
    []
  );

  // Écouter les événements AUTH_PAUSED venant du SyncEngine
  useEffect(() => {
    const unsub = subscribeOfflineEvents((ev) => {
      if (ev.type === "AUTH_PAUSED") {
        if (ev.paused) {
          setAuthStatus((prev) =>
            prev === "unauthenticated" ? "unauthenticated" : "session_expired"
          );
        } else {
          setAuthStatus("authenticated");
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeStore && activeStore.id !== "default") {
      setRole(activeStore.role);
      const sub = computeSubscription(activeStore);
      setSubscription(sub);

      const uid = activeUserRef.current?.id;
      if (uid && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LAST_AUTH_UID_KEY, uid);
          window.localStorage.setItem(scopedStoreIdKey(uid), activeStore.id);
          window.localStorage.setItem(
            scopedStoreObjKey(uid),
            JSON.stringify(activeStore)
          );
          window.localStorage.setItem("activeStoreId", activeStore.id);
          window.localStorage.setItem(
            "activeStoreObj",
            JSON.stringify(activeStore)
          );
        } catch {}
      }

      const interval = setInterval(() => {
        setSubscription(computeSubscription(activeStore));
      }, 30 * 60 * 1000);

      const handleResume = () => {
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
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
    const checkCachedSession = () => {
      const tokenInfo = readCachedSupabaseToken();
      if (!tokenInfo.user?.id) return false;

      const uid = tokenInfo.user.id;
      const lastUid =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LAST_AUTH_UID_KEY)
          : null;

      // Si changement d'utilisateur détecté entre deux démarrages, nettoyer les clés globales non scopées
      if (lastUid && lastUid !== uid && typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("activeStoreObj");
          window.localStorage.removeItem("activeStoreId");
          window.localStorage.removeItem("cachedStores");
        } catch {}
      }

      const cachedStore = readUserScopedStore(uid);
      if (cachedStore?.id) {
        setActiveStoreState(cachedStore);
        setRole(cachedStore.role || "admin");
        setSubscription(computeSubscription(cachedStore));
      }

      const cachedList = readUserScopedStores(uid);
      if (cachedList.length > 0) {
        setStores(cachedList);
      }

      setUser(tokenInfo.user);
      return true;
    };

    const hasCached = checkCachedSession();
    setLoading(false);

    // Vérification réseau auprès de Supabase en arrière-plan sans bloquer l'UI hors ligne
    withNetworkTimeout(supabase.auth.getSession(), 5000)
      .then(async ({ data: { session }, error }) => {
        if (session?.user) {
          setUser(session.user);
          setAuthStatus("authenticated");
          const health = await probeServerHealth({ timeoutMs: 3500 });
          if (health.isReachable) {
            fetchStores(session.user.id, session.user.email).catch(() => {});
          } else {
            setAuthStatus("offline_cached");
          }
        } else if (error && isNetworkLikeError(error) && hasCached) {
          setAuthStatus("offline_cached");
        } else if (!hasCached) {
          setUser(null);
          setAuthStatus("unauthenticated");
        } else {
          // Cache présent mais getSession n'a pas de session active : vérifier si vraiment hors ligne
          const health = await probeServerHealth({ timeoutMs: 3000 });
          if (!health.isReachable) {
            setAuthStatus("offline_cached");
          } else {
            setAuthStatus("session_expired");
          }
        }
      })
      .catch(() => {
        if (hasCached) {
          setAuthStatus("offline_cached");
        }
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
        setAuthStatus("unauthenticated");
        setLoading(false);
        return;
      }

      if (session?.user) {
        const isPendingSignup =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem("pending_signup_confirmation") ===
            "true";

        if (isPendingSignup) {
          setLoading(false);
          return;
        }

        const prevUid = activeUserRef.current?.id;
        if (prevUid && prevUid !== session.user.id && typeof window !== "undefined") {
          try {
            window.localStorage.removeItem("activeStoreObj");
            window.localStorage.removeItem("activeStoreId");
            window.localStorage.removeItem("cachedStores");
          } catch {}
          setActiveStoreState(readUserScopedStore(session.user.id));
          setStores(readUserScopedStores(session.user.id));
        }

        setUser(session.user);
        setAuthStatus("authenticated");

        // Réactiver d'éventuelles opérations outbox mises en pause suite à une expiration de jeton
        const curStoreId =
          activeStoreRef.current?.id || readUserScopedStore(session.user.id)?.id;
        if (curStoreId) {
          void markOutboxAuthPaused(session.user.id, curStoreId, false).catch(
            () => {}
          );
        }

        if (typeof navigator === "undefined" || navigator.onLine) {
          fetchStores(session.user.id, session.user.email).catch(() => {});
        }
        setLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, [fetchStores]);

  const refreshSubscription = async () => {
    if (user?.id) {
      await fetchStores(user.id, user.email);
    }
  };

  /**
   * Déconnexion propre & sécurisée :
   * Purge les snapshots/caches sensibles de l'utilisateur courant tout en conservant
   * intacts les opérations métier non synchronisées stockées dans IndexedDB `outbox`.
   */
  const signOut = async () => {
    const signingOutUid = user?.id;
    try {
      if (signingOutUid) {
        await clearSensitiveSnapshotsForUser(signingOutUid).catch(() => {});
      }
      if (typeof window !== "undefined") {
        const ls = window.localStorage;
        const keysToRemove: string[] = [
          "activeStoreObj",
          "activeStoreId",
          "cachedStores",
          LAST_AUTH_UID_KEY,
        ];
        if (signingOutUid) {
          keysToRemove.push(
            scopedStoreObjKey(signingOutUid),
            scopedStoreIdKey(signingOutUid),
            scopedStoresListKey(signingOutUid)
          );
        }
        // Nettoyer uniquement les caches d'état/dossiers historiques sans toucher les files legacy
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (
            k &&
            (k.startsWith("boutiquepro-state") ||
              k.startsWith("boutiquepro_debt_payments_") ||
              k.startsWith("boutiquepro_cash_sessions_"))
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => {
          try {
            ls.removeItem(k);
          } catch {}
        });
      }
    } catch {}

    try {
      await withNetworkTimeout(supabase.auth.signOut(), 3500);
    } catch {
      // Hors ligne : forcer la déconnexion locale propre sans bloquer l'interface
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }

    setUser(null);
    setRole(null);
    setActiveStoreState(null);
    setSubscription(null);
    setStores([]);
    setAuthStatus("unauthenticated");
  };

  const currentLimits = subscription?.limits || defaultLimits;
  const currentTier = subscription?.tier || "PRO";
  const isExpired = Boolean(subscription?.isExpired);
  const sessionExpired = authStatus === "session_expired";

  const effectiveEnabledModules: ModuleKey[] = React.useMemo(() => {
    if (
      activeStore?.enabled_modules &&
      Array.isArray(activeStore.enabled_modules) &&
      activeStore.enabled_modules.length > 0
    ) {
      return activeStore.enabled_modules;
    }
    if (typeof window !== "undefined" && activeStore?.id) {
      try {
        const raw = window.localStorage.getItem(
          `store_modules_${activeStore.id}`
        );
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_ENABLED_MODULES;
  }, [activeStore]);

  const getModuleStatus = React.useCallback(
    (moduleKey: ModuleKey): ModuleStatus => {
      return resolveModuleStatus(moduleKey, currentTier, effectiveEnabledModules);
    },
    [currentTier, effectiveEnabledModules]
  );

  const isModuleActive = React.useCallback(
    (moduleKey: ModuleKey): boolean => {
      return getModuleStatus(moduleKey) === "available";
    },
    [getModuleStatus]
  );

  const updateStoreModules = async (
    newModules: ModuleKey[],
    newSector?: StoreSector | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (!activeStore?.id || role !== "admin") {
      return {
        success: false,
        error: "Action réservée à l'administrateur de la boutique",
      };
    }

    try {
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
          window.localStorage.setItem(
            `store_modules_${activeStore.id}`,
            JSON.stringify(newModules)
          );
          if (newSector !== undefined && newSector !== null) {
            window.localStorage.setItem(
              `store_sector_${activeStore.id}`,
              String(newSector)
            );
          }
        } catch {}
      }

      const updates: Record<string, unknown> = {
        enabled_modules: newModules,
      };
      if (newSector !== undefined) {
        updates.business_sector = newSector;
      }

      try {
        const { error: rpcError } = await withNetworkTimeout(
          supabase.rpc("update_store_modules", {
            p_store_id: activeStore.id,
            p_modules: newModules,
            p_business_sector: newSector || null,
          }),
          6000
        );

        if (rpcError) {
          const { error: directError } = await withNetworkTimeout(
            supabase
              .from("stores")
              .update(updates)
              .eq("id", activeStore.id),
            5000
          );
          if (directError) {
            console.warn(
              "Notice synchronisation stores.enabled_modules:",
              directError
            );
          }
        }
      } catch (syncErr) {
        console.warn("Avertissement synchronisation distante modules:", syncErr);
      }

      return { success: true };
    } catch (err: any) {
      console.error("Erreur mise à jour modules:", err);
      return {
        success: false,
        error: err.message || "Erreur lors de l'enregistrement",
      };
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
        authStatus,
        sessionExpired,
        markSessionExpired,
        markSessionRestored,
        tier: currentTier,
        limits: currentLimits,
        canPrintReceipts: currentLimits.canPrintReceipts && !isExpired,
        canOfferCredit: currentLimits.canOfferCredit && !isExpired,
        canUseInventory: currentLimits.canUseInventory && !isExpired,
        canUseManualOrders: currentLimits.canUseManualOrders && !isExpired,
        canUseAdvancedAnalytics:
          currentLimits.canUseAdvancedAnalytics && !isExpired,
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
