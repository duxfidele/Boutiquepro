import React, { useState } from 'react';

interface LandingPageProps {
  onLoginClick: (isSignUp: boolean) => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  return (
    <div className="bg-surface font-sans text-on-surface antialiased">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container">
        <div className="h-20 max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <img alt="MaBoutiquePro Logo" className="h-7 sm:h-8 w-auto object-contain" src="/logo.png"/>
              <span className="font-headline-sm text-base sm:text-headline-sm text-on-surface tracking-tight font-bold">MaBoutiquePro</span>
            </div>
            {/* Les trois traits de menu positionnés au-dessous de MaBoutiquePro sur mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors w-fit"
              aria-label="Menu de navigation"
            >
              <span className="material-symbols-outlined text-base leading-none text-primary">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
              <span className="text-[11px] text-on-surface-variant font-bold tracking-wide">
                {isMobileMenuOpen ? 'Fermer' : 'Menu'}
              </span>
            </button>
          </div>
          <nav className="hidden lg:flex items-center gap-space-lg">
            <a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#features">Fonctionnalités</a>
            <a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#how-it-works">Comment ça marche</a>
            <a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#tarifs">Tarifs</a>
            <a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#faq-accordion">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-space-md">
            <button onClick={() => onLoginClick(false)} className="font-title-md text-title-md text-on-surface-variant hover:text-on-surface transition-colors hidden sm:inline-flex font-semibold mr-4">
              Se connecter
            </button>
            <button onClick={() => onLoginClick(true)} className="group relative inline-flex items-center justify-center gap-2 px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white font-title-md text-xs sm:text-base shadow-md shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:from-indigo-500 hover:to-violet-600 active:scale-[0.98] transition-all duration-300 font-bold whitespace-nowrap overflow-hidden cursor-pointer">
              <span className="relative z-10 flex items-center gap-1.5">
                <span className="hidden sm:inline">Essai gratuit 14 jours</span>
                <span className="sm:hidden font-bold">Essai gratuit</span>
                <span className="material-symbols-outlined text-base sm:text-lg transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
              </span>
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-20 left-0 right-0 bg-surface-container-lowest border-b border-surface-container shadow-2xl p-6 flex flex-col gap-6 z-40 animate-in slide-in-from-top-2">
            <a onClick={() => setIsMobileMenuOpen(false)} className="font-title-md text-lg text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-3" href="#features">
              <span className="material-symbols-outlined text-primary/70">auto_awesome</span> Fonctionnalités
            </a>
            <a onClick={() => setIsMobileMenuOpen(false)} className="font-title-md text-lg text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-3" href="#how-it-works">
              <span className="material-symbols-outlined text-primary/70">play_circle</span> Comment ça marche
            </a>
            <a onClick={() => setIsMobileMenuOpen(false)} className="font-title-md text-lg text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-3" href="#tarifs">
              <span className="material-symbols-outlined text-primary/70">payments</span> Tarifs
            </a>
            <a onClick={() => setIsMobileMenuOpen(false)} className="font-title-md text-lg text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-3" href="#faq-accordion">
              <span className="material-symbols-outlined text-primary/70">help</span> FAQ
            </a>
            <div className="w-full h-px bg-surface-container my-2"></div>
            <button onClick={() => { setIsMobileMenuOpen(false); onLoginClick(false); }} className="font-title-md text-lg text-on-surface-variant hover:text-on-surface transition-colors font-bold text-left flex items-center gap-3">
              <span className="material-symbols-outlined text-outline">login</span> Se connecter
            </button>
          </div>
        )}
      </header>

      <main className="w-full pt-16 sm:pt-20 bg-surface">
        <div className="flex flex-col w-full overflow-hidden">
          {/* 1. HERO SECTION (MOBILE-FIRST) */}
          <section className="relative w-full pt-4 sm:pt-10 md:pt-16 pb-10 sm:pb-20 px-4 md:px-8 bg-gradient-to-b from-surface-container-low/40 via-surface to-surface flex flex-col items-center text-center">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[720px] h-[260px] sm:h-[340px] bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
            <div className="absolute top-32 left-1/4 w-52 sm:w-80 h-52 sm:h-80 bg-secondary/5 rounded-full blur-2xl pointer-events-none -z-10"></div>

            {/* Badge rassurant compact */}
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-surface-container border border-outline-variant/30 text-primary font-title-md text-xs sm:text-sm shadow-xs mb-3 sm:mb-5 transition-all hover:bg-surface-container-high cursor-default">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-on-surface">✨ 14 jours d&apos;essai gratuit • Sans carte bancaire</span>
            </div>

            {/* Grand Titre (Impactant, moderne & mobile-first) */}
            <h1 className="max-w-4xl font-display-hero text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-on-surface mb-3 sm:mb-5 leading-[1.14]">
              Gérez votre boutique en toute sérénité.
              <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-primary via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Ventes, stocks &amp; bénéfices en direct.
              </span>
            </h1>

            {/* Sous-titre clair, lisible & direct */}
            <p className="max-w-2xl text-sm sm:text-lg md:text-xl text-on-surface-variant mb-5 sm:mb-8 leading-snug sm:leading-relaxed font-medium text-balance">
              Fini les cahiers de comptes et les pertes d&apos;argent. Enregistrez vos ventes au comptoir, contrôlez vos stocks en temps réel et suivez vos bénéfices en FCFA — directement depuis votre smartphone ou PC.
            </p>

            {/* CTA Clair & Immanquable (immédiatement visible au-dessus de la ligne de flottaison sur mobile) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto max-w-md sm:max-w-none">
              <button
                onClick={() => onLoginClick(true)}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white font-title-md text-base sm:text-lg shadow-xl shadow-indigo-600/35 hover:shadow-2xl hover:shadow-indigo-600/50 hover:from-indigo-500 hover:to-violet-600 active:scale-[0.98] transition-all duration-300 font-extrabold relative overflow-hidden cursor-pointer"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span>Démarrer mes 14 jours gratuits</span>
                  <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
                </span>
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
              </button>

              <a
                href="#mockup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-surface-container-lowest text-on-surface font-title-md text-sm sm:text-base border border-outline-variant/40 hover:bg-surface-container-low active:scale-[0.98] transition-all shadow-xs font-bold"
              >
                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                <span>Voir la démonstration</span>
              </a>
            </div>

            {/* Micro-réassurances sous le CTA */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1 mt-3 sm:mt-4 mb-6 sm:mb-14 text-[11px] sm:text-xs text-outline font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="material-symbols-outlined text-[13px] sm:text-sm">check_circle</span> 14 jours d&apos;essai offert
              </span>
              <span className="text-outline/40">•</span>
              <span>Sans carte bancaire</span>
              <span className="text-outline/40">•</span>
              <span>Prêt en 2 min</span>
              <span className="text-outline/40">•</span>
              <span className="font-bold text-primary">100% adapté Afrique (FCFA)</span>
            </div>
<div className="w-full max-w-6xl relative mx-auto text-left" id="mockup">
<div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-tertiary/20 to-secondary/20 rounded-2xl blur-xl opacity-60"></div>
<div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden">
<div className="bg-surface-container-low px-5 py-3.5 flex items-center justify-between border-b border-outline-variant/20">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block shadow-inner"></span>
<span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block shadow-inner"></span>
<span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block shadow-inner"></span>
<span className="ml-4 text-xs text-outline hidden sm:inline-flex items-center gap-1.5 font-medium">
<span className="material-symbols-outlined text-sm">lock</span>
              maboutiquepro.app
            </span>
</div>
<div className="flex items-center gap-3">
<div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-semibold">
<span className="material-symbols-outlined text-sm text-primary">store</span>
<span>Boutique Étoile</span>
</div>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
              En ligne
            </span>
</div>
</div>
<div className="p-5 md:p-8 bg-surface space-y-6">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
<div className="w-full h-1 bg-primary absolute top-0 left-0"></div>
<div className="flex items-center justify-between text-outline mb-2">
<span className="text-xs uppercase tracking-wider font-bold">Chiffre du jour</span>
<span className="material-symbols-outlined text-primary text-xl">payments</span>
</div>
<div className="text-2xl text-on-surface tracking-tight font-extrabold">148 500 <span className="text-sm text-outline font-medium">FCFA</span></div>
<div className="flex items-center gap-1 mt-2 text-tertiary text-xs font-semibold">
<span className="material-symbols-outlined text-base">trending_up</span>
<span>+18.4%</span>
<span className="font-normal text-outline">vs hier</span>
</div>
</div>
<div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
<div className="w-full h-1 bg-secondary absolute top-0 left-0"></div>
<div className="flex items-center justify-between text-outline mb-2">
<span className="text-xs uppercase tracking-wider font-bold">Ventes réalisées</span>
<span className="material-symbols-outlined text-secondary text-xl">point_of_sale</span>
</div>
<div className="text-2xl text-on-surface tracking-tight font-extrabold">32 <span className="text-sm text-outline font-medium">tickets</span></div>
<div className="flex items-center gap-1 mt-2 text-outline text-xs font-medium">
<span className="material-symbols-outlined text-base text-primary">schedule</span>
<span>Dernière : il y a 4 min</span>
</div>
</div>
<div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
<div className="w-full h-1 bg-tertiary-container absolute top-0 left-0"></div>
<div className="flex items-center justify-between text-outline mb-2">
<span className="text-xs uppercase tracking-wider font-bold">Bénéfice estimé</span>
<span className="material-symbols-outlined text-tertiary text-xl">account_balance_wallet</span>
</div>
<div className="text-2xl text-primary tracking-tight font-extrabold">42 200 <span className="text-sm text-outline font-medium">FCFA</span></div>
<div className="flex items-center gap-1 mt-2 text-outline text-xs font-medium">
<span>Marge brute ~ 28.4%</span>
</div>
</div>
<div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
<div className="w-full h-1 bg-amber-500 absolute top-0 left-0"></div>
<div className="flex items-center justify-between text-outline mb-2">
<span className="text-xs uppercase tracking-wider font-bold">Articles en stock</span>
<span className="material-symbols-outlined text-amber-600 text-xl">inventory_2</span>
</div>
<div className="text-2xl text-on-surface tracking-tight font-extrabold">428 <span className="text-sm text-outline font-medium">unités</span></div>
<div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold w-fit border border-amber-200">
<span className="material-symbols-outlined text-xs">warning</span>
<span>3 alertes stock faible</span>
</div>
</div>
</div>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
<div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-4">
<div>
<h3 className="text-lg font-bold text-on-surface">Évolution des ventes hebdomadaires</h3>
<p className="text-xs text-outline font-medium">Période : 12 Nov — 18 Nov • Total : 1 240 000 FCFA</p>
</div>
<span className="px-3 py-1 rounded-md bg-surface-container text-xs font-bold text-on-surface-variant">7 jours</span>
</div>
<div className="w-full pt-4">
<svg className="w-full h-44 text-primary overflow-visible" fill="none" viewBox="0 0 520 180">
<defs>
<linearGradient id="chartGlow" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stopColor="#00685f" stopOpacity="0.32"></stop>
<stop offset="100%" stopColor="#00685f" stopOpacity="0.0"></stop>
</linearGradient>
</defs>
<line stroke="#e5eeff" strokeDasharray="3 3" x1="0" x2="520" y1="30" y2="30"></line>
<line stroke="#e5eeff" strokeDasharray="3 3" x1="0" x2="520" y1="80" y2="80"></line>
<line stroke="#e5eeff" strokeDasharray="3 3" x1="0" x2="520" y1="130" y2="130"></line>
<path d="M 10 140 L 85 115 L 160 125 L 235 90 L 310 95 L 385 140 L 460 30 L 510 65 L 510 170 L 10 170 Z" fill="url(#chartGlow)"></path>
<path d="M 10 140 L 85 115 L 160 125 L 235 90 L 310 95 L 385 140 L 460 30 L 510 65" stroke="#00685f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
<circle cx="85" cy="115" fill="#ffffff" r="4" stroke="#00685f" strokeWidth="2"></circle>
<circle cx="160" cy="125" fill="#ffffff" r="4" stroke="#00685f" strokeWidth="2"></circle>
<circle cx="235" cy="90" fill="#ffffff" r="4" stroke="#00685f" strokeWidth="2"></circle>
<circle cx="310" cy="95" fill="#ffffff" r="4" stroke="#00685f" strokeWidth="2"></circle>
<circle cx="385" cy="140" fill="#ffffff" r="4" stroke="#00685f" strokeWidth="2"></circle>
<circle className="animate-pulse" cx="460" cy="30" fill="#00685f" r="6"></circle>
<circle cx="460" cy="30" fill="#ffffff" r="2.5"></circle>
<rect fill="#213145" height="22" rx="4" width="100" x="410" y="2"></rect>
<text fill="#ffffff" fontFamily="Plus Jakarta Sans" fontSize="10" fontWeight="700" textAnchor="middle" x="460" y="16">Samedi: 280 000 F</text>
</svg>
<div className="flex justify-between items-center text-outline text-[11px] font-bold pt-2 px-2">
<span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span className="font-bold text-primary">Sam (Pic)</span><span>Dim</span>
</div>
</div>
</div>
<div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-4">
<div className="flex items-center gap-2">
<span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
<h3 className="text-lg font-bold text-on-surface">Dernières ventes</h3>
</div>
<span className="text-xs font-bold text-primary cursor-pointer hover:underline">Voir tout</span>
</div>
<div className="divide-y divide-surface-container space-y-2">
<div className="pt-2 flex items-center justify-between text-sm">
<div>
<p className="font-semibold text-on-surface">Amavi Koffi</p>
<p className="text-outline text-xs">2x Huile Dinor 5L</p>
</div>
<div className="text-right">
<p className="font-bold text-on-surface">19 000 FCFA</p>
<span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
<span className="material-symbols-outlined text-[12px]">payments</span> Espèces
                    </span>
</div>
</div>
<div className="pt-2 flex items-center justify-between text-sm">
<div>
<p className="font-semibold text-on-surface">Mme Lawson</p>
<p className="text-outline text-xs">1x Sac Riz Parfumé 25kg</p>
</div>
<div className="text-right">
<p className="font-bold text-on-surface">22 500 FCFA</p>
<span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
<span className="material-symbols-outlined text-[12px]">phone_android</span> T-Money
                    </span>
</div>
</div>
<div className="pt-2 flex items-center justify-between text-sm">
<div>
<p className="font-semibold text-on-surface">Akouvi Mensah</p>
<p className="text-outline text-xs">Lot Savon &amp; Détergents</p>
</div>
<div className="text-right">
<p className="font-bold text-on-surface">8 400 FCFA</p>
<span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
<span className="material-symbols-outlined text-[12px]">contactless</span> Flooz
                    </span>
</div>
</div>
</div>
<div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between text-xs text-outline font-medium">
<span>Total 3 transactions :</span>
<span className="font-bold text-on-surface text-sm">49 900 FCFA</span>
</div>
</div>
</div>
</div>
<div className="hidden md:flex absolute bottom-5 right-6 bg-inverse-surface text-inverse-on-surface p-3.5 rounded-xl shadow-2xl border border-inverse-primary/30 items-center gap-3 animate-bounce">
<span className="material-symbols-outlined text-inverse-primary text-2xl">smartphone</span>
<div className="text-left">
<p className="text-xs text-inverse-primary font-bold">Synchronisation mobile active</p>
<p className="text-[11px] text-inverse-on-surface/75 font-medium">Caisse #01 connectée</p>
</div>
</div>
</div>
</div>
</section>

{/* 2. BANDEAU DE CONFIANCE (Trust Bar) */}
<section id="features" className="w-full bg-surface-container-lowest py-8 px-4 md:px-8 border-y border-outline-variant/30">
<div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary text-2xl">verified</span>
<p className="text-base font-bold text-on-surface">Tout ce dont vous avez besoin pour gérer votre commerce au quotidien :</p>
</div>
<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-on-surface-variant font-medium">
<span className="inline-flex items-center gap-1.5 text-primary"><span className="material-symbols-outlined text-sm">check_circle</span> Gestion des ventes</span>
<span className="inline-flex items-center gap-1.5 text-primary"><span className="material-symbols-outlined text-sm">check_circle</span> Stocks en temps réel</span>
<span className="inline-flex items-center gap-1.5 text-primary"><span className="material-symbols-outlined text-sm">check_circle</span> Fiches clients &amp; crédit</span>
<span className="inline-flex items-center gap-1.5 text-primary"><span className="material-symbols-outlined text-sm">check_circle</span> Suivi des dépenses</span>
<span className="inline-flex items-center gap-1.5 text-primary"><span className="material-symbols-outlined text-sm">check_circle</span> Tableau de bord intuitif</span>
<span className="inline-flex items-center gap-1.5 text-primary font-bold"><span className="material-symbols-outlined text-sm">check_circle</span> Pensé pour le FCFA</span>
</div>
</div>
</section>

{/* 3. SECTION PROBLÈME */}
<section className="w-full py-20 px-4 md:px-8 bg-surface">
<div className="max-w-6xl mx-auto flex flex-col items-center text-center">
<span className="text-xs text-secondary font-bold uppercase tracking-widest mb-3">La réalité du terrain</span>
<h2 className="text-3xl font-extrabold text-on-surface mb-4">Gérer une boutique ne devrait pas être compliqué.</h2>
<p className="max-w-2xl text-base text-on-surface-variant mb-14 font-medium">
        Cahiers déchirés, calculs d&apos;inventaires tardifs à la calculatrice, impayés oubliés et erreurs de caisse qui grignotent vos bénéfices... Il est temps de changer d&apos;époque.
      </p>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
<div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/40 shadow-sm relative group hover:border-primary transition-all">
<div className="w-12 h-12 rounded-xl bg-error-container/40 text-error flex items-center justify-center text-2xl font-black mb-6">
            01
          </div>
<h3 className="text-xl font-bold text-on-surface mb-3">Stocks difficiles à suivre</h3>
<p className="text-sm text-on-surface-variant leading-relaxed font-medium">
            Fini de recompter manuellement chaque soir ou de subir des ruptures inattendues devant vos clients. Plus aucune marchandise égarée sans explication.
          </p>
<div className="mt-6 flex items-center gap-2 text-error text-sm font-bold">
<span className="material-symbols-outlined text-base">close</span>
<span>Ruptures imprévues &amp; pertes</span>
</div>
</div>
<div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/40 shadow-sm relative group hover:border-primary transition-all">
<div className="w-12 h-12 rounded-xl bg-error-container/40 text-error flex items-center justify-center text-2xl font-black mb-6">
            02
          </div>
<h3 className="text-xl font-bold text-on-surface mb-3">Ventes et bénéfices flous</h3>
<p className="text-sm text-on-surface-variant leading-relaxed font-medium">
            Sachez exactement combien vous encaissez et quel est votre bénéfice net réel à la fin de chaque journée après déduction des frais généraux.
          </p>
<div className="mt-6 flex items-center gap-2 text-error text-sm font-bold">
<span className="material-symbols-outlined text-base">close</span>
<span>Confusion entre caisse &amp; bénéfice</span>
</div>
</div>
<div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/40 shadow-sm relative group hover:border-primary transition-all">
<div className="w-12 h-12 rounded-xl bg-error-container/40 text-error flex items-center justify-center text-2xl font-black mb-6">
            03
          </div>
<h3 className="text-xl font-bold text-on-surface mb-3">Gestion dispersée</h3>
<p className="text-sm text-on-surface-variant leading-relaxed font-medium">
            Produits, dettes clients, factures fournisseurs et dépenses quotidiennes enfin regroupés dans votre poche, sécurisés et consultables partout.
          </p>
<div className="mt-6 flex items-center gap-2 text-error text-sm font-bold">
<span className="material-symbols-outlined text-base">close</span>
<span>Risque de perte irrémédiable</span>
</div>
</div>
</div>
<div className="mt-12 inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-primary-container text-on-primary font-bold text-base shadow-sm">
<span className="material-symbols-outlined">auto_awesome</span>
<span>MaBoutiquePro rassemble tout au même endroit avec une simplicité déconcertante.</span>
</div>
</div>
</section>

{/* 4. SECTION FONCTIONNALITÉS */}
<section className="w-full py-20 px-4 md:px-8 bg-surface-container-low/50">
<div className="max-w-6xl mx-auto">
<div className="text-center max-w-3xl mx-auto mb-16">
<span className="text-xs text-primary font-bold uppercase tracking-wider">Boîte à outils complète</span>
<h2 className="text-3xl font-extrabold text-on-surface mt-2 mb-4">Tout ce qu&apos;il faut pour piloter votre boutique.</h2>
<p className="text-base text-on-surface-variant font-medium">Chaque fonctionnalité a été conçue sur le terrain pour répondre précisément aux besoins des commerçants.</p>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
<div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 hover:border-primary hover:shadow-lg transition-all flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
<span className="material-symbols-outlined text-2xl">point_of_sale</span>
</div>
<h3 className="text-lg font-bold text-on-surface mb-2">Caisse Mobile (POS)</h3>
<p className="text-sm text-on-surface-variant font-medium">Enregistrez rapidement vos ventes au comptoir depuis votre téléphone ou ordinateur grâce à une interface intuitive.</p>
</div>
</div>
<div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 hover:border-primary hover:shadow-lg transition-all flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
<span className="material-symbols-outlined text-2xl">inventory_2</span>
</div>
<h3 className="text-lg font-bold text-on-surface mb-2">Suivi des Stocks</h3>
<p className="text-sm text-on-surface-variant font-medium">Gardez un œil sur votre inventaire en temps réel. Ajoutez vos produits et suivez vos quantités sans erreur.</p>
</div>
</div>
<div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 hover:border-primary hover:shadow-lg transition-all flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
<span className="material-symbols-outlined text-2xl">monitoring</span>
</div>
<h3 className="text-lg font-bold text-on-surface mb-2">Tableau de Bord</h3>
<p className="text-sm text-on-surface-variant font-medium">Accédez à une vue globale de vos chiffres. Suivez l&apos;évolution de vos ventes et de vos revenus en un clin d&apos;œil.</p>
</div>
</div>
<div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 hover:border-primary hover:shadow-lg transition-all flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
<span className="material-symbols-outlined text-2xl">cloud_sync</span>
</div>
<h3 className="text-lg font-bold text-on-surface mb-2">100% Cloud & Sécurisé</h3>
<p className="text-sm text-on-surface-variant font-medium">Vos données sont automatiquement sauvegardées sur nos serveurs. Ne perdez plus jamais vos cahiers de comptes.</p>
</div>
</div>
</div>
</div>
</section>

{/* 6. SECTION MOBILE */}
<section className="w-full py-20 px-4 md:px-8 bg-surface-container-lowest">
<div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
<div className="lg:col-span-6 space-y-6">
<span className="text-xs text-primary font-bold uppercase tracking-wider">Mobilité totale</span>
<h2 className="text-3xl font-extrabold text-on-surface">Votre boutique vous accompagne partout.</h2>
<p className="text-base text-on-surface-variant font-medium">
          Que vous soyez au marché, chez un grossiste pour vos achats, ou à la maison en fin de journée, gardez un œil constant sur vos chiffres et validez les ventes depuis votre smartphone.
        </p>
<ul className="space-y-3 pt-2">
<li className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">✓</span>
<span className="text-sm font-medium text-on-surface">Consultation des ventes en temps réel en déplacement</span>
</li>
<li className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">✓</span>
<span className="text-sm font-medium text-on-surface">Suivi de l&apos;inventaire en direct sans être sur place</span>
</li>
<li className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">✓</span>
<span className="text-sm font-medium text-on-surface">Mise à jour immédiate des prix et réceptions de stock</span>
</li>
<li className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">✓</span>
<span className="text-sm font-medium text-on-surface">Accès ultra-rapide optimisé</span>
</li>
</ul>
<div className="pt-4">
<button onClick={() => onLoginClick(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-on-surface text-surface font-bold text-sm hover:bg-on-surface-variant transition-all">
<span className="material-symbols-outlined text-lg">download</span>
<span>Tester l&apos;application mobile</span>
</button>
</div>
</div>
<div className="lg:col-span-6 flex justify-center">
<div className="w-[300px] h-[600px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800 relative">
<div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-20"></div>
<div className="w-full h-full bg-surface rounded-[36px] overflow-hidden flex flex-col pt-8">
<div className="px-4 py-3 bg-surface-container-lowest border-b border-surface-container flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="w-7 h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-xs">BP</span>
<span className="text-xs font-bold text-on-surface">MaBoutiquePro Mobile</span>
</div>
<span className="material-symbols-outlined text-outline text-lg">notifications</span>
</div>
<div className="p-3">
<div className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1 shadow-sm">
<span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                Nouvelle Vente Rapide
              </div>
</div>
<div className="px-3 pb-2">
<div className="bg-primary/5 p-3 rounded-xl border border-primary/15 flex justify-between items-center">
<div>
<span className="text-[10px] uppercase text-outline font-semibold">Ventes du jour</span>
<p className="font-bold text-sm text-primary">148 500 FCFA</p>
</div>
<span className="text-[11px] bg-white px-2 py-0.5 rounded text-emerald-700 font-bold border border-emerald-200">32 tickets</span>
</div>
</div>
<div className="px-3 flex-1 overflow-y-auto space-y-2">
<span className="text-[11px] font-bold text-on-surface-variant uppercase">Articles fréquents</span>
<div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest border border-surface-container">
<div className="flex items-center gap-2">
<span className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-xs">🧴</span>
<div>
<p className="text-xs font-bold text-on-surface">Savon Geisha</p>
<p className="text-[10px] text-outline font-medium">Stock: 45</p>
</div>
</div>
<span className="text-xs font-bold text-primary">600 F</span>
</div>
<div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest border border-surface-container">
<div className="flex items-center gap-2">
<span className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-xs">🍚</span>
<div>
<p className="text-xs font-bold text-on-surface">Riz 5kg</p>
<p className="text-[10px] text-amber-700 font-semibold">Stock: 2</p>
</div>
</div>
<span className="text-xs font-bold text-primary">4 500 F</span>
</div>
</div>
<div className="mt-auto px-4 py-2.5 bg-surface-container-lowest border-t border-surface-container flex justify-around text-outline">
<span className="material-symbols-outlined text-primary text-lg">home</span>
<span className="material-symbols-outlined text-lg">receipt</span>
<span className="material-symbols-outlined text-lg">inventory_2</span>
<span className="material-symbols-outlined text-lg">person</span>
</div>
</div>
</div>
</div>
</div>
</section>

{/* 7. COMMENT ÇA MARCHE */}
<section id="how-it-works" className="w-full py-20 px-4 md:px-8 bg-surface-container-low/40">
<div className="max-w-6xl mx-auto text-center">
<span className="text-xs text-primary font-bold uppercase tracking-wider">Démarrage express</span>
<h2 className="text-3xl font-extrabold text-on-surface mt-2 mb-4">Commencez en quelques minutes.</h2>
<p className="max-w-2xl mx-auto text-base text-on-surface-variant mb-16 font-medium">Pas besoin de formation longue ni de matériel informatique coûteux. Un simple téléphone ou ordinateur suffit.</p>
<div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
<div className="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-outline-variant/40 -translate-y-8 z-0"></div>
<div className="relative z-10 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col items-center text-center">
<div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-xl shadow-md mb-6">1</div>
<h3 className="text-xl font-bold text-on-surface mb-2">Créez votre compte</h3>
<p className="text-sm text-on-surface-variant font-medium">Inscrivez-vous gratuitement avec votre numéro de téléphone et configurez le nom de votre boutique en 60 secondes.</p>
</div>
<div className="relative z-10 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col items-center text-center">
<div className="w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-extrabold text-xl shadow-md mb-6">2</div>
<h3 className="text-xl font-bold text-on-surface mb-2">Ajoutez vos produits</h3>
<p className="text-sm text-on-surface-variant font-medium">Enregistrez vos premiers articles, fixez vos prix de vente en FCFA et renseignez vos quantités de stock initiales.</p>
</div>
<div className="relative z-10 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col items-center text-center">
<div className="w-14 h-14 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center font-extrabold text-xl shadow-md mb-6">3</div>
<h3 className="text-xl font-bold text-on-surface mb-2">Commencez à vendre</h3>
<p className="text-sm text-on-surface-variant font-medium">Enregistrez vos premiers encaissements au comptoir et laissez MaBoutiquePro calculer vos bénéfices réels.</p>
</div>
</div>
</div>
</section>

{/* 11. TARIFICATION */}
<section className="w-full py-20 px-4 md:px-8 bg-surface-container-low/40" id="tarifs">
<div className="max-w-7xl mx-auto">
<div className="text-center max-w-2xl mx-auto mb-10">
<span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider mb-3">
  🎁 14 JOURS D&apos;ESSAI GRATUIT POUR TOUS
</span>
<h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mt-1 mb-3">
  Des formules simples et transparentes.
</h2>
<p className="text-base text-on-surface-variant font-medium">
  Commencez par 14 jours d&apos;essai 100% gratuit sans carte bancaire, puis choisissez la formule adaptée à votre activité.
</p>
</div>

{/* Toggle Mensuel / Annuel */}
<div className="flex items-center justify-center gap-4 mb-12">
  <span className={`text-sm font-bold transition-colors ${!isAnnual ? 'text-primary' : 'text-on-surface-variant'}`}>
    Facturation Mensuelle
  </span>
  <button
    type="button"
    onClick={() => setIsAnnual(!isAnnual)}
    className={`relative inline-flex h-8 w-15 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${isAnnual ? 'bg-primary' : 'bg-surface-container-high'}`}
  >
    <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isAnnual ? 'translate-x-7' : 'translate-x-0'}`} />
  </button>
  <span className={`text-sm font-bold flex items-center gap-2 transition-colors ${isAnnual ? 'text-primary' : 'text-on-surface-variant'}`}>
    Facturation Annuelle
    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[11px] font-extrabold uppercase border border-emerald-500/20">
      2 mois offerts
    </span>
  </span>
</div>

{/* Les 3 Colonnes : 1. Essai Gratuit (0 F) | 2. Pro (5 000 F) | 3. Business (15 000 F) */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
  
  {/* CARTE 1 : ESSAI DÉCOUVERTE 14 JOURS */}
  <div className="bg-surface-container-lowest p-8 rounded-3xl border-2 border-emerald-500/30 shadow-md hover:shadow-xl hover:border-emerald-500/60 transition-all duration-300 flex flex-col justify-between relative">
    <div>
      <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black uppercase tracking-wider w-fit mb-4">
        Étape 1 : Découverte
      </div>
      <h3 className="text-2xl font-extrabold text-on-surface mb-1">ESSAI GRATUIT</h3>
      <p className="text-xs text-on-surface-variant mb-6 font-medium">Testez l&apos;application dans votre magasin pendant 2 semaines sans engagement.</p>
      
      <div className="mb-6">
        <div className="text-4xl font-black text-on-surface">
          0 <span className="text-sm font-bold text-outline">FCFA / 14 jours</span>
        </div>
        <p className="text-xs text-emerald-700 font-bold mt-1 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">check</span>
          Aucune carte bancaire requise
        </p>
      </div>

      <ul className="space-y-3.5 text-sm text-on-surface mb-8 font-medium">
        <li className="flex items-center gap-2.5 font-bold text-emerald-700"><span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span> <b>14 jours d&apos;accès complet</b></li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Produits &amp; ventes illimités</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> <b>Mode Hors-ligne (PWA)</b> sans internet</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Tickets thermiques &amp; Factures A4</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Test de toutes les fonctions VIP</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Sans engagement • Arrêt libre</li>
      </ul>
    </div>

    <button 
      onClick={() => onLoginClick(true)} 
      className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border-2 border-emerald-500/40 text-emerald-800 font-extrabold text-base text-center hover:from-emerald-600 hover:to-teal-600 hover:text-white hover:border-emerald-600 shadow-md hover:shadow-xl hover:shadow-emerald-500/25 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer overflow-hidden"
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-emerald-600 text-xl group-hover:text-white transition-colors">rocket_launch</span>
        <span>Démarrer l&apos;essai 14 jours</span>
        <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
      </span>
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
    </button>
  </div>

  {/* CARTE 2 : PLAN PRO (5 000 F) - LE PLUS POPULAIRE */}
  <div className="bg-surface-container-lowest p-8 rounded-3xl border-2 border-indigo-600 shadow-2xl shadow-indigo-600/20 flex flex-col justify-between relative transform lg:-translate-y-2 hover:-translate-y-3 transition-all duration-300 ring-4 ring-indigo-600/10">
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 whitespace-nowrap">
      <span className="material-symbols-outlined text-yellow-300 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
      <span>⭐ Recommandé • Commerçant indépendant</span>
    </div>
    <div>
      <div className="inline-block px-3.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black uppercase tracking-wider w-fit mb-4 mt-2">
        Boutique Individuelle
      </div>
      <h3 className="text-2xl font-extrabold text-on-surface mb-1">PRO</h3>
      <p className="text-xs text-on-surface-variant mb-6 font-medium">Pour commerçants indépendants gérant seuls leur point de vente.</p>
      
      <div className="mb-6">
        <div className="text-4xl font-black text-indigo-600">
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
        <li className="flex items-center gap-2.5 font-bold"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> 1 Boutique &amp; Gestion complète</li>
        <li className="flex items-center gap-2.5 font-semibold"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> <b>Sessions de Caisse (Ouverture, Espèces &amp; Rapport Z)</b></li>
        <li className="flex items-center gap-2.5 font-semibold"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> <b>Carnet de Crédit &amp; Dettes clients (Relances WhatsApp)</b></li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> Produits et ventes illimités</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> <b>Mode Hors-ligne (PWA)</b> même sans internet</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> Reçus thermiques 80mm &amp; Factures A4 (TVA 0% &amp; TTC)</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> Suivi des charges &amp; Bénéfice Net réel</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-indigo-600 text-lg">check_circle</span> Alertes stock automatiques &amp; Support WhatsApp</li>
      </ul>
    </div>

    <button 
      onClick={() => onLoginClick(true)} 
      className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white font-black text-base text-center shadow-xl shadow-indigo-600/40 hover:shadow-2xl hover:shadow-indigo-600/60 hover:from-indigo-500 hover:to-violet-600 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden cursor-pointer"
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-yellow-300 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
        <span>Choisir Pro après l&apos;essai</span>
        <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
      </span>
    </button>
  </div>

  {/* CARTE 3 : PLAN BUSINESS (15 000 F) */}
  <div className="bg-surface-container-lowest p-8 rounded-3xl border-2 border-purple-500/50 shadow-xl shadow-purple-500/10 hover:border-purple-600 hover:shadow-2xl hover:shadow-purple-500/20 flex flex-col justify-between relative transition-all duration-300">
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-700 to-fuchsia-700 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-purple-700/30 flex items-center gap-1.5 whitespace-nowrap">
      <span className="material-symbols-outlined text-amber-300 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
      <span>💎 Le plus complet • Équipe &amp; Multi-Boutiques</span>
    </div>
    <div>
      <div className="inline-block px-3.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-black uppercase tracking-wider w-fit mb-4 mt-2">
        Multi-Caisses &amp; Équipe
      </div>
      <h3 className="text-2xl font-extrabold text-on-surface mb-1">BUSINESS</h3>
      <p className="text-xs text-on-surface-variant mb-6 font-medium">Pour commerces avec caissiers, employés ou plusieurs points de vente.</p>
      
      <div className="mb-6">
        <div className="text-4xl font-black text-purple-700">
          {isAnnual ? "150 000" : "15 000"}{" "}
          <span className="text-sm font-bold text-outline">FCFA / {isAnnual ? "an" : "mois"}</span>
        </div>
        {isAnnual ? (
          <p className="text-xs text-emerald-700 font-bold mt-1">Soit 12 500 FCFA / mois (30 000 F d&apos;économie)</p>
        ) : (
          <p className="text-xs text-outline font-medium mt-1">Payable par Mobile Money chaque mois</p>
        )}
      </div>

      <ul className="space-y-3.5 text-sm text-on-surface mb-8 font-medium">
        <li className="flex items-center gap-2.5 font-bold text-purple-700"><span className="material-symbols-outlined text-purple-600 text-lg">verified</span> Toutes les fonctionnalités Pro incluses</li>
        <li className="flex items-center gap-2.5 font-bold"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> <b>Multi-Caissiers illimités avec accès restreints</b></li>
        <li className="flex items-center gap-2.5 font-bold"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> <b>Multi-Boutiques (jusqu&apos;à 3 magasins indépendants)</b></li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Écran caissier sécurisé (bénéfices et marges masqués)</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Clôtures de caisse certifiées &amp; Détection des écarts</li>
        <li className="flex items-center gap-2.5"><span className="material-symbols-outlined text-purple-600 text-lg">check_circle</span> Supervision à distance en temps réel sur mobile</li>
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
<div className="mt-14 text-center text-xs text-on-surface-variant font-medium flex flex-wrap items-center justify-center gap-6 p-4 rounded-2xl bg-surface-container-low/70 border border-outline-variant/30 max-w-3xl mx-auto shadow-xs">
  <span className="flex items-center gap-2 font-bold text-on-surface">
    <span className="material-symbols-outlined text-indigo-600 text-lg">verified_user</span>
    Paiement 100% sécurisé via Moneriz (T-Money, Moov, Wave, Orange Money, Carte Bancaire)
  </span>
  <span className="flex items-center gap-1.5 font-bold text-emerald-700">
    <span className="material-symbols-outlined text-emerald-600 text-lg">lock</span>
    Sans engagement • Annulation libre en 1 clic
  </span>
</div>

</div>
</section>

{/* 12. FAQ */}
<section id="faq-accordion" className="w-full py-20 px-4 md:px-8 bg-surface">
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-16">
      <span className="text-xs text-primary font-bold uppercase tracking-wider">Foire aux questions</span>
      <h2 className="text-3xl font-extrabold text-on-surface mt-2 mb-4">Questions fréquentes</h2>
      <p className="text-base text-on-surface-variant font-medium">Tout ce que vous devez savoir sur MaBoutiquePro.</p>
    </div>
    <div className="space-y-4">
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Combien de temps dure l&apos;essai gratuit et comment ça marche ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          Vous bénéficiez de <b>14 jours complets (2 semaines) d&apos;essai gratuit</b> avec un accès total à l&apos;application dès votre inscription, sans carte bancaire requise. Vous pouvez enregistrer vos produits, encaisser vos clients et tester la caisse. À la fin des 14 jours, vous choisissez simplement votre formule (Pro à 5 000 FCFA ou Business à 15 000 FCFA) pour continuer.
        </div>
      </details>
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Faut-il obligatoirement une connexion internet pour vendre ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          <b>Non, pas en permanence !</b> Grâce à notre mode Hors-ligne (PWA), votre caisse continue de fonctionner même en cas de coupure internet. Vous pouvez encaisser vos clients et imprimer vos tickets. Dès que votre connexion se rétablit, toutes vos ventes sont automatiquement sauvegardées et synchronisées sur le cloud.
        </div>
      </details>
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Puis-je créer des comptes pour mes caissiers et employés ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          <b>Oui, absolument !</b> Avec la formule Business, vous pouvez créer des accès sécurisés pour chacun de vos caissiers. Chaque caissier ne peut accéder qu&apos;à la caisse de sa propre boutique et ne peut en aucun cas voir vos prix d&apos;achat, vos marges bénéficiaires ou les autres boutiques. Vous disposez aussi des clôtures de caisse (Rapports X et Z) avec décompte d&apos;espèces.
        </div>
      </details>
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Comment fonctionne le carnet de crédit et dettes clients ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          Vous pouvez autoriser des ventes à crédit en 1 clic au moment de l&apos;encaissement, avec ou sans acompte initial. Le <b>Carnet de Dettes</b> suit en temps réel le solde dû pour chaque client, enregistre les remboursements partiels ou totaux, et vous permet d&apos;envoyer une relance courtoise <b>directement sur WhatsApp en 1 clic</b> avec le détail du montant restant dû.
        </div>
      </details>
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Comment s&apos;effectue le règlement de l&apos;abonnement ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          Le paiement s&apos;effectue directement en monnaie locale via <b>Mobile Money</b> (MTN Mobile Money, Moov Money, Orange Money, Wave) ou par carte bancaire. Aucun prélèvement automatique surprise n&apos;est effectué sans votre accord.
        </div>
      </details>
    </div>
  </div>
</section>

{/* 13. GRAND CTA FINAL */}
<section className="w-full py-24 px-4 md:px-8 bg-gradient-to-br from-primary via-primary-container to-inverse-surface text-on-primary relative overflow-hidden">
<div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-tertiary-fixed/10 blur-3xl pointer-events-none"></div>
<div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
<div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
<div className="w-16 h-16 rounded-2xl bg-surface-container-lowest/15 flex items-center justify-center mb-8 backdrop-blur-md">
<span className="material-symbols-outlined text-tertiary-fixed text-3xl">storefront</span>
</div>
<h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6">
        Passez à une gestion plus simple de votre boutique.
      </h2>
<p className="max-w-2xl text-lg text-on-primary/90 mb-10 leading-relaxed font-medium">
        Rejoignez dès aujourd&apos;hui les commerçants qui modernisent leur activité, sécurisent leurs encaissements et développent leur chiffre d&apos;affaires en toute sérénité.
      </p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-8">
<button onClick={() => onLoginClick(true)} className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-white text-indigo-700 font-black text-lg hover:bg-white/95 active:scale-[0.98] transition-all duration-300 shadow-2xl shadow-black/25 relative overflow-hidden cursor-pointer">
<span className="relative z-10 flex items-center gap-2">
<span>Démarrer vos 14 jours gratuits</span>
<span className="material-symbols-outlined text-2xl transition-transform duration-300 group-hover:translate-x-1.5">arrow_forward</span>
</span>
<span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-indigo-100/60 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
</button>
</div>
<p className="text-sm text-tertiary-fixed font-bold tracking-wide">
        Simple. Moderne. Pensé pour les commerçants.
      </p>
</div>
</section>
</div></main><footer className="w-full bg-inverse-surface text-inverse-on-surface"><div className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-20 sm:pb-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-10 border-b border-on-surface-variant/20"><div className="lg:col-span-2 flex flex-col gap-4"><div className="flex items-center gap-2"><span className="text-xl font-bold text-inverse-on-surface tracking-tight">MaBoutiquePro</span></div><p className="text-sm text-inverse-on-surface/80 max-w-sm font-medium">Le système d&apos;exploitation commercial nouvelle génération pensé pour les commerçants modernes d'Afrique. Gestion des stocks, caisse tactile et réconciliations instantanées.</p></div><div className="flex flex-col gap-2"><h4 className="font-bold text-base text-inverse-on-surface">Produit</h4><ul className="flex flex-col gap-1 text-sm text-inverse-on-surface/75 font-medium"><li><a className="hover:text-inverse-primary transition-colors" href="#">Fonctionnalités</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Tableau de bord</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Gestion des stocks</a></li></ul></div><div className="flex flex-col gap-2"><h4 className="font-bold text-base text-inverse-on-surface">Entreprise</h4><ul className="flex flex-col gap-1 text-sm text-inverse-on-surface/75 font-medium"><li><a className="hover:text-inverse-primary transition-colors" href="#">À propos</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Contact</a></li></ul></div><div className="flex flex-col gap-2"><h4 className="font-bold text-base text-inverse-on-surface">Légal</h4><ul className="flex flex-col gap-1 text-sm text-inverse-on-surface/75 font-medium"><li><a className="hover:text-inverse-primary transition-colors" href="#">Conditions d&apos;utilisation</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Politique de confidentialité</a></li></ul></div></div><div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"><p className="text-xs text-inverse-on-surface/60 font-medium">© 2026 MaBoutiquePro. Tous droits réservés.</p><div className="flex items-center gap-1 text-tertiary-fixed font-bold text-sm"><span className="material-symbols-outlined text-[18px]">favorite</span><span>Fait avec fierté pour les entrepreneurs africains.</span></div></div></div></footer>
      {/* Barre WhatsApp Sticky en bas (Mobile) — remplace l'ancien bouton Démarrer */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container shadow-2xl flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-on-surface truncate">Besoin d&apos;aide ou d&apos;informations ?</p>
          <p className="text-[10px] text-emerald-700 font-semibold truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Assistance WhatsApp en direct
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
          <span>WhatsApp (+228)</span>
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