"use client";

import React, { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LandingPage from "@/components/marketing/LandingPage";
import { useAuth } from "@/context/AuthContext";
import Login from "@/components/auth/Login";
import { StoreProvider } from "@/context/StoreContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import SubscriptionModal from "@/components/subscription/SubscriptionModal";
import { Loader2, Lock, LogOut, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { user, role, loading, subscription, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (pathname === "/reset-password") return;
    if (role === "cashier") {
      const allowedPaths = ["/", "/pos", "/debts", "/products", "/customers", "/support", "/profile"];
      if (!allowedPaths.includes(pathname)) {
        router.replace("/pos");
      }
    }
  }, [role, pathname, router]);

  // 1. Route publique : Réinitialisation de mot de passe (sans contrôle d'accès)
  if (pathname === "/reset-password") {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  // 2. Utilisateur connecté (en ligne ou hors-ligne avec session en cache) :
  if (user) {
    // A. Si l'abonnement ou la période d'essai de 14 jours est EXPIRÉ(E)
    if (subscription?.isExpired) {
      if (role === "cashier") {
        // Pour le caissier : écran de verrouillage informatif
        return (
          <ErrorBoundary>
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center select-none">
              <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border/60 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-5 ring-8 ring-destructive/5">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">Accès Boutique Suspendu</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
                  La période d&apos;essai ou l&apos;abonnement de votre boutique est arrivé à échéance (14 jours). Veuillez contacter l&apos;administrateur pour renouveler l&apos;accès.
                </p>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 font-bold text-sm transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          </ErrorBoundary>
        );
      }

      // Pour l'administrateur : Paywall obligatoire et infranchissable (Moneriz Mobile Money / Carte)
      return (
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-4 select-none">
            <SubscriptionModal
              isOpen={true}
              onClose={() => {}}
              isLocked={true}
            />
          </div>
        </ErrorBoundary>
      );
    }

    // B. Utilisateur avec abonnement ou essai actif
    return (
      <ErrorBoundary>
        <StoreProvider>
          <div className="flex min-h-screen">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] ml-0 transition-all duration-300">
              {/* Bannière de rappel fin d'essai (Rose / Rouge percutante & animée) */}
              {subscription?.isTrial && role === "admin" && (
                <div
                  className="px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 border-b bg-rose-500/10 dark:bg-rose-950/40 border-rose-500/25 text-rose-900 dark:text-rose-200 shadow-2xs backdrop-blur-xs"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 animate-pulse" />
                    <span className="font-bold text-rose-900 dark:text-rose-100">
                      Période d&apos;essai 14 jours :
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-xs shadow-xs animate-glow-rose">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      {subscription.daysRemaining <= 0
                        ? "Dernier jour d'essai !"
                        : `il vous reste ${subscription.daysRemaining} jour${
                            subscription.daysRemaining > 1 ? "s" : ""
                          }`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    className="relative group overflow-hidden px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 hover:from-rose-500 hover:to-pink-600 text-white text-xs font-black hover:scale-105 active:scale-95 transition-all shrink-0 shadow-md shadow-rose-600/30 flex items-center gap-1.5 border border-white/20 cursor-pointer animate-glow-rose"
                  >
                    <span className="absolute inset-0 w-1/2 h-full bg-white/25 skew-x-12 -translate-x-full animate-btn-shimmer group-hover:translate-x-[300%] transition-transform duration-700 ease-out" />
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                    <span>S&apos;abonner</span>
                  </button>
                </div>
              )}

              <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
              <main className="flex-1 p-6">
                {children}
              </main>

              {/* Modal de souscription facultatif déclenché manuellement */}
              <SubscriptionModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                isLocked={false}
              />
            </div>
          </div>
        </StoreProvider>
      </ErrorBoundary>
    );
  }

  // 3. Si en cours de vérification de session et aucun utilisateur encore identifié
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Accès sécurisé en cours...</p>
      </div>
    );
  }

  // 4. Utilisateur non connecté sur la page d'accueil ('/')
  if (pathname === "/") {
    if (showAuth) {
      return <Login initialIsSignUp={isSignUpMode} onBack={() => setShowAuth(false)} />;
    }

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

  // 5. Utilisateur non connecté sur une route privée : redirection / affichage de la connexion
  return <Login initialIsSignUp={false} onBack={() => router.replace("/")} />;
}
