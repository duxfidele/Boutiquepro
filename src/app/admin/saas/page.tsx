"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  ShieldCheck,
  Store,
  Users,
  CreditCard,
  TrendingUp,
  RefreshCw,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Lock,
  ArrowUpRight,
  Filter,
  UserCheck,
  BadgeAlert,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface StoreItem {
  id: string;
  name: string;
  ownerId?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  createdAt: string;
  businessSector: string;
  subscriptionPlan: string;
  subscriptionStatus: "trial" | "active" | "expired";
  subscriptionEndsAt?: string | null;
  isFounder?: boolean;
}

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string | null;
  createdAt: string;
  isFounder?: boolean;
}

interface PaymentItem {
  id: string;
  orderId: string;
  storeId?: string;
  planId: string;
  amount: number;
  currency: string;
  reference: string;
  customerEmail?: string;
  createdAt: string;
}

interface SaaSMetricsResponse {
  kpis: {
    totalSaaSFcfa: number;
    totalPaymentsCount: number;
    totalStores: number;
    totalUsers: number;
    totalAdmins: number;
    totalCashiers: number;
    activePaidCount: number;
    trialCount: number;
    expiredCount: number;
  };
  stores: StoreItem[];
  users: UserItem[];
  payments: PaymentItem[];
}

export default function SuperAdminSaasPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<SaaSMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onglet actif : 'stores' | 'users' | 'payments'
  const [activeTab, setActiveTab] = useState<"stores" | "users" | "payments">(
    "stores"
  );

  // Recherche & Filtres
  const [storeSearch, setStoreSearch] = useState("");
  const [storeStatusFilter, setStoreStatusFilter] = useState<
    "all" | "active" | "trial" | "expired"
  >("all");

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<
    "all" | "admin" | "cashier"
  >("all");

  // Modal de gestion d'abonnement
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);
  const [modalTier, setModalTier] = useState<"STARTER" | "PRO" | "BUSINESS">(
    "PRO"
  );
  const [modalDuration, setModalDuration] = useState<number>(1);
  const [modalStatus, setModalStatus] = useState<"active" | "trial">("active");
  const [isUpdatingSub, setIsUpdatingSub] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Charger les données SaaS depuis l'API sécurisée
  const fetchSaaSMetrics = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Session introuvable. Veuillez vous reconnecter.");
      }

      const res = await fetch("/api/admin/saas-metrics", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Erreur serveur HTTP ${res.status}`
        );
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Erreur chargement métriques SaaS:", err);
      setError(err.message || "Impossible de charger les données SaaS.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      fetchSaaSMetrics();
    }
  }, [authLoading, isSuperAdmin]);

  // Validation d'accès Super Admin
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">
            Vérification des droits Super Admin...
          </p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-destructive/30 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-5 ring-8 ring-destructive/5">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">
            Accès Refusé
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
            Cette page est strictement réservée à l&apos;administrateur éditeur
            du SaaS MaBoutiquePro (
            <span className="text-purple-400 font-bold">
              profidele91@gmail.com
            </span>
            ).
          </p>
          <button
            onClick={() => router.replace("/")}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  // Filtrage des boutiques
  const filteredStores = (data?.stores || []).filter((s) => {
    const query = storeSearch.toLowerCase().trim();
    const matchesQuery =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.ownerName.toLowerCase().includes(query) ||
      s.ownerEmail.toLowerCase().includes(query);

    const matchesStatus =
      storeStatusFilter === "all" || s.subscriptionStatus === storeStatusFilter;

    return matchesQuery && matchesStatus;
  });

  // Filtrage des utilisateurs
  const filteredUsers = (data?.users || []).filter((u) => {
    const query = userSearch.toLowerCase().trim();
    const matchesQuery =
      !query ||
      u.email.toLowerCase().includes(query) ||
      u.fullName.toLowerCase().includes(query);

    const matchesRole =
      userRoleFilter === "all" || u.role === userRoleFilter;

    return matchesQuery && matchesRole;
  });

  // Soumission de la mise à jour d'un abonnement
  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;

    setIsUpdatingSub(true);
    setUpdateFeedback(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/admin/saas-metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: selectedStore.id,
          ownerId: selectedStore.ownerId,
          planTier: modalTier,
          durationMonths: modalDuration,
          status: modalStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Échec de la mise à jour de l'abonnement.");
      }

      setUpdateFeedback({
        type: "success",
        text: json.message || "Abonnement mis à jour avec succès !",
      });

      // Rafraîchir les métriques
      await fetchSaaSMetrics(true);

      setTimeout(() => {
        setSelectedStore(null);
        setUpdateFeedback(null);
      }, 1400);
    } catch (err: any) {
      setUpdateFeedback({
        type: "error",
        text: err.message || "Une erreur est survenue lors de la mise à jour.",
      });
    } finally {
      setIsUpdatingSub(false);
    }
  };

  const kpis = data?.kpis || {
    totalSaaSFcfa: 0,
    totalPaymentsCount: 0,
    totalStores: 0,
    totalUsers: 0,
    totalAdmins: 0,
    totalCashiers: 0,
    activePaidCount: 0,
    trialCount: 0,
    expiredCount: 0,
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Top Banner Fondateur */}
      <div className="border-b border-border/60 bg-gradient-to-r from-purple-950/40 via-background to-background backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-foreground tracking-tight">
                    Console Super Admin SaaS
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider">
                    Fondateur
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supervision globale • Équité & Confidentialité des commerçants
                  garanties
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchSaaSMetrics(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 font-semibold text-xs transition-all border border-border/50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>{refreshing ? "Actualisation..." : "Actualiser"}</span>
              </button>

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs transition-all border border-primary/20"
              >
                <span>Ma Boutique</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Alerte Erreur éventuelle */}
        {error && (
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchSaaSMetrics(true)}
              className="text-xs font-bold underline hover:opacity-80"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* 4 CARTES KPI CLÉS DU SAAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. CA SaaS Encaissé */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                CA Abonnements SaaS
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground tracking-tight">
              {kpis.totalSaaSFcfa.toLocaleString("fr-FR")} FCFA
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>
                {kpis.totalPaymentsCount} règlement
                {kpis.totalPaymentsCount > 1 ? "s" : ""} Moneriz encaissé
                {kpis.totalPaymentsCount > 1 ? "s" : ""}
              </span>
            </p>
          </div>

          {/* 2. Total Boutiques */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Boutiques Inscrites
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground tracking-tight">
              {kpis.totalStores}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Établissements commerciaux créés sur la plateforme
            </p>
          </div>

          {/* 3. Total Utilisateurs */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Utilisateurs Inscrits
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground tracking-tight">
              {kpis.totalUsers}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
              <span className="text-foreground font-semibold">
                {kpis.totalAdmins} gérant{kpis.totalAdmins > 1 ? "s" : ""}
              </span>
              <span>•</span>
              <span className="text-foreground font-semibold">
                {kpis.totalCashiers} caissier{kpis.totalCashiers > 1 ? "s" : ""}
              </span>
            </p>
          </div>

          {/* 4. Santé Abonnements */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Santé Abonnements
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
                {kpis.activePaidCount} Actif{kpis.activePaidCount > 1 ? "s" : ""}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400">
                {kpis.trialCount} Essai{kpis.trialCount > 1 ? "s" : ""}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400">
                {kpis.expiredCount} Expiré{kpis.expiredCount > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Répartition globale des abonnements commerçants
            </p>
          </div>
        </div>

        {/* ONGLETS DE NAVIGATION */}
        <div className="flex border-b border-border/60 gap-2">
          <button
            onClick={() => setActiveTab("stores")}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "stores"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Boutiques & Abonnements</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground font-semibold">
              {filteredStores.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "users"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Comptes Utilisateurs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground font-semibold">
              {filteredUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "payments"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Règlements SaaS ({data?.payments?.length || 0})</span>
          </button>
        </div>

        {/* CONTENU ONGLET 1 : BOUTIQUES & ABONNEMENTS */}
        {activeTab === "stores" && (
          <div className="space-y-4">
            {/* Barre de recherche et filtres de statut */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher une boutique par nom, gérant ou email..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { id: "all", label: "Toutes" },
                    { id: "active", label: "Actives" },
                    { id: "trial", label: "En Essai" },
                    { id: "expired", label: "Expirées" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStoreStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      storeStatusFilter === f.id
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tableau des boutiques */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Boutique</th>
                      <th className="py-3.5 px-4">Propriétaire</th>
                      <th className="py-3.5 px-4">Formule</th>
                      <th className="py-3.5 px-4">Statut Abonnement</th>
                      <th className="py-3.5 px-4">Échéance</th>
                      <th className="py-3.5 px-4">Inscription</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span>Chargement des boutiques...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredStores.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-muted-foreground"
                        >
                          Aucune boutique ne correspond aux filtres.
                        </td>
                      </tr>
                    ) : (
                      filteredStores.map((st) => (
                        <tr
                          key={st.id}
                          className="hover:bg-secondary/20 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-foreground text-sm flex items-center gap-2">
                              <span>{st.name}</span>
                              {st.isFounder && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-black">
                                  Fondateur
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {st.businessSector || "Commerce général"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground">
                              {st.ownerName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {st.ownerEmail}
                            </div>
                            {st.ownerPhone && (
                              <div className="text-[10px] text-muted-foreground/80">
                                {st.ownerPhone}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-lg bg-secondary text-foreground text-[11px] font-bold">
                              {st.subscriptionPlan}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {st.isFounder ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[11px]">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                Illimité
                              </span>
                            ) : st.subscriptionStatus === "active" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Actif
                              </span>
                            ) : st.subscriptionStatus === "trial" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold text-[11px]">
                                <Clock className="w-3 h-3" />
                                En Essai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold text-[11px]">
                                <AlertTriangle className="w-3 h-3" />
                                Expiré
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            {st.isFounder
                              ? "Permanent"
                              : st.subscriptionEndsAt
                              ? new Date(
                                  st.subscriptionEndsAt
                                ).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Non définie"}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            {st.createdAt
                              ? new Date(st.createdAt).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )
                              : "-"}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedStore(st);
                                setModalTier(
                                  st.subscriptionPlan.includes("BUSINESS")
                                    ? "BUSINESS"
                                    : st.subscriptionPlan.includes("STARTER")
                                    ? "STARTER"
                                    : "PRO"
                                );
                                setModalStatus(
                                  st.subscriptionStatus === "trial"
                                    ? "trial"
                                    : "active"
                                );
                                setModalDuration(1);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all shadow-xs"
                            >
                              Gérer l&apos;abonnement
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENU ONGLET 2 : COMPTES UTILISATEURS */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur par nom ou email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: "all", label: "Tous" },
                    { id: "admin", label: "Gérants (Admins)" },
                    { id: "cashier", label: "Caissiers" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setUserRoleFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      userRoleFilter === f.id
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Utilisateur</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">Rôle</th>
                      <th className="py-3.5 px-4">Téléphone</th>
                      <th className="py-3.5 px-4">Date d&apos;inscription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-12 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span>Chargement des utilisateurs...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-12 text-center text-muted-foreground"
                        >
                          Aucun compte utilisateur trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-secondary/20 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{u.fullName}</span>
                              {u.isFounder && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-black">
                                  Fondateur
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground font-mono">
                            {u.email}
                          </td>

                          <td className="py-3.5 px-4">
                            {u.role === "admin" ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-bold text-[11px]">
                                Gérant (Admin)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold text-[11px]">
                                Caissier
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            {u.phone || "—"}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENU ONGLET 3 : RÈGLEMENTS SAAS */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border/60 bg-secondary/30 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Historique des Règlements d&apos;Abonnements Moneriz
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Souscriptions encaissées pour la plateforme MaBoutiquePro
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">
                    Total Encaissé :
                  </span>
                  <div className="text-base font-black text-emerald-400">
                    {kpis.totalSaaSFcfa.toLocaleString("fr-FR")} FCFA
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Date & Heure</th>
                      <th className="py-3.5 px-4">Référence</th>
                      <th className="py-3.5 px-4">Client</th>
                      <th className="py-3.5 px-4">Formule Souscrite</th>
                      <th className="py-3.5 px-4">Montant</th>
                      <th className="py-3.5 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span>Chargement des transactions...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (data?.payments || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-muted-foreground"
                        >
                          Aucun paiement d&apos;abonnement enregistré pour le
                          moment.
                        </td>
                      </tr>
                    ) : (
                      data?.payments.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-secondary/20 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                            {p.reference}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            {p.customerEmail || "Non renseigné"}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-lg bg-secondary text-foreground text-[11px] font-bold uppercase">
                              {p.planId.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-emerald-400">
                            {p.amount.toLocaleString("fr-FR")} FCFA
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Payé
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE GESTION MANUELLE DE L'ABONNEMENT */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-card border border-border/80 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-border/50 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-foreground">
                    Ajuster l&apos;Abonnement
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase">
                    Super Admin
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Boutique :{" "}
                  <strong className="text-foreground">
                    {selectedStore.name}
                  </strong>{" "}
                  ({selectedStore.ownerEmail})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="w-8 h-8 rounded-full bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {updateFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  updateFeedback.type === "success"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}
              >
                {updateFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{updateFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSubscription} className="space-y-4">
              {/* Choix de la formule */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Formule SaaS
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["STARTER", "PRO", "BUSINESS"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setModalTier(t)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        modalTier === t
                          ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                          : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée de validité */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Durée de validité
                </label>
                <select
                  value={modalDuration}
                  onChange={(e) => setModalDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value={1}>1 Mois</option>
                  <option value={3}>3 Mois</option>
                  <option value={6}>6 Mois</option>
                  <option value={12}>1 An (12 mois)</option>
                  <option value={9999}>À vie (Accès permanent)</option>
                </select>
              </div>

              {/* Statut */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Statut de l&apos;accès
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalStatus("active")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      modalStatus === "active"
                        ? "bg-emerald-600 text-white border-emerald-500"
                        : "bg-secondary/40 text-muted-foreground border-border"
                    }`}
                  >
                    Actif (Payé / Validé)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStatus("trial")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      modalStatus === "trial"
                        ? "bg-amber-600 text-white border-amber-500"
                        : "bg-secondary/40 text-muted-foreground border-border"
                    }`}
                  >
                    Période d&apos;essai
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStore(null)}
                  disabled={isUpdatingSub}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSub}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpdatingSub && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Appliquer l&apos;abonnement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
