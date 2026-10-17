"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export interface StoreSubscription {
  plan: string;
  status: string;
  endsAt: string | null;
  daysRemaining: number;
  isExpired: boolean;
  isTrial: boolean;
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
}

export const computeSubscription = (store: any): StoreSubscription | null => {
  if (!store || !store.id) return null;

  const plan = (store.subscription_plan || "TRIAL").toUpperCase();
  const status = (store.subscription_status || "trial").toLowerCase();
  const isTrial = status === "trial" || plan === "TRIAL";

  let endsAtStr: string | null = store.subscription_ends_at || null;
  // Ne replier sur created_at + 14 jours QUE si c est un essai sans date explicite
  if (isTrial && !endsAtStr && store.created_at) {
    try {
      endsAtStr = new Date(new Date(store.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } catch {
      endsAtStr = null;
    }
  }

  let daysRemaining = 999;
  let isExpired = false;

  if (status === "expired" || status === "canceled") {
    isExpired = true;
    daysRemaining = 0;
  } else if (isTrial) {
    if (endsAtStr) {
      const endsAtTime = new Date(endsAtStr).getTime();
      const diffMs = endsAtTime - Date.now();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffMs <= 0) {
        isExpired = true;
      }
    }
  } else if (status === "active") {
    // Si abonnement actif : uniquement expiré si une date de fin est fixée ET dépassée
    if (endsAtStr) {
      const endsAtTime = new Date(endsAtStr).getTime();
      const diffMs = endsAtTime - Date.now();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffMs <= 0) {
        isExpired = true;
      }
    } else {
      isExpired = false;
      daysRemaining = 999;
    }
  }

  return {
    plan,
    status,
    endsAt: endsAtStr,
    daysRemaining,
    isExpired,
    isTrial,
  };
};

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

  const [activeStore, setActiveStore] = useState<any | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("activeStoreObj");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

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
      const { data } = await supabase
        .from("store_members")
        .select("role, store_id, stores ( id, name, created_at, subscription_plan, subscription_status, subscription_ends_at )")
        .eq("user_id", userId);

      if (data && data.length > 0) {
        // @ts-ignore
        const valid = data
          .map((d: any) => {
            const st = Array.isArray(d.stores) ? d.stores[0] : d.stores;
            const isStTrial = (st?.subscription_status || "trial").toLowerCase() === "trial" || (st?.subscription_plan || "TRIAL").toUpperCase() === "TRIAL";
            const fallbackEndsAt = isStTrial && st?.created_at
              ? new Date(new Date(st.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
              : null;

            return {
              role: d.role,
              store_id: d.store_id,
              id: st?.id || d.store_id,
              name: st?.name || "Ma Boutique",
              created_at: st?.created_at,
              subscription_plan: st?.subscription_plan || "TRIAL",
              subscription_status: st?.subscription_status || "trial",
              subscription_ends_at: st?.subscription_ends_at || fallbackEndsAt,
            };
          })
          .filter((d: any) => d.id);

        // ISOLATION STRICTE : Si l'utilisateur est un caissier
        const cashierStore = valid.find((d: any) => d.role === "cashier");

        if (cashierStore) {
          // Le caissier ne voit QUE sa boutique assignée, rien d'autre !
          const singleStore = [cashierStore];
          setStores(singleStore);
          setRole("cashier");
          setActiveStore(singleStore[0]);
          setSubscription(computeSubscription(singleStore[0]));
          try {
            localStorage.setItem("cachedStores", JSON.stringify(singleStore));
            localStorage.setItem("activeStoreObj", JSON.stringify(singleStore[0]));
          } catch {}
          return;
        }

        // Sinon c'est un administrateur : il voit toutes ses boutiques
        setStores(valid);
        setRole("admin");
        try {
          localStorage.setItem("cachedStores", JSON.stringify(valid));
        } catch {}

        const savedStoreId = localStorage.getItem("activeStoreId");
        let selected = valid.find((s: any) => s.id === savedStoreId);
        if (!selected) selected = valid[0];

        setActiveStore(selected);
        setSubscription(computeSubscription(selected));
      } else {
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
          setActiveStore(fallback);
          setSubscription(computeSubscription(fallback));
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
        setActiveStore(fallback);
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
              setActiveStore(parsedStore);
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
        setActiveStore(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        stores,
        activeStore,
        setActiveStore,
        subscription,
        refreshSubscription,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
