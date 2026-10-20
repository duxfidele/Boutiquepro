"use client";
import SubscriptionModal from "@/components/subscription/SubscriptionModal";

import React, { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { Save, Sparkles, Image as ImageIcon, CreditCard, Store, DollarSign, Percent, MapPin, Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.settings.name);
  const [currency, setCurrency] = useState(state.settings.currency);
  const [taxRate, setTaxRate] = useState(state.settings.taxRate.toString());
  const [logo, setLogo] = useState(state.settings.logo || "");
  const [city, setCity] = useState(state.settings.city || "");
  const [country, setCountry] = useState(state.settings.country || "");
  const [email, setEmail] = useState(state.settings.email || "");
  const [phone, setPhone] = useState(state.settings.phone || "");
  const [saved, setSaved] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const router = useRouter();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    dispatch({
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
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push("/");
    }, 800); // Court délai pour voir le message de confirmation avant de revenir au tableau de bord
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de la boutique</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez votre espace comme dans un vrai SaaS.
        </p>
      </div>

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
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-medium transition-opacity shadow-lg glow-primary"
          >
            <Save className="w-4 h-4" />
            {saved ? "Enregistré !" : "Sauvegarder"}
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

      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
      />

    </div>
  );
}
