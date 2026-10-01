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
        const mappedStores = data.map((d: any) => ({ id: d.stores.id, name: d.stores.name, role: d.role }));
        setStores(mappedStores);
        
        const savedStoreId = localStorage.getItem('activeStoreId');
        let selected = mappedStores.find((s: any) => s.id === savedStoreId);
        if (!selected) selected = mappedStores[0];
        
        setActiveStore(selected);
      } else {
        setRole('admin');
      }
    } catch (e) {
      setRole('admin');
    }
  };

  useEffect(() => {
    if (activeStore) {
      setRole(activeStore.role);
      localStorage.setItem('activeStoreId', activeStore.id);
    }
  }, [activeStore]);

  useEffect(() => {
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
