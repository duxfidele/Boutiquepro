"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { KeyRound, Lock, Loader2, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const handleAuthFromUrl = async () => {
      try {
        // Handle code exchange if PKCE is used
        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn("Erreur échange de code PKCE:", error.message);
          }
        }

        // Check if there is an active session (or recovery session from hash)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && typeof window !== 'undefined' && !window.location.hash.includes('access_token')) {
          setMessage({
            type: 'error',
            text: "Le lien de réinitialisation semble invalide ou a expiré. Veuillez demander un nouveau lien."
          });
        }
      } catch (err: any) {
        console.error("Vérification session recovery error:", err);
      } finally {
        setIsVerifying(false);
      }
    };

    handleAuthFromUrl();

    // Listen for auth state changes (e.g. PASSWORD_RECOVERY event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsVerifying(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit comporter au moins 6 caractères.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message || 'Erreur lors de la mise à jour du mot de passe.' });
      } else {
        setIsSuccess(true);
        setMessage({
          type: 'success',
          text: 'Votre mot de passe a été mis à jour avec succès ! Redirection vers votre espace en cours...'
        });

        // Redirection automatique après 2.5 secondes
        setTimeout(() => {
          window.location.href = '/';
        }, 2500);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Une erreur inattendue est survenue.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background ambient blur */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-primary/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-accent/20 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-card/90 backdrop-blur-2xl border border-border/60 rounded-3xl shadow-2xl p-8 relative z-10 animate-scale-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/25">
            <KeyRound className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Choisissez un nouveau mot de passe sécurisé pour votre compte MaBoutiquePro
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 animate-fade-in border ${
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

        {isVerifying ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Vérification du lien de récupération...</p>
          </div>
        ) : isSuccess ? (
          <div className="space-y-6 pt-2">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-center">
              <p className="text-sm text-foreground font-semibold">
                Votre mot de passe a été modifié !
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Vous allez être redirigé automatiquement.
              </p>
            </div>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3.5 px-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
            >
              <span>Accéder à mon tableau de bord</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="Minimum 6 caractères"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="Répétez le mot de passe"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-3.5 px-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center shadow-lg shadow-primary/25 mt-4"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Enregistrement...</span>
                </div>
              ) : (
                "Valider le nouveau mot de passe"
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
              >
                Retour à l&apos;accueil
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
