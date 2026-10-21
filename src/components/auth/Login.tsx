"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Store, Lock, Mail, Loader2, AlertCircle, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import TurnstileWidget from '@/components/auth/TurnstileWidget';

export default function Login({ initialIsSignUp = false, onBack }: { initialIsSignUp?: boolean, onBack?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  // Sécurité Anti-Bot & Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');
  const [formMountedAt] = useState<number>(() => Date.now());

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSignUp) {
      // 1. Détection bot par Honeypot
      if (honeypot.trim() !== '') {
        setLoading(false);
        setMessage({ type: 'error', text: "Erreur de validation du formulaire." });
        return;
      }

      // 2. Détection bot par soumission instantanée (< 1.2s)
      if (Date.now() - formMountedAt < 1200) {
        setLoading(false);
        setMessage({ type: 'error', text: "Veuillez patienter un instant avant de valider votre inscription." });
        return;
      }

      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: "Les mots de passe ne correspondent pas." });
        setLoading(false);
        return;
      }

      // 3. Vérification Cloudflare Turnstile côté serveur
      try {
        const verifyRes = await fetch('/api/auth/verify-turnstile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.ok) {
          setMessage({
            type: 'error',
            text: verifyData.error || "Échec de validation de sécurité anti-robot. Veuillez recharger la page."
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Erreur vérification anti-bot:', err);
      }
      
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMessage({ type: 'error', text: "Cet email est déjà utilisé." });
      } else {
        setMessage({ type: 'success', text: "Compte créé ! Veuillez vérifier votre boîte mail pour confirmer votre inscription." });
      }
    } else {
      const cleanInput = email.trim().toLowerCase();
      // Supporte l'email direct (admin/caissier) OU l'identifiant caissier (ex: caisse1)
      const cleanEmail = cleanInput.includes("@")
        ? cleanInput
        : `${cleanInput}@caisse.maboutique.app`;

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message?.includes("Email not confirmed")) {
          setMessage({ type: 'error', text: "Votre adresse e-mail n'a pas encore été confirmée. Vérifiez vos emails." });
        } else if (error.message?.toLowerCase().includes("rate limit") || error.status === 429) {
          setMessage({ type: 'error', text: "Trop de tentatives de connexion. Veuillez patienter une minute avant de réessayer." });
        } else {
          setMessage({ type: 'error', text: "Email ou mot de passe incorrect." });
        }
      }
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ type: 'error', text: "Veuillez renseigner votre adresse e-mail." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://maboutiquepro.app';
      const redirectTo = `${origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message || "Erreur lors de l'envoi de l'e-mail de réinitialisation." });
      } else {
        setResetSent(true);
        setMessage({
          type: 'success',
          text: `Un lien de réinitialisation a été envoyé à ${email.trim()}. Vérifiez votre boîte de réception (et vos spams) pour définir un nouveau mot de passe.`
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Une erreur inattendue est survenue." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-8 relative z-10 animate-scale-in">
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

        <div className="flex flex-col items-center mb-8">
          <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center p-2 mb-4 shadow-md border border-border/40">
            {isForgotPassword ? <KeyRound className="h-10 w-10 text-primary" /> : <img src="/logo.png" alt="MaBoutiquePro" className="w-full h-full object-contain" />}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isForgotPassword ? "Mot de passe oublié" : "MaBoutiquePro"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {isForgotPassword 
              ? "Entrez votre email pour réinitialiser votre accès"
              : (isSignUp ? "Création de votre compte professionnel" : "Connexion sécurisée à votre espace")}
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-3.5 rounded-xl flex items-start gap-3 animate-fade-in border ${
            message.type === 'error' 
              ? 'bg-destructive/10 border-destructive/20 text-destructive' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {message.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium leading-relaxed">{message.text}</p>
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">
                {isSignUp ? "Adresse Email" : "Adresse Email ou Identifiant"}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type={isSignUp ? "email" : "text"}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder={isSignUp ? "admin@boutique.com" : "admin@boutique.com ou caisse1"}
                  autoComplete={isSignUp ? "email" : "username"}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center shadow-lg shadow-primary/20 mt-4"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Envoi en cours...</span>
                </div>
              ) : (
                resetSent ? "Renvoyer le lien de réinitialisation" : "Envoyer le lien de réinitialisation"
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
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour à la connexion</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-5">
            {/* Honeypot invisible pour les humains, piège pour les robots spammeurs */}
            <input
              type="text"
              name="b_phone_fax"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ display: 'none', position: 'absolute', left: '-9999px' }}
              aria-hidden="true"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">
                {isSignUp ? "Adresse Email" : "Adresse Email ou Identifiant"}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type={isSignUp ? "email" : "text"}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder={isSignUp ? "admin@boutique.com" : "admin@boutique.com ou caisse1"}
                  autoComplete={isSignUp ? "email" : "username"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground ml-1">Mot de passe</label>
                {!isSignUp && (
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="••••••••"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-sm font-medium text-foreground ml-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
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
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || (isSignUp && !confirmPassword)}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center shadow-lg shadow-primary/20 mt-4"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isSignUp ? "Créer mon compte" : "Se connecter")}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignUp ? "Déjà un compte ? Connectez-vous" : "Pas encore de compte ? S'inscrire"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
