"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, Shield, User, Trash2 } from 'lucide-react';
const toast = { success: (msg: string) => alert(msg), error: (msg: string) => alert(msg) };

export default function TeamPage() {
  const { user, activeStore } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    try {
      if (!activeStore) return;

      const { data: membersData, error } = await supabase
        .from('store_members')
        .select(`
          id, role,
          profiles:user_id(id, email)
        `)
        .eq('store_id', activeStore.id);

      if (error) throw error;
      setMembers(membersData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeStore) fetchMembers();
  }, [user, activeStore]);

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      const { data: profileId, error: rpcError } = await supabase
        .rpc('get_user_id_by_email', { p_email: email });

      if (rpcError) throw rpcError;

      if (!profileId) {
        toast.error("Aucun utilisateur trouvé avec cet email. Le caissier doit d'abord créer un compte sur l'application.");
        return;
      }

      if (!activeStore) return;

      const { error } = await supabase
        .from('store_members')
        .insert({
          store_id: activeStore.id,
          user_id: profileId,
          role: 'cashier'
        });

      if (error) {
        if (error.code === '23505') toast.error("Cet utilisateur est déjà dans l'équipe.");
        else throw error;
        return;
      }

      toast.success("Caissier ajouté avec succès !");
      setEmail('');
      fetchMembers();
    } catch (error: any) {
      console.error(error);
      toast.error("Erreur lors de l'ajout du caissier : " + (error.message || JSON.stringify(error)));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm("Voulez-vous vraiment retirer cet accès ?")) return;
    
    try {
      await supabase.from('store_members').delete().eq('id', memberId);
      toast.success("Accès retiré");
      fetchMembers();
    } catch (e) {
      toast.error("Erreur");
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mon Équipe</h1>
          <p className="text-muted-foreground">Gérez les accès de vos caissiers</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-panel p-6 rounded-2xl h-fit">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-primary" />
            Ajouter un caissier
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Le caissier doit d'abord s'inscrire sur l'application. Ensuite, entrez son email ici pour lui donner accès à votre caisse.
          </p>
          <form onSubmit={handleAddCashier} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email du caissier..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-secondary/50 px-4 py-2"
                required
              />
            </div>
            <button type="submit" className="w-full btn-primary py-2 rounded-xl">
              Donner l'accès
            </button>
          </form>
        </div>

        <div className="glass-panel p-0 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20">
            <h2 className="font-semibold">Membres actifs</h2>
          </div>
          <div className="divide-y divide-border/50">
            {members.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${member.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-orange-500/20 text-orange-500'}`}>
                    {member.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {member.profiles?.email || 'Utilisateur inconnu'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>
                {member.role !== 'admin' && (
                  <button 
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Retirer l'accès"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucun membre trouvé
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
