"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'cashier' | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'cashier' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (data && data.role) {
        setRole(data.role);
      } else {
        setRole('admin'); // Fallback (Option B)
      }
    } catch (e) {
      setRole('admin'); // Fallback (Option B)
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        await fetchRole(session.user.id);
        setLoading(false);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
