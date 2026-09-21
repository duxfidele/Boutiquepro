"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Votre mot de passe a été mis à jour avec succès.' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Mon Compte</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles et votre sécurité.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Adresse Email
        </h2>
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border/50">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">C'est l'adresse que vous utilisez pour vous connecter.</p>
          </div>
          <div className="px-2.5 py-1 bg-green-500/10 text-green-600 rounded-lg text-xs font-bold">
            Vérifiée
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Changer de mot de passe
        </h2>

        {message && (
          <div className={`mb-6 p-3 rounded-xl flex items-center gap-3 animate-fade-in border ${
            message.type === 'error' 
              ? 'bg-destructive/10 border-destructive/20 text-destructive' 
              : 'bg-green-500/10 border-green-500/20 text-green-600'
          }`}>
            {message.type === 'error' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground ml-1">Nouveau mot de passe</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground ml-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="••••••••"
            />
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-all disabled:opacity-70 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mettre à jour"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
