"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export default function GoogleAuthCallbackPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const completeGoogleSignIn = async () => {
      try {
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#")
            ? window.location.hash.substring(1)
            : window.location.hash
        );
        const queryParams = new URLSearchParams(window.location.search);

        const oauthError =
          hashParams.get("error_description") ||
          queryParams.get("error_description") ||
          hashParams.get("error") ||
          queryParams.get("error");

        if (oauthError) {
          const cleanError =
            oauthError === "access_denied"
              ? "Connexion Google annulée."
              : oauthError;
          sessionStorage.setItem("login_error_message", cleanError);
          window.location.replace("/");
          return;
        }

        const idToken = hashParams.get("id_token");
        if (!idToken) {
          sessionStorage.setItem(
            "login_error_message",
            "Jeton d'authentification Google manquant. Veuillez réessayer."
          );
          window.location.replace("/");
          return;
        }

        const rawNonce =
          sessionStorage.getItem("google_oauth_nonce") ||
          localStorage.getItem("google_oauth_nonce") ||
          undefined;

        sessionStorage.removeItem("google_oauth_nonce");
        localStorage.removeItem("google_oauth_nonce");
        sessionStorage.removeItem("pending_signup_confirmation");
        sessionStorage.setItem("auth_portal_mode", "manager");

        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
          ...(rawNonce ? { nonce: rawNonce } : {}),
        });

        if (cancelled) return;

        if (error) {
          setErrorMsg(error.message || "Échec de la connexion avec Google.");
          sessionStorage.setItem(
            "login_error_message",
            error.message || "Échec de la connexion avec Google."
          );
          return;
        }

        window.location.replace("/");
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || "Erreur inattendue lors de la connexion Google.";
        setErrorMsg(msg);
      }
    };

    completeGoogleSignIn();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060517] text-white p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/[0.05] border border-white/10 backdrop-blur-xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
          <img src="/logo.png" alt="MaBoutiquePro" className="w-full h-full object-contain rounded-xl" />
        </div>

        {!errorMsg ? (
          <>
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin mx-auto mb-3" />
            <h1 className="text-lg font-bold text-white mb-1">
              Connexion sécurisée en cours...
            </h1>
            <p className="text-xs text-slate-300">
              Ouverture de votre espace MaBoutiquePro
            </p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h1 className="text-base font-bold text-white mb-2">
              Connexion interrompue
            </h1>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">{errorMsg}</p>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:brightness-110 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la connexion</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

