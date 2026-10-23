"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Store,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  ShoppingCart,
  Building2,
  User,
  Info
} from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

export default function Login({
  initialIsSignUp = false,
  onBack,
}: {
  initialIsSignUp?: boolean;
  onBack?: () => void;
}) {
  const [portalMode, setPortalMode] = useState<"manager" | "cashier">("manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Sécurité Anti-Bot & Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");
  const [formMountedAt] = useState<number>(() => Date.now());

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedErr = sessionStorage.getItem("login_error_message");
      if (savedErr) {
        setMessage({ type: "error", text: savedErr });
        sessionStorage.removeItem("login_error_message");
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSignUp) {
      // 1. Détection bot par Honeypot
      if (honeypot.trim() !== "") {
        setLoading(false);
        setMessage({ type: "error", text: "Erreur de validation du formulaire." });
        return;
      }

      // 2. Détection bot par soumission instantanée (< 1.2s)
      if (Date.now() - formMountedAt < 1200) {
        setLoading(false);
        setMessage({ type: "error", text: "Veuillez patienter un instant avant de valider votre inscription." });
        return;
      }

      if (password !== confirmPassword) {
        setMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
        setLoading(false);
        return;
      }

      // 3. Vérification Cloudflare Turnstile côté serveur
      try {
        const verifyRes = await fetch("/api/auth/verify-turnstile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.ok) {
          setMessage({
            type: "error",
            text: verifyData.error || "Échec de validation de sécurité anti-robot. Veuillez recharger la page.",
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Erreur vérification anti-bot:", err);
      }

      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMessage({ type: "error", text: "Cet email est déjà utilisé." });
      } else {
        setMessage({
          type: "success",
          text: "Compte créé ! Veuillez vérifier votre boîte mail pour confirmer votre inscription.",
        });
      }
    } else {
      const cleanInput = email.trim().toLowerCase();

      // 1. Contrôle préalable selon le portail sélectionné
      if (portalMode === "manager") {
        if (!cleanInput.includes("@")) {
          setMessage({
            type: "error",
            text: "Veuillez saisir une adresse e-mail administrateur valide (ex: admin@boutique.com). Pour un identifiant caissier court (ex: caisse1), veuillez utiliser l'onglet 'Espace Caisse'.",
          });
          setLoading(false);
          return;
        }

        if (cleanInput.endsWith("@caisse.maboutique.app")) {
          setMessage({
            type: "error",
            text: "Cet identifiant correspond à un compte Caissier. Veuillez vous connecter via l'onglet 'Espace Caisse'.",
          });
          setLoading(false);
          return;
        }
      }

      // Supporte l'email direct (admin/caissier) OU l'identifiant caissier (ex: caisse1)
      let cleanEmail = cleanInput.includes("@")
        ? cleanInput
        : `${cleanInput}@caisse.maboutique.app`;

      if (typeof window !== "undefined") {
        sessionStorage.setItem("auth_portal_mode", portalMode);
      }

      let { data: authData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      // En mode caissier : si échec, l'utilisateur a peut-être saisi son prénom/nom (ex: "Pascaline") au lieu de l'identifiant (ex: "caisse2")
      if (error && portalMode === "cashier") {
        try {
          const { data: profileMatch } = await supabase
            .from("profiles")
            .select("email")
            .ilike("full_name", `%${cleanInput}%`)
            .maybeSingle();

          if (profileMatch?.email && profileMatch.email !== cleanEmail) {
            const retryRes = await supabase.auth.signInWithPassword({
              email: profileMatch.email,
              password,
            });
            if (!retryRes.error) {
              authData = retryRes.data;
              error = null;
              cleanEmail = profileMatch.email;
            }
          }
        } catch {}
      }

      if (error) {
        if (error.message?.includes("Email not confirmed")) {
          setMessage({
            type: "error",
            text: "Votre adresse e-mail n'a pas encore été confirmée. Vérifiez vos emails.",
          });
        } else if (error.message?.toLowerCase().includes("rate limit") || (error as any).status === 429) {
          setMessage({
            type: "error",
            text: "Trop de tentatives de connexion. Veuillez patienter une minute avant de réessayer.",
          });
        } else {
          setMessage({
            type: "error",
            text: portalMode === "cashier"
              ? "Identifiant de caisse ou mot de passe incorrect."
              : "Email ou mot de passe incorrect.",
          });
        }
        setLoading(false);
        return;
      }

      // 2. Contrôle d'étanchéité stricte des rôles après authentification réussie
      if (authData?.user) {
        try {
          const userId = authData.user.id;

          // Récupération des rôles dans store_members, profiles et stores
          const [profileRes, membersRes, ownedStoresRes] = await Promise.all([
            supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
            supabase.from("store_members").select("role").eq("user_id", userId),
            supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", userId),
          ]);

          const isStoreOwner = (ownedStoresRes.count ?? 0) > 0;
          const hasAdminMemberRole = membersRes.data?.some((m: any) => m.role === "admin") ?? false;
          const isProfileAdmin = profileRes.data?.role === "admin" || (!profileRes.data?.role && isStoreOwner);
          const isAdmin = isStoreOwner || hasAdminMemberRole || isProfileAdmin;

          const hasCashierMemberRole = membersRes.data?.some((m: any) => m.role === "cashier") ?? false;
          const isProfileCashier = profileRes.data?.role === "cashier" || cleanEmail.endsWith("@caisse.maboutique.app");
          const isCashier = hasCashierMemberRole || isProfileCashier;

          if (portalMode === "manager" && isCashier && !isAdmin) {
            await supabase.auth.signOut();
            setMessage({
              type: "error",
              text: "Accès refusé sur cet espace : Ce compte est un profil Caissier. Veuillez utiliser l'onglet 'Espace Caisse' pour vous connecter.",
            });
            setLoading(false);
            return;
          }

          if (portalMode === "cashier" && isAdmin && !isCashier) {
            await supabase.auth.signOut();
            setMessage({
              type: "error",
              text: "Ce compte est un profil Administrateur / Gérant. Veuillez utiliser l'onglet 'Gérant / Admin' pour accéder à votre espace.",
            });
            setLoading(false);
            return;
          }
        } catch (roleErr) {
          console.warn("Vérification étanchéité rôle:", roleErr);
        }
      }
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ type: "error", text: "Veuillez renseigner votre adresse e-mail." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://maboutiquepro.app";
      const redirectTo = `${origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        setMessage({
          type: "error",
          text: error.message || "Erreur lors de l'envoi de l'e-mail de réinitialisation.",
        });
      } else {
        setResetSent(true);
        setMessage({
          type: "success",
          text: `Un lien de réinitialisation a été envoyé à ${email.trim()}. Vérifiez votre boîte de réception (et vos spams) pour définir un nouveau mot de passe.`,
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Une erreur inattendue est survenue." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-card/85 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl p-7 sm:p-8 relative z-10 animate-scale-in">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Retour à l&apos;accueil</span>
          </button>
        )}

        {/* Sélecteur de profil : Gérant vs Caissier */}
        {!isForgotPassword && !isSignUp && (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-secondary/60 border border-border/50 mb-6">
            <button
              type="button"
              onClick={() => {
                setPortalMode("manager");
                setMessage(null);
                setEmail("");
                setPassword("");
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                portalMode === "manager"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Gérant / Admin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode("cashier");
                setMessage(null);
                setEmail("");
                setPassword("");
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                portalMode === "cashier"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Espace Caisse</span>
            </button>
          </div>
        )}

        {/* Header Carte Connexion */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center p-2 mb-3 shadow-md border border-border/40 bg-white dark:bg-card">
            {isForgotPassword ? (
              <KeyRound className="h-8 w-8 text-primary" />
            ) : portalMode === "cashier" ? (
              <ShoppingCart className="h-8 w-8 text-amber-500" />
            ) : (
              <img src="/logo.png" alt="MaBoutiquePro" className="w-full h-full object-contain" />
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground text-center">
            {isForgotPassword
              ? "Mot de passe oublié"
              : portalMode === "cashier"
              ? "Connexion Caissier"
              : "MaBoutiquePro"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 text-center">
            {isForgotPassword
              ? "Entrez votre email pour réinitialiser votre accès"
              : isSignUp
              ? "Création de votre compte professionnel"
              : portalMode === "cashier"
              ? "Accédez à votre poste de caisse pour démarrer vos ventes"
              : "Connexion sécurisée à votre espace de gestion"}
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-3.5 rounded-xl flex items-start gap-3 animate-fade-in border ${
              message.type === "error"
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {message.type === "error" ? (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium leading-relaxed">{message.text}</p>
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground ml-1">Adresse Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="admin@boutique.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center shadow-lg shadow-primary/20 mt-4"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </div>
              ) : resetSent ? (
                "Renvoyer le lien de réinitialisation"
              ) : (
                "Envoyer le lien de réinitialisation"
              )}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setMessage(null);
                  setResetSent(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour à la connexion</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Honeypot invisible pour les humains, piège pour les robots spammeurs */}
            <input
              type="text"
              name="b_phone_fax"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ display: "none", position: "absolute", left: "-9999px" }}
              aria-hidden="true"
            />

            {/* Note d'information dédiée pour le caissier */}
            {portalMode === "cashier" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Saisissez l&apos;identifiant court (ex: <b>caisse1</b>) et le mot de passe attribués par votre gérant.
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground ml-1">
                {portalMode === "cashier" ? "Identifiant de caisse" : isSignUp ? "Adresse Email" : "Adresse Email Administrateur"}
              </label>
              <div className="relative">
                {portalMode === "cashier" ? (
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                ) : (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
                <input
                  type={portalMode === "cashier" ? "text" : "email"}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder={
                    portalMode === "cashier"
                      ? "caisse1 ou caissier@boutique.com"
                      : "admin@boutique.com"
                  }
                  autoComplete={isSignUp ? "email" : portalMode === "cashier" ? "username" : "email"}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground ml-1">
                  {portalMode === "cashier" ? "Mot de passe de caisse" : "Mot de passe"}
                </label>
                {!isSignUp && portalMode === "manager" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setMessage(null);
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="••••••••"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-semibold text-foreground ml-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="pt-1">
                <TurnstileWidget
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken("")}
                  onError={() => setTurnstileToken("")}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || (isSignUp && !confirmPassword)}
              className={`w-full py-2.5 px-4 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center shadow-lg mt-3 ${
                portalMode === "cashier"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20"
                  : "bg-primary hover:opacity-90 shadow-primary/20"
              }`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </div>
              ) : isSignUp ? (
                "Créer mon compte"
              ) : portalMode === "cashier" ? (
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span>Ouvrir ma caisse</span>
                </span>
              ) : (
                "Se connecter"
              )}
            </button>

            {portalMode === "cashier" ? (
              <div className="pt-2 text-center">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Votre compte de caisse est géré par l&apos;administrateur de la boutique. En cas d&apos;oubli de mot de passe, demandez à votre gérant de le réinitialiser.
                </p>
              </div>
            ) : (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setMessage(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  {isSignUp ? "Déjà un compte ? Connectez-vous" : "Pas encore de compte ? S'inscrire"}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
