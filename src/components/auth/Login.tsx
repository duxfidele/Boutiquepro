"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/whatsapp";
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
  Info,
  MessageCircle,
  ExternalLink
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

  const handleGoogleAuth = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        setLoading(false);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Erreur lors de l'authentification avec Google.",
      });
      setLoading(false);
    }
  };

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

      const origin = typeof window !== "undefined" ? window.location.origin : "https://maboutiquepro.app";
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_signup_confirmation", "true");
      }

      const { error, data } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: origin,
        },
      });

      if (error) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_signup_confirmation");
        }
        setMessage({ type: "error", text: error.message });
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_signup_confirmation");
        }
        setMessage({ type: "error", text: "Cet email est déjà utilisé." });
      } else {
        // Si Supabase a ouvert une session automatiquement sans confirmation d'email, on la coupe pour obliger la validation
        if (data.session) {
          await supabase.auth.signOut();
        }
        setPassword("");
        setConfirmPassword("");
        setMessage({
          type: "success",
          text: "Compte créé avec succès ! Un e-mail de confirmation vient de vous être envoyé. Veuillez cliquer sur le lien dans votre boîte mail (ou spams) avant de vous connecter.",
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
        sessionStorage.removeItem("pending_signup_confirmation");
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
            className={`mb-6 p-4 rounded-2xl flex flex-col gap-3 animate-fade-in border ${
              message.type === "error"
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-start gap-3">
              {message.type === "error" ? (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <p className="text-sm font-medium leading-relaxed">{message.text}</p>
            </div>

            {/* Invitation Communauté WhatsApp dès l'inscription */}
            {message.type === "success" && isSignUp && (
              <div className="mt-2 pt-3 border-t border-emerald-500/20 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs uppercase tracking-wide">
                  <span className="text-base leading-none">💬</span>
                  <span>Rejoindre la Communauté des Commerçants</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Discutez avec d&apos;autres commerçants et soyez informé en direct de toutes les nouvelles mises à jour de MaBoutiquePro !
                </p>
                <a
                  href={WHATSAPP_COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Intégrer le groupe WhatsApp</span>
                  <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-80" />
                </a>
              </div>
            )}
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

            {portalMode === "manager" && (
              <>
                <div className="relative my-3.5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground text-[11px] font-medium">
                      ou
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-background hover:bg-muted/70 border border-input text-foreground rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>
              </>
            )}

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
