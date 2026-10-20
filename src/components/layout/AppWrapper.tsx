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

    // B. Si l'utilisateur est un caissier mais que la formule actuelle ne permet aucun caissier (ex: formule Starter)
    if (role === "cashier" && (subscription?.limits?.maxCashiers ?? 0) === 0) {
      return (
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center select-none">
            <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border/60 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5 ring-8 ring-amber-500/5">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Accès Caissier Non Autorisé</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
                La formule actuelle de votre boutique (<b>Starter</b>) ne comprend aucun accès caissier. Veuillez contacter l&apos;administrateur pour passer à la formule <b>Pro</b> ou <b>Business</b>.
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

    // C. Utilisateur avec abonnement ou essai actif
    return (
      <ErrorBoundary>
        <StoreProvider>
          <div className="flex min-h-screen">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] ml-0 transition-all duration-300">
              {/* Bannière de rappel : Essai (en rose/rouge) ou Renouvellement abonnement actif (si <= 7 jours) */}
              {role === "admin" && subscription && (
                subscription.isTrial ? (
                  <div
                    className="px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/15 text-rose-600 dark:text-rose-400"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-rose-500 animate-pulse" />
                    <span className="font-bold">
                      {subscription.daysRemaining <= 0
                        ? "Période d'essai 14 jours : dernier jour aujourd'hui !"
                        : `Période d'essai 14 jours : il vous reste ${subscription.daysRemaining} jour${
                            subscription.daysRemaining > 1 ? "s" : ""
                          }.`}
                    </span>
                  </div>
                ) : (
                  subscription.daysRemaining <= 7 && (
                    <div
                      className="px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                    >
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                      <span className="font-bold">
                        Abonnement {subscription.tier} : il vous reste {subscription.daysRemaining} jour{subscription.daysRemaining > 1 ? "s" : ""} avant renouvellement.
                      </span>
                    </div>
                  )
                )
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
