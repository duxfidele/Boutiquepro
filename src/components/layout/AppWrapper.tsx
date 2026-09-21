"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/auth/Login';
import { StoreProvider } from '@/context/StoreContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Loader2 } from 'lucide-react';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Vérification de l'accès...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <StoreProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] ml-0 pb-20 lg:pb-0 transition-all duration-300">
          <Header />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </StoreProvider>
  );
}
