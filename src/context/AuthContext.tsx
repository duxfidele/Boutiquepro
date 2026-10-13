"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'cashier' | null;
  stores: any[];
  activeStore: any | null;
  setActiveStore: (store: any) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, stores: [], activeStore: null, setActiveStore: () => {}, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'cashier' | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [activeStore, setActiveStore] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('store_members')
        .select('role, store_id, stores ( id, name )')
        .eq('user_id', userId);
        
      if (data && data.length > 0) {
        // @ts-ignore
        const valid = data.map((d: any) => {
          const st = Array.isArray(d.stores) ? d.stores[0] : d.stores;
          return {
            role: d.role,
            store_id: d.store_id,
            id: st?.id || d.store_id,
            name: st?.name || 'Ma Boutique'
          };
        }).filter((d: any) => d.id);

        // ISOLATION STRICTE : Si l'utilisateur est un caissier
        const cashierStore = valid.find((d: any) => d.role === 'cashier');
        
        if (cashierStore) {
          // Le caissier ne voit QUE sa boutique assignée, rien d'autre !
          const singleStore = [{
            id: cashierStore.id,
            name: cashierStore.name,
            role: 'cashier'
          }];
          setStores(singleStore);
          setRole('cashier');
          setActiveStore(singleStore[0]);
          return;
        }

        // Sinon c'est un administrateur : il voit toutes ses boutiques
        const mappedStores = valid.map((d: any) => ({
          id: d.id,
          name: d.name,
          role: d.role
        }));

        setStores(mappedStores);
        setRole('admin');
        
        const savedStoreId = localStorage.getItem('activeStoreId');
        let selected = mappedStores.find((s: any) => s.id === savedStoreId);
        if (!selected) selected = mappedStores[0];
        
        setActiveStore(selected);
      } else {
        const fallback = { id: 'default', name: 'Ma Boutique', role: 'admin' };
        setStores([fallback]);
        setActiveStore(fallback);
        setRole('admin');
      }
    } catch (e) {
      const fallback = { id: 'default', name: 'Ma Boutique', role: 'admin' };
      if (!activeStore) setActiveStore(fallback);
      setRole('admin');
    }
  };

  useEffect(() => {
    if (activeStore) {
      setRole(activeStore.role);
      localStorage.setItem('activeStoreId', activeStore.id);
      try {
        localStorage.setItem('activeStoreObj', JSON.stringify(activeStore));
      } catch {}
    }
  }, [activeStore]);

  useEffect(() => {
    // Vérification instantanée du cache local pour éviter tout délai aux visiteurs
    const checkCachedSession = () => {
      try {
        if (typeof window === 'undefined') return false;
        const cachedStore = localStorage.getItem('activeStoreObj');
        if (cachedStore) {
          try {
            const parsedStore = JSON.parse(cachedStore);
            if (parsedStore?.id) {
              setActiveStore(parsedStore);
              setRole(parsedStore.role || 'admin');
            }
          } catch {}
        }
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
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
    if (!hasCached) {
      // Aucun token en cache : visiteur public, désactiver loading immédiatement
      setLoading(false);
    }

    // Vérification réseau auprès de Supabase en arrière-plan
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchStores(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        await fetchStores(session.user.id);
        setLoading(false);
      } else {
        setRole(null);
        setActiveStore(null);
        setStores([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, stores, activeStore, setActiveStore, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
