"use client";

import React, { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LandingPage from '@/components/marketing/LandingPage';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/auth/Login';
import { StoreProvider } from '@/context/StoreContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (pathname === '/reset-password') return;
    if (role === 'cashier') {
      const allowedPaths = ['/', '/pos', '/debts', '/products', '/customers', '/support', '/profile'];
      if (!allowedPaths.includes(pathname)) {
        router.replace('/pos');
      }
    }
  }, [role, pathname, router]);

  // 1. Route publique : Réinitialisation de mot de passe (sans contrôle d'accès)
  if (pathname === '/reset-password') {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  // 2. Route publique : Page d'accueil ('/')
  // Affichage immédiat sans écran d'attente ni vérification bloquante
  if (pathname === '/') {
    // Si l'utilisateur est déjà connecté (ou dès qu'il se connecte), afficher le tableau de bord
    if (user) {
      return (
        <ErrorBoundary>
          <StoreProvider>
            <div className="flex min-h-screen">
              <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
              <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] ml-0 transition-all duration-300">
                <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
                <main className="flex-1 p-6">
                  {children}
                </main>
              </div>
            </div>
          </StoreProvider>
        </ErrorBoundary>
      );
    }

    // Si l'utilisateur clique sur "Se connecter" ou "Essai gratuit"
    if (showAuth) {
      return <Login initialIsSignUp={isSignUpMode} onBack={() => setShowAuth(false)} />;
    }

    // Affichage instantané de la LandingPage publique
    return (
      <ErrorBoundary>
        <LandingPage 
          onLoginClick={(signup) => {
            setIsSignUpMode(signup);
            setShowAuth(true);
          }} 
        />
      </ErrorBoundary>
    );
  }

  // 3. Routes privées (/pos, /products, /debts, /analytics, /orders, /settings, /team, etc.)
  // Le contrôle d'accès et le chargement s'exécutent UNIQUEMENT sur ces routes
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Accès sécurisé en cours...</p>
      </div>
    );
  }

  // Si non connecté sur une route privée : afficher l'écran de connexion sécurisé
  if (!user) {
    return <Login initialIsSignUp={false} onBack={() => router.replace('/')} />;
  }

  // Utilisateur connecté sur une route privée autorisée
  return (
    <ErrorBoundary>
      <StoreProvider>
        <div className="flex min-h-screen">
          <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
          <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] ml-0 transition-all duration-300">
            <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
            <main className="flex-1 p-6">
              {children}
            </main>
          </div>
        </div>
      </StoreProvider>
    </ErrorBoundary>
  );
}
