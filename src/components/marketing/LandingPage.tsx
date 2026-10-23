import React, { useState } from "react";

interface LandingPageProps {
  onLoginClick: (isSignUp: boolean) => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="bg-surface font-sans text-on-surface antialiased selection:bg-primary/20">
      {/* ================================================================ */}
      {/* HEADER / NAVIGATION                                              */}
      {/* ================================================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container">
        <div className="h-20 max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2.5">
              <img alt="MaBoutiquePro Logo" className="h-8 w-auto object-contain" src="/logo.png" />
              <span className="font-headline-sm text-lg sm:text-xl text-on-surface tracking-tight font-extrabold">
                MaBoutiquePro
              </span>
            </div>
            {/* Bouton Menu Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors w-fit"
              aria-label="Menu de navigation"
            >
              <span className="material-symbols-outlined text-base leading-none text-primary">
                {isMobileMenuOpen ? "close" : "menu"}
              </span>
              <span className="text-[11px] text-on-surface-variant font-bold tracking-wide">
                {isMobileMenuOpen ? "Fermer" : "Menu"}
              </span>
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            <a className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors" href="#tarifs">
              Tarifs
            </a>
            <a className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors" href="#features">
              Fonctionnalités
            </a>
            <a className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors" href="#faq">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onLoginClick(false)}
              className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors hidden sm:inline-flex px-3 py-2 cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={() => onLoginClick(true)}
              className="group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:from-indigo-500 hover:to-violet-600 active:scale-[0.98] transition-all duration-300 whitespace-nowrap overflow-hidden cursor-pointer"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <span>Essai gratuit 14 jours</span>
                <span className="material-symbols-outlined text-base transition-transform duration-300 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </span>
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Menu Mobile Déroulant */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-surface-container-lowest border-b border-surface-container shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
            <a
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-on-surface-variant hover:text-primary transition-colors font-semibold flex items-center gap-3"
              href="#tarifs"
            >
              <span className="material-symbols-outlined text-primary/70">payments</span>
              Tarifs d&apos;abonnement
            </a>
            <a
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-on-surface-variant hover:text-primary transition-colors font-semibold flex items-center gap-3"
              href="#features"
            >
              <span className="material-symbols-outlined text-primary/70">auto_awesome</span>
              Fonctionnalités
            </a>
            <a
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-on-surface-variant hover:text-primary transition-colors font-semibold flex items-center gap-3"
              href="#faq"
            >
              <span className="material-symbols-outlined text-primary/70">help</span>
              Questions fréquentes
            </a>
            <div className="w-full h-px bg-surface-container my-1"></div>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLoginClick(false);
              }}
              className="text-base text-on-surface-variant hover:text-on-surface transition-colors font-bold text-left flex items-center gap-3 py-1"
            >
              <span className="material-symbols-outlined text-outline">login</span>
              Se connecter
            </button>
          </div>
        )}
      </header>

      <main className="w-full pt-20">
        {/* ================================================================ */}
        {/* 1. HERO SECTION : À LA PREMIÈRE VUE (TITRE, SOUS-TITRE, CTA)     */}
        {/* ================================================================ */}
        <section className="relative w-full pt-12 sm:pt-16 pb-16 sm:pb-20 px-4 md:px-8 bg-gradient-to-b from-surface-container-low/50 via-surface to-surface flex flex-col items-center text-center overflow-hidden">
          {/* Halos subtils d&apos;arrière-plan */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[800px] h-[320px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
          <div className="absolute top-28 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none -z-10"></div>

          {/* Badge discret */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant/30 text-primary text-xs sm:text-sm shadow-xs mb-5 transition-all hover:bg-surface-container-high cursor-default">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-on-surface">✨ 14 jours d&apos;essai gratuit • Sans carte bancaire</span>
          </div>

          {/* Grand Titre (Impactant, moderne & immédiat) */}
          <h1 className="max-w-4xl font-display-hero text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-on-surface mb-4 sm:mb-6 leading-[1.14]">
            Gérez votre boutique en toute sérénité.
            <span className="block mt-2 bg-gradient-to-r from-indigo-600 via-primary to-violet-600 bg-clip-text text-transparent">
              Ventes, stocks &amp; bénéfices en direct.
            </span>
          </h1>

          {/* Sous-titre clair, lisible & direct */}
          <p className="max-w-2xl text-base sm:text-lg md:text-xl text-on-surface-variant mb-8 sm:mb-10 leading-relaxed font-medium">
            Fini les cahiers de comptes et les pertes d&apos;argent. Enregistrez vos ventes au comptoir, contrôlez vos stocks en temps réel et suivez vos créances clients en FCFA — directement depuis votre smartphone ou PC.
          </p>

          {/* CTA À LA PREMIÈRE VUE */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full max-w-md sm:max-w-none mb-6">
            <button
              onClick={() => onLoginClick(true)}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white font-title-md text-base sm:text-lg shadow-xl shadow-indigo-600/35 hover:shadow-2xl hover:shadow-indigo-600/50 hover:from-indigo-500 hover:to-violet-600 active:scale-[0.98] transition-all duration-300 font-extrabold relative overflow-hidden cursor-pointer"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>Démarrer mes 14 jours gratuits</span>
                <span className="material-symbols-outlined text-2xl transition-transform duration-300 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </span>
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
            </button>

            <a
              href="#tarifs"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 sm:py-5 rounded-2xl bg-surface-container-lowest text-on-surface font-title-md text-base border-2 border-outline-variant/40 hover:bg-surface-container-low hover:border-primary/40 active:scale-[0.98] transition-all shadow-xs font-bold"
            >
              <span className="material-symbols-outlined text-primary text-xl">payments</span>
              <span>Voir les prix d&apos;abonnement</span>
            </a>
          </div>

          {/* Micro-réassurances sous le CTA */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-outline font-medium">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <span className="material-symbols-outlined text-sm">check_circle</span> 14 jours offerts
            </span>
            <span className="text-outline/40">•</span>
            <span>Sans engagement</span>
            <span className="text-outline/40">•</span>
            <span>Paiement Mobile Money</span>
            <span className="text-outline/40">•</span>
            <span className="font-bold text-primary">100% en FCFA</span>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 2. SECTION TARIFICATION D&apos;ABONNEMENT (MISE EN PLACE EN HAUT)     */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-20 px-4 md:px-8 bg-surface-container-low/40 border-t border-outline-variant/20" id="tarifs">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider mb-3">
                🎁 14 JOURS D&apos;ESSAI GRATUIT POUR TOUS
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mt-1 mb-3">
                Des formules simples, claires et accessibles
              </h2>
              <p className="text-base text-on-surface-variant font-medium">
                Commencez par 14 jours d&apos;essai 100% gratuit sans carte bancaire, puis choisissez la formule adaptée à votre commerce.
              </p>
            </div>

            {/* Toggle Mensuel / Annuel */}
            <div className="flex items-center justify-center gap-4 mb-10">
              <span className={`text-sm font-bold transition-colors ${!isAnnual ? "text-primary" : "text-on-surface-variant"}`}>
                Facturation Mensuelle
              </span>
              <button
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative inline-flex h-8 w-15 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${isAnnual ? "bg-primary" : "bg-surface-container-high"}`}
                aria-label="Basculer vers la facturation annuelle"
              >
                <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
              </button>
              <span className={`text-sm font-bold flex items-center gap-2 transition-colors ${isAnnual ? "text-primary" : "text-on-surface-variant"}`}>
                Facturation Annuelle
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[11px] font-extrabold uppercase border border-emerald-500/20">
                  2 mois offerts
                </span>
              </span>
            </div>

            {/* Bandeau d&apos;information Essai Gratuit */}
            <div className="mb-10 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-center max-w-2xl mx-auto flex items-center justify-center gap-2 font-bold text-sm shadow-xs">
              <span className="text-base">🎁</span>
              <span><b>14 jours d&apos;essai gratuit</b> offerts à l&apos;inscription • Toutes les fonctionnalités PRO débloquées • Sans carte bancaire</span>
            </div>

            {/* Les 3 Colonnes : 1. STARTER (2 500 F) | 2. PRO (5 000 F) | 3. BUSINESS (10 000 F) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
              
              {/* CARTE 1 : PLAN STARTER (2 500 F) */}
              <div className="bg-surface-container-lowest p-8 rounded-3xl border-2 border-blue-500/30 shadow-md hover:shadow-xl hover:border-blue-500/60 transition-all duration-300 flex flex-col justify-between relative">
                <div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-black uppercase tracking-wider w-fit mb-4">
                    Solo &amp; Démarrage
                  </div>
                  <h3 className="text-2xl font-extrabold text-on-surface mb-1">STARTER</h3>
                  <p className="text-xs text-on-surface-variant mb-6 font-medium">Pour commerçants indépendants souhaitant numériser leurs ventes et leurs stocks simplement.</p>
                  
                  <div className="mb-6">
                    <div className="text-4xl font-black text-blue-600">
                      {isAnnual ? "25 000" : "2 500"}{" "}
                      <span className="text-sm font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-xs text-emerald-700 font-bold mt-1">Soit ~2 083 FCFA / mois (5 000 F d&apos;économie)</p>
                    ) : (
                      <p className="text-xs text-outline font-medium mt-1">Payable par Mobile Money chaque mois</p>
                    )}
                  </div>

                  <ul className="space-y-3.5 text-sm text-on-surface mb-8 font-medium">
                    <li className="flex items-center gap-2.5 font-bold"><span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span> 1 Boutique &amp; 1 Gérant (Admin)</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span> Gestion des produits &amp; du stock</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span> Ventes directes au comptoir illimitées</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span> Calcul des marges &amp; bénéfices nets</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span> <b>Mode Hors-ligne (PWA)</b> sans internet</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span> Tableau de bord essentiel</li>
                  </ul>
                </div>

                <button 
                  onClick={() => onLoginClick(true)} 
                  className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100/70 border-2 border-blue-500/40 text-blue-800 font-extrabold text-base text-center hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-blue-600 shadow-md hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-xl group-hover:text-white transition-colors">rocket_launch</span>
                    <span>Commencer gratuitement</span>
                    <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
                  </span>
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
                </button>
              </div>

              {/* CARTE 2 : PLAN PRO (5 000 F) - LE PLUS POPULAIRE */}
              <div className="bg-surface-container-lowest p-8 rounded-3xl border-2 border-emerald-600 shadow-2xl shadow-emerald-600/20 flex flex-col justify-between relative transform lg:-translate-y-2 hover:-translate-y-3 transition-all duration-300 ring-4 ring-emerald-600/10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="material-symbols-outlined text-yellow-300 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span>⭐ Recommandé • Boutique Complète</span>
                </div>
                <div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black uppercase tracking-wider w-fit mb-4 mt-2">
                    Boutique Individuelle
                  </div>
                  <h3 className="text-2xl font-extrabold text-on-surface mb-1">PRO</h3>
                  <p className="text-xs text-on-surface-variant mb-6 font-medium">Pour boutiques actives avec reçus, dettes clients et 1 caissier inclus.</p>
                  
                  <div className="mb-6">
                    <div className="text-4xl font-black text-emerald-600">
                      {isAnnual ? "50 000" : "5 000"}{" "}
                      <span className="text-sm font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-xs text-emerald-700 font-bold mt-1">Soit ~4 166 FCFA / mois (10 000 F d&apos;économie)</p>
                    ) : (
                      <p className="text-xs text-outline font-medium mt-1">Payable par Mobile Money chaque mois</p>
                    )}
                  </div>

                  <ul className="space-y-3.5 text-sm text-on-surface mb-8 font-medium">
                    <li className="flex items-center gap-2.5 font-bold text-emerald-700"><span className="material-symbols-outlined text-emerald-600 text-lg">verified</span> Tout ce qui est inclus dans Starter</li>
                    <li className="flex items-center gap-2.5 font-semibold"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> <b>1 Caissier inclus</b> avec compte dédié</li>
                    <li className="flex items-center gap-2.5 font-semibold"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> <b>Carnet de Crédit &amp; Dettes (Relances WhatsApp)</b></li>
                    <li className="flex items-center gap-2.5 font-semibold"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> <b>Tickets thermiques 80mm &amp; Factures A4</b></li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> Inventaires physiques tournants &amp; Écarts</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> Commandes fournisseurs &amp; Analyses complètes</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> Support WhatsApp réactif</li>
                  </ul>
                </div>

                <button 
                  onClick={() => onLoginClick(true)} 
                  className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white font-black text-base text-center shadow-xl shadow-emerald-600/40 hover:shadow-2xl hover:shadow-emerald-600/60 hover:from-emerald-500 hover:to-indigo-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden cursor-pointer"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-yellow-300 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                    <span>Essayer gratuitement 14 jours</span>
                    <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
                  </span>
                </button>
              </div>

              {/* CARTE 3 : PLAN BUSINESS (10 000 F) */}
              <div className="bg-surface-container-lowest p-8 rounded-3xl border-2 border-purple-500/50 shadow-xl shadow-purple-500/10 hover:border-purple-600 hover:shadow-2xl hover:shadow-purple-500/20 flex flex-col justify-between relative transition-all duration-300">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-700 to-fuchsia-700 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-purple-700/30 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="material-symbols-outlined text-amber-300 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                  <span>💎 Multi-Magasins &amp; Équipe</span>
                </div>
                <div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-black uppercase tracking-wider w-fit mb-4 mt-2">
                    Multi-Points de Vente
                  </div>
                  <h3 className="text-2xl font-extrabold text-on-surface mb-1">BUSINESS</h3>
                  <p className="text-xs text-on-surface-variant mb-6 font-medium">Pour propriétaires gérant plusieurs points de vente avec une équipe de caissiers.</p>
                  
                  <div className="mb-6">
                    <div className="text-4xl font-black text-purple-700">
                      {isAnnual ? "100 000" : "10 000"}{" "}
                      <span className="text-sm font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-xs text-emerald-700 font-bold mt-1">Soit ~8 333 FCFA / mois (20 000 F d&apos;économie)</p>
                    ) : (
                      <p className="text-xs text-outline font-medium mt-1">Payable par Mobile Money chaque mois</p>
                    )}
                  </div>

                  <ul className="space-y-3.5 text-sm text-on-surface mb-8 font-medium">
                    <li className="flex items-center gap-2.5 font-bold text-purple-700"><span className="material-symbols-outlined text-purple-600 text-lg">verified</span> Toutes les fonctionnalités Pro incluses</li>
                    <li className="flex items-center gap-2.5 font-bold"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> <b>Jusqu&apos;à 3 Boutiques actives</b></li>
                    <li className="flex items-center gap-2.5 font-bold"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> <b>Jusqu&apos;à 3 Caissiers au total</b></li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Sélecteur &amp; Affectation par boutique</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Tableau de bord consolidé multi-magasins</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Clôtures de caisse certifiées &amp; Détection des écarts</li>
                    <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Support VIP prioritaire WhatsApp 7j/7</li>
                  </ul>
                </div>

                <button 
                  onClick={() => onLoginClick(true)} 
                  className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-700 via-violet-700 to-indigo-800 text-white font-black text-base text-center shadow-xl shadow-purple-700/40 hover:shadow-2xl hover:shadow-purple-700/60 hover:from-purple-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden cursor-pointer"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-amber-300 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                    <span>Choisir Business après l&apos;essai</span>
                    <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
                  </span>
                </button>
              </div>

            </div>

            {/* Mentions de réassurance sous la tarification */}
            <div className="mt-12 text-center text-xs text-on-surface-variant font-medium flex flex-wrap items-center justify-center gap-6 p-4 rounded-2xl bg-surface-container-low/70 border border-outline-variant/30 max-w-3xl mx-auto shadow-xs">
              <span className="flex items-center gap-2 font-bold text-on-surface">
                <span className="material-symbols-outlined text-indigo-600 text-lg">verified_user</span>
                Paiement 100% sécurisé via Moneriz (T-Money, Moov Flooz, Wave, Orange Money, Carte)
              </span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                <span className="material-symbols-outlined text-emerald-600 text-lg">lock</span>
                Sans engagement • Annulation libre en 1 clic
              </span>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 3. SECTION FONCTIONNALITÉS CLÉS                                  */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-20 px-4 md:px-8 bg-surface" id="features">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs text-primary font-bold uppercase tracking-widest mb-2 inline-block">
                Conçu pour votre quotidien
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4">
                Tout ce qu&apos;il vous faut pour piloter votre commerce
              </h2>
              <p className="text-base text-on-surface-variant font-medium">
                Une interface fluide, intuitive et rapide pour vendre au comptoir et garder le contrôle total de vos finances.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Carte 1 */}
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">point_of_sale</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Caisse Tactile &amp; Mode Hors-ligne</h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Enregistrez vos ventes en 2 clics avec ou sans lecteur code-barres. Continuez à encaisser même en cas de coupure internet.
                </p>
              </div>

              {/* Carte 2 */}
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">inventory_2</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Gestion des Stocks &amp; Alertes</h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Soyez averti dès qu&apos;un produit approche du seuil critique. Effectuez vos inventaires tournants et détectez immédiatement les écarts.
                </p>
              </div>

              {/* Carte 3 */}
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">menu_book</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Carnet de Dettes &amp; WhatsApp</h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Suivez les créances clients et envoyez des relances cordiales pré-remplies directement sur WhatsApp avec le solde exact et la date limite.
                </p>
              </div>

              {/* Carte 4 */}
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">receipt_long</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Reçus Thermiques &amp; Factures A4</h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Imprimez instantanément des tickets professionnels 80mm ou téléchargez des factures et bordereaux A4 au format PDF propre.
                </p>
              </div>

              {/* Carte 5 */}
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">trending_up</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Bénéfice Net Réel en FCFA</h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Visualisez votre marge réelle après déduction automatique des prix d&apos;achat et des dépenses du magasin (loyer, transport, etc.).
                </p>
              </div>

              {/* Carte 6 */}
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">store</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Multi-Boutiques &amp; Équipe</h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Gérez jusqu&apos;à 3 magasins avec des caissiers dédiés. Clôtures de caisse (X et Z) certifiées et contrôle des écarts patron.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 4. SECTION FAQ                                                   */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-20 px-4 md:px-8 bg-surface-container-low/30 border-t border-outline-variant/20" id="faq">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs text-primary font-bold uppercase tracking-widest mb-2 inline-block">
                Aide &amp; Clarté
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-3">
                Questions Fréquemment Posées
              </h2>
              <p className="text-sm text-on-surface-variant font-medium">
                Tout ce que vous devez savoir avant de commencer sereinement.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
                <h3 className="text-base font-bold text-on-surface mb-2">
                  Comment fonctionne la période d&apos;essai gratuit de 14 jours ?
                </h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Dès votre inscription, vous bénéficiez immédiatement de 14 jours d&apos;accès complet à toutes les fonctionnalités PRO, sans aucun engagement et sans avoir à renseigner de carte bancaire. Vous pouvez tester librement avec votre équipe.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
                <h3 className="text-base font-bold text-on-surface mb-2">
                  Comment s&apos;effectue le règlement de l&apos;abonnement ?
                </h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Le paiement se fait facilement en FCFA par Mobile Money (T-Money, Moov Flooz, Wave, Orange Money, MTN) ou par carte bancaire. Les transactions sont sécurisées par notre passerelle agréée Moneriz.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
                <h3 className="text-base font-bold text-on-surface mb-2">
                  Puis-je utiliser l&apos;application sans connexion internet ?
                </h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Oui ! MaBoutiquePro est une Progressive Web App (PWA). Vous pouvez encaisser vos clients au comptoir même si votre connexion est coupée. Vos ventes se synchronisent automatiquement dès le retour du réseau.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
                <h3 className="text-base font-bold text-on-surface mb-2">
                  Mes caissiers peuvent-ils voir mes marges ou mes prix d&apos;achat ?
                </h3>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  Non. Chaque caissier dispose de son propre compte sécurisé. Il ne peut accéder qu&apos;à l&apos;écran de caisse de sa boutique et ne voit jamais vos prix d&apos;achat, vos marges bénéficiaires ni les autres boutiques.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 5. GRAND CTA FINAL                                               */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-20 px-4 md:px-8 bg-gradient-to-br from-indigo-700 via-primary to-violet-800 text-white text-center">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white border border-white/20 text-xs font-black uppercase tracking-wider mb-4">
              Modernisez votre gestion dès aujourd&apos;hui
            </span>
            <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight leading-tight">
              Prenez le contrôle de votre boutique maintenant
            </h2>
            <p className="max-w-xl text-base sm:text-lg text-white/90 mb-8 font-medium leading-relaxed">
              Rejoignez les commerçants qui gagnent du temps, sécurisent leurs encaissements et éliminent les pertes de caisse.
            </p>
            <button
              onClick={() => onLoginClick(true)}
              className="group inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-2xl bg-white text-indigo-700 font-black text-base sm:text-lg hover:bg-white/95 active:scale-[0.98] transition-all duration-300 shadow-2xl shadow-black/25 cursor-pointer"
            >
              <span>Démarrer vos 14 jours gratuits</span>
              <span className="material-symbols-outlined text-2xl transition-transform duration-300 group-hover:translate-x-1.5">
                arrow_forward
              </span>
            </button>
            <p className="text-xs text-white/70 mt-4 font-semibold">
              Sans carte bancaire • Prêt en 2 minutes • 100% en FCFA
            </p>
          </div>
        </section>
      </main>

      {/* ================================================================ */}
      {/* FOOTER                                                           */}
      {/* ================================================================ */}
      <footer className="w-full bg-inverse-surface text-inverse-on-surface">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-20 sm:pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-on-surface-variant/20">
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold text-inverse-on-surface">MaBoutiquePro</span>
              <span className="text-xs text-inverse-on-surface/60">
                — Caisse, stocks &amp; gestion commerciale pour l&apos;Afrique
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-inverse-on-surface/75 font-medium">
              <a href="#tarifs" className="hover:text-inverse-primary transition-colors">Tarifs</a>
              <a href="#features" className="hover:text-inverse-primary transition-colors">Fonctionnalités</a>
              <a href="#faq" className="hover:text-inverse-primary transition-colors">FAQ</a>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-inverse-on-surface/60 font-medium text-center sm:text-left">
            <p>© 2026 MaBoutiquePro. Tous droits réservés.</p>
            <p className="flex items-center gap-1 justify-center">
              <span className="material-symbols-outlined text-[16px] text-rose-400">favorite</span>
              <span>Développé avec fierté pour les entrepreneurs africains.</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Barre WhatsApp Sticky en bas (Mobile) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container shadow-2xl flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-on-surface truncate">Besoin d&apos;aide ou d&apos;informations ?</p>
          <p className="text-[10px] text-emerald-700 font-semibold truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Assistance WhatsApp directe
          </p>
        </div>
        <a
          href="https://wa.me/22898376101?text=Bonjour%20MaBoutiquePro%2C%20je%20souhaite%20des%20renseignements%20sur%20l%27application."
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-extrabold text-xs shadow-md shadow-[#25D366]/30 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          <span>WhatsApp</span>
        </a>
      </div>

      {/* Bouton WhatsApp flottant sur Desktop */}
      <a
        href="https://wa.me/22898376101?text=Bonjour%20MaBoutiquePro%2C%20je%20souhaite%20des%20renseignements%20sur%20l%27application."
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2.5 px-4 py-3 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-bold text-sm shadow-xl shadow-[#25D366]/40 transition-all duration-300 hover:shadow-2xl cursor-pointer group"
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
        <span>Discuter sur WhatsApp</span>
      </a>
    </div>
  );
}
