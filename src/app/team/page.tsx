"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import { UserPlus, Shield, User, Trash2, Store, Key, Mail, RefreshCw, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';

export default function TeamPage() {
  const { user, stores, activeStore, setActiveStore, canManageTeam } = useAuth();
  const [subModalOpen, setSubModalOpen] = useState(false);
  
  // Boutiques où l'utilisateur connecté est administrateur
  const adminStores = stores?.filter((s: any) => s.role === 'admin') || [];
  
  // Boutique sélectionnée pour la gestion de l'équipe
  const [selectedStoreId, setSelectedStoreId] = useState<string>(activeStore?.id || adminStores[0]?.id || '');
  
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mode d'ajout : 'create' (créer un nouveau compte) ou 'assign' (relier un compte existant)
  const [addMode, setAddMode] = useState<'create' | 'assign'>('create');

  // Champs de formulaire
  const [cashierName, setCashierName] = useState('');
  const [cashierEmail, setCashierEmail] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');

  // Synchroniser la boutique sélectionnée avec activeStore si présent
  useEffect(() => {
    if (activeStore?.id && !selectedStoreId) {
      setSelectedStoreId(activeStore.id);
    } else if (adminStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(adminStores[0].id);
    }
  }, [activeStore, adminStores]);

  // Récupérer les membres de la boutique sélectionnée (Ultra-robuste : 0 erreur 400)
  const fetchMembers = async () => {
    if (!selectedStoreId) return;
    setLoading(true);

    try {
      // 1. Essayer d'abord la fonction RPC serveur dédiée
      const { data: rpcMembers, error: rpcError } = await supabase
        .rpc('get_store_team_members', { p_store_id: selectedStoreId });

      if (!rpcError && rpcMembers) {
        setMembers(rpcMembers);
        setLoading(false);
        return;
      }

      // 2. Repli de sécurité si la RPC n'est pas encore exécutée : 2 requêtes propres
      const { data: membersData, error: mError } = await supabase
        .from('store_members')
        .select('id, user_id, role, created_at')
        .eq('store_id', selectedStoreId);

      if (mError) throw mError;

      if (!membersData || membersData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = membersData.map((m: any) => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const combined = membersData.map((m: any) => {
        const prof = profileMap.get(m.user_id);
        return {
          member_id: m.id,
          user_id: m.user_id,
          email: prof?.email || 'Email non renseigné',
          full_name: prof?.full_name || (m.role === 'admin' ? 'Gérant' : 'Caissier'),
          role: m.role,
          created_at: m.created_at
        };
      });

      // Trier : Admin en premier, puis caissiers
      combined.sort((a: any, b: any) => (a.role === 'admin' ? -1 : 1));
      setMembers(combined);
    } catch (e: any) {
      console.error('Erreur lors du chargement des membres :', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchMembers();
    }
  }, [selectedStoreId]);

  // Mode 1 : Créer directement un compte caissier (email + mot de passe)
  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierEmail || !cashierPassword || !selectedStoreId) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const cleanInput = cashierEmail.trim().toLowerCase();
      const targetEmail = cleanInput.includes('@') ? cleanInput : `${cleanInput}@caisse.maboutique.app`;

      const { data, error } = await supabase.rpc('admin_create_cashier', {
        p_store_id: selectedStoreId,
        p_name: cashierName.trim() || 'Caissier',
        p_email: targetEmail,
        p_password: cashierPassword
      });

      if (error) throw error;

      if (data && data.success === false) {
        setMessage({ type: 'error', text: data.message });
      } else {
        setMessage({ 
          type: 'success', 
          text: data?.message || `Le compte du caissier ${cashierEmail} a été créé et lié à la boutique avec succès !`
        });
        setCashierName('');
        setCashierEmail('');
        setCashierPassword('');
        fetchMembers();
      }
    } catch (error: any) {
      console.error(error);
      setMessage({
        type: 'error',
        text: "Erreur lors de la création : " + (error.message || "Veuillez exécuter le script SQL saas_team_and_stores_management.sql dans Supabase.")
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Mode 2 : Lier un caissier déjà inscrit par son email
  const handleAssignCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierEmail || !selectedStoreId) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.rpc('assign_cashier_by_email', {
        p_store_id: selectedStoreId,
        p_email: cashierEmail.trim().toLowerCase()
      });

      if (error) {
        // Fallback si la nouvelle RPC n'est pas encore créée
        const { data: profileId, error: rpcError } = await supabase
          .rpc('get_user_id_by_email', { p_email: cashierEmail.trim().toLowerCase() });

        if (rpcError || !profileId) {
          setMessage({
            type: 'error',
            text: "Aucun utilisateur trouvé avec cet email. Utilisez l'onglet \"Créer un compte caissier\" pour lui créer son accès directement."
          });
          setSubmitting(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('store_members')
          .insert({
            store_id: selectedStoreId,
            user_id: profileId,
            role: 'cashier'
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setMessage({ type: 'error', text: "Cet utilisateur est déjà caissier de cette boutique." });
          } else {
            throw insertError;
          }
          setSubmitting(false);
          return;
        }

        setMessage({ type: 'success', text: "Caissier lié avec succès à la boutique !" });
      } else if (data && data.success === false) {
        setMessage({ type: 'error', text: data.message });
      } else {
        setMessage({ type: 'success', text: data?.message || "Caissier lié avec succès !" });
      }

      setCashierEmail('');
      fetchMembers();
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: "Erreur : " + (error.message || JSON.stringify(error)) });
    } finally {
      setSubmitting(false);
    }
  };

  // Retirer un caissier de la boutique sélectionnée
  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (memberRole === 'admin') {
      alert("Impossible de retirer le gérant de la boutique !");
      return;
    }

    if (!window.confirm("Voulez-vous vraiment retirer l'accès de ce caissier à cette boutique ?")) return;

    try {
      // 1. Essayer la RPC sécurisée
      const { data, error } = await supabase.rpc('remove_cashier_from_store', {
        p_store_id: selectedStoreId,
        p_member_id: memberId
      });

      if (!error && data?.success) {
        setMessage({ type: 'success', text: "Accès retiré avec succès." });
      } else {
        // Fallback delete
        await supabase.from('store_members').delete().eq('id', memberId);
        setMessage({ type: 'success', text: "Accès retiré avec succès." });
      }
      fetchMembers();
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: "Erreur lors du retrait de l'accès." });
    }
  };

  const selectedStore = adminStores.find((s: any) => s.id === selectedStoreId);

  if (!canManageTeam) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-4 sm:p-8">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-border/50 text-center space-y-6 shadow-xl bg-card">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <UserPlus className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-3">
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-black uppercase tracking-wider">
              Formules PRO &amp; BUSINESS
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Gestion d&apos;Équipe &amp; Caissiers
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              La formule Starter est conçue pour 1 seul gérant (0 caissier). Pour ajouter un caissier avec compte dédié et écran protégé, passez à la formule PRO (1 caissier inclus) ou BUSINESS (jusqu&apos;à 3 caissiers).
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSubModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25 hover:shadow-xl transition-all cursor-pointer"
            >
              Passer à la formule PRO (100 FCFA/mois)
            </button>
          </div>
        </div>
        <SubscriptionModal
          isOpen={subModalOpen}
          onClose={() => setSubModalOpen(false)}
          defaultPlan="PRO"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* En-tête avec sélecteur de boutique */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-border/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Mon Équipe & Attribution des Boutiques
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos boutiques et affectez vos caissiers en toute sécurité.
          </p>
        </div>

        {/* Sélecteur de boutique dynamique */}
        <div className="flex items-center gap-3 bg-secondary/50 p-2 rounded-2xl border border-border/40">
          <span className="text-xs font-semibold text-muted-foreground pl-2 whitespace-nowrap">Boutique :</span>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              const storeObj = stores.find((s: any) => s.id === e.target.value);
              if (storeObj) setActiveStore(storeObj);
            }}
            className="bg-background text-foreground text-sm font-bold px-3 py-2 rounded-xl border border-border/60 outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {adminStores.map((s: any) => (
              <option key={s.id} value={s.id}>
                🏪 {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Message de notification */}
      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 border animate-fade-in ${
            message.type === 'error'
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {message.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Formulaire d'attribution / création */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-border/50 space-y-5 h-fit">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Attribuer un caissier
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {selectedStore?.name || 'Boutique'}
            </span>
          </div>

          {/* Onglets de mode */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-secondary/60 rounded-2xl">
            <button
              type="button"
              onClick={() => setAddMode('create')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                addMode === 'create'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Créer un compte
            </button>
            <button
              type="button"
              onClick={() => setAddMode('assign')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                addMode === 'assign'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Compte existant
            </button>
          </div>

          {addMode === 'create' ? (
            /* Mode 1 : Création complète et directe */
            <form onSubmit={handleCreateCashier} className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Créez directement l'accès de votre employé. Son compte sera immédiatement activé et rattaché à <strong>{selectedStore?.name}</strong> sans bloquer sur l'envoi d'email.
              </p>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nom du caissier</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Ex: Moussa Diop"
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Adresse Email ou Identifiant</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Ex: caisse1 ou caissier@maboutique.com"
                    value={cashierEmail}
                    onChange={(e) => setCashierEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Astuce : Vous pouvez saisir un simple identifiant (ex: <b>caisse1</b>) ou un email complet.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Mot de passe provisoire</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={cashierPassword}
                    onChange={(e) => setCashierPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Créer et affecter à la boutique
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Mode 2 : Liaison d'un compte déjà inscrit */
            <form onSubmit={handleAssignCashier} className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Si votre caissier a déjà créé son compte sur l'application, saisissez son email pour le relier directement à <strong>{selectedStore?.name}</strong>.
              </p>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email du caissier</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="email.caissier@gmail.com"
                    value={cashierEmail}
                    onChange={(e) => setCashierEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Attribution en cours...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Affecter à cette boutique
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Liste des membres affectés à la boutique sélectionnée */}
        <div className="lg:col-span-7 glass-panel p-0 rounded-3xl border border-border/50 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border/50 bg-secondary/30 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-foreground">Équipe de : {selectedStore?.name}</h2>
              <p className="text-xs text-muted-foreground">{members.length} membre(s) enregistré(s)</p>
            </div>
            <button
              onClick={fetchMembers}
              disabled={loading}
              className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-border/40 flex-1">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">Chargement de l'équipe...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <User className="h-8 w-8 text-muted-foreground/40" />
                <span>Aucun caissier n'est encore rattaché à cette boutique.</span>
                <span className="text-xs">Utilisez le formulaire à gauche pour affecter un caissier.</span>
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.member_id || member.id}
                  className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                        member.role === 'admin'
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      }`}
                    >
                      {member.role === 'admin' ? (
                        <Shield className="h-5 w-5" />
                      ) : (
                        member.full_name?.charAt(0).toUpperCase() || 'C'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">
                          {member.full_name || 'Utilisateur'}
                        </p>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            member.role === 'admin'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {member.role === 'admin' ? 'Gérant / Boss' : 'Caissier'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Mail className="h-3 w-3" />
                        {member.email?.endsWith('@caisse.maboutique.app')
                          ? `Identifiant: ${member.email.replace('@caisse.maboutique.app', '')}`
                          : member.email}
                      </p>
                    </div>
                  </div>

                  {member.role !== 'admin' && (
                    <button
                      onClick={() => handleRemoveMember(member.member_id || member.id, member.role)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                      title="Retirer l'accès à cette boutique"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
