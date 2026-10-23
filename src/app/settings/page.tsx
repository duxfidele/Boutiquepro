"use client";
import SubscriptionModal from "@/components/subscription/SubscriptionModal";

import React, { useState, useEffect } from "react";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Save, Sparkles, Trash2, Image as ImageIcon, CreditCard, Store, DollarSign, Percent, MapPin, Mail, Phone, Loader2, User, Layers, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.settings.name);
  const [currency, setCurrency] = useState(state.settings.currency);
  const [taxRate, setTaxRate] = useState(state.settings.taxRate.toString());
  const [logo, setLogo] = useState(state.settings.logo || "");
  const [city, setCity] = useState(state.settings.city && state.settings.city !== "Dakar" ? state.settings.city : "Lomé");
  const [country, setCountry] = useState(state.settings.country && state.settings.country !== "Sénégal" ? state.settings.country : "Togo");
  const [email, setEmail] = useState(state.settings.email || "");
  const { user, stores, activeStore, setActiveStore, role } = useAuth();
  const [phone, setPhone] = useState(state.settings.phone || "");
  const [managerName, setManagerName] = useState(state.settings.managerName || user?.user_metadata?.full_name || "Fr Fidèle");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setName(state.settings.name);
    setCurrency(state.settings.currency);
    setTaxRate(state.settings.taxRate.toString());
    setLogo(state.settings.logo || "");
    setCity(state.settings.city && state.settings.city !== "Dakar" ? state.settings.city : "Lomé");
    setCountry(state.settings.country && state.settings.country !== "Sénégal" ? state.settings.country : "Togo");
    setEmail(state.settings.email || "");
    setPhone(state.settings.phone || "");
    setManagerName(state.settings.managerName || user?.user_metadata?.full_name || "Fr Fidèle");
  }, [state.settings, user]);

  // Compression automatique du logo pour éviter de saturer le quota du navigateur ou de Supabase
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 320;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/png", 0.9);
            setLogo(compressed);
          } else {
            setLogo(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteActiveStore = async () => {
    if (!stores || stores.length <= 1) {
      alert("Action impossible : Vous devez toujours conserver au moins une boutique active.");
      return;
    }
    const currentName = state.settings.name || activeStore?.name || "cette boutique";
    const confirmDelete = window.confirm(
      `⚠️ ATTENTION : La suppression définitive de la boutique "${currentName}" est IRRÉVERSIBLE !\n\nToutes ses données (produits, stocks, ventes, caisses) seront supprimées.\n\nVoulez-vous vraiment confirmer la suppression de cette boutique ?`
    );
    if (!confirmDelete) return;
    try {
      const { data, error } = await supabase.rpc("delete_store", { p_store_id: activeStore.id });
      if (error) throw error;
      if (data?.success === false) {
        alert(data.message);
      } else {
        alert(data?.message || "Boutique supprimée avec succès !");
        const remaining = stores.filter((x: any) => x.id !== activeStore.id);
        if (remaining.length > 0) {
          try {
            localStorage.setItem("activeStoreId", remaining[0].id);
            localStorage.setItem("activeStoreObj", JSON.stringify(remaining[0]));
          } catch {}
          setActiveStore(remaining[0]);
        }
        window.location.reload();
      }
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await dispatch({
        type: "UPDATE_SETTINGS",
        payload: {
          name,
          currency,
          taxRate: parseFloat(taxRate) || 0,
          logo,
          city,
          country,
          email,
          phone
        }
      });
      if (managerName.trim()) {
        try {
          await supabase.auth.updateUser({
            data: { full_name: managerName.trim() }
          });
        } catch (eAuth) {}
      }
      setSaved(true);
    } catch (err) {
      console.error("Erreur enregistrement:", err);
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setSaved(false);
        router.push("/");
      }, 900);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de la boutique</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez votre espace comme dans un vrai SaaS.
        </p>
      </div>

      {/* Tuile d'accès aux Modules de la boutique */}
      <Link
        href="/settings/modules"
        className="group flex items-center justify-between p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all shadow-xs"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-primary text-white shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
              <span>Modules & Options de la boutique</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary">Nouveau</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Activer ou masquer les modules (dettes, factures, inventaires, etc.)
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </Link>

      <div className="bg-card border border-border/40 rounded-2xl p-6 space-y-6">
        {/* Nom de la boutique */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            Nom de la boutique
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Nom du gérant / caissier responsable */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Nom du gérant / Responsable de caisse
          </label>
          <input
            type="text"
            placeholder="Ex: Fr Fidèle"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
          <p className="text-xs text-muted-foreground">
            Ce nom s'affichera sur vos reçus de caisse, factures officielles et sur la caisse active à la place de l'adresse email.
          </p>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            Logo de la boutique
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-border/50 bg-secondary/50 flex items-center justify-center overflow-hidden shrink-0">
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-medium transition-colors">
                Choisir une image
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              <p className="text-xs text-muted-foreground mt-2">Le logo remplacera le bouton &quot;B&quot; dans le menu de gauche.</p>
            </div>
          </div>
        </div>

        {/* Devise */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Devise (Symbole)
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Taux de TVA (%)
            </label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Coordonnées */}
        <div className="pt-6 border-t border-border/40">
          <h3 className="text-lg font-bold mb-4">Coordonnées de l&apos;entreprise (pour les PDF)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Ville
              </label>
              <input
                type="text"
                placeholder="Lomé"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Pays
              </label>
              <input
                type="text"
                placeholder="Togo"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                Téléphone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Bouton Sauvegarder */}
        <div className="pt-4 border-t border-border/40 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-medium transition-all shadow-lg glow-primary disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "Enregistré avec succès !" : isSaving ? "Enregistrement..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* Section Abonnement & Facturation SaaS */}
      <div className="bg-card border border-border/40 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Abonnement &amp; Facturation (Moneriz)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Gérez votre formule Starter, Pro ou Business. Paiement sécurisé par Mobile Money (T-Money, Moov, Wave, Orange) et Carte Bancaire.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
            Paiement Sécurisé
          </span>
        </div>

        <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-foreground">Formules Disponibles</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Starter (2 500 F/mois) • Pro (5 000 F/mois) • Business (10 000 F/mois) — 2 mois offerts en paiement annuel
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSubModal(true)}
            className="relative group overflow-hidden px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2.5 border border-white/20 shrink-0 cursor-pointer"
          >
            <span className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out" />
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Souscrire / Renouveler mon abonnement</span>
          </button>
        </div>
      </div>

      {/* Zone de Danger : Suppression de la boutique */}
      {role === "admin" && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5 text-destructive" />
                Zone de Danger : Supprimer cette boutique
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                La suppression de la boutique <b>{state.settings.name || activeStore?.name}</b> effacera définitivement tous ses produits, ventes, stocks et données associées. Cette action est irréversible.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-destructive/10">
            <span className="text-xs text-muted-foreground font-medium">
              {stores && stores.length <= 1
                ? "Impossible de supprimer : votre compte doit conserver au moins 1 boutique active."
                : `Vous avez ${stores?.length || 1} boutiques enregistrées.`}
            </span>

            <button
              type="button"
              disabled={!stores || stores.length <= 1}
              onClick={handleDeleteActiveStore}
              className="px-4 py-2.5 rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-all font-bold text-xs disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 shadow-sm shadow-destructive/20 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer cette boutique</span>
            </button>
          </div>
        </div>
      )}

      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
      />

    </div>
  );
}
