"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Store, Lock, Mail, Loader2, AlertCircle, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';

export default function Login({ initialIsSignUp = false, onBack }: { initialIsSignUp?: boolean, onBack?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSignUp) {
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: "Les mots de passe ne correspondent pas." });
        setLoading(false);
        return;
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage({ type: 'error', text: "Email ou mot de passe incorrect." });
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
          <div className="h-16 w-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20">
            {isForgotPassword ? <KeyRound className="h-8 w-8" /> : <Store className="h-8 w-8" />}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isForgotPassword ? "Mot de passe oublié" : "BoutiquePro"}
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
              <label className="text-sm font-medium text-foreground ml-1">Adresse Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="admin@boutique.com"
                  autoComplete="email"
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">Adresse Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="admin@boutique.com"
                  autoComplete="email"
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
