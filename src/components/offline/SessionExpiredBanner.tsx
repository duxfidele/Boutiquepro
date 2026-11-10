"use client";

import React, { useState } from "react";
import { KeyRound, Loader2, ShieldAlert, X, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function SessionExpiredBanner() {
  const { user, role, sessionExpired, markSessionRestored } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredSuccess, setRestoredSuccess] = useState(false);

  if (!sessionExpired && !restoredSuccess) {
    return null;
  }

  const displayAccount = user?.email
    ? user.email.endsWith("@caisse.maboutique.app")
      ? `${user.email.replace("@caisse.maboutique.app", "")} (Caissier)`
      : user.email
    : "";

  const handleGoogleReconnect = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const origin =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : "https://maboutiquepro.app";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: origin },
      });
      if (error) {
        setErrorMsg(error.message);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de la redirection Google.");
      setIsSubmitting(false);
    }
  };

  const handleReconnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !password.trim()) {
      setErrorMsg("Veuillez saisir votre mot de passe.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        setErrorMsg(
          error.message === "Invalid login credentials"
            ? "Mot de passe incorrect."
            : error.message
        );
        return;
      }

      markSessionRestored();
      setPassword("");
      setRestoredSuccess(true);
      setShowModal(false);
      setTimeout(() => setRestoredSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Impossible de contacter le serveur d'authentification."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {restoredSuccess && !sessionExpired ? (
        <div className="print:hidden px-4 py-2 text-xs font-bold flex items-center gap-2 border-b bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Session restaurée avec succès ! La synchronisation de vos opérations en attente reprend automatiquement.
          </span>
        </div>
      ) : (
        <div className="print:hidden px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 border-b bg-rose-500/12 border-rose-500/30 text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-bold">
              Session expirée : vous pouvez continuer à encaisser hors-ligne sans perte, mais la synchronisation est en pause jusqu&apos;à reconnexion.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Se reconnecter sans perdre la file</span>
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-secondary/20">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">
                    Renouveler votre session
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Votre panier et votre file hors-ligne restent intacts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReconnect} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">
                  Compte connecté
                </label>
                <input
                  type="text"
                  value={displayAccount}
                  disabled
                  className="w-full rounded-xl border border-border/60 bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground opacity-80"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reconnect-password"
                  className="text-xs font-bold text-muted-foreground"
                >
                  Mot de passe
                </label>
                <input
                  id="reconnect-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  autoFocus
                  className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                {role !== "cashier" && (
                  <button
                    type="button"
                    onClick={handleGoogleReconnect}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 rounded-xl border border-border/70 bg-secondary/40 hover:bg-secondary text-xs font-bold text-foreground cursor-pointer disabled:opacity-50"
                  >
                    Compte Google
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-border/60 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Plus tard
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isSubmitting ? "Reconnexion..." : "Valider et Synchroniser"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
