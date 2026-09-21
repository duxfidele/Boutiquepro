import React, { useState } from 'react';

interface LandingPageProps {
  onLoginClick: (isSignUp: boolean) => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="bg-surface font-sans text-on-surface antialiased">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container"><div className="h-20 max-w-7xl mx-auto px-margin-mobile md:px-margin flex items-center justify-between"><div className="flex items-center gap-space-sm"><img alt="BoutiquePro Logo" className="h-8 w-auto object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkwJcy-N76VP1yekSGQpP8jSEU8FTJG_iuVLi4LY-f4uAiDpV6HF-gutXQ_EWly0hpQQAL89wwgpO7O0SvS2u4PWN9UnlE1KOt3nd2tOXRYHF17O67h7NZiSdkXsSh3xTvQoC5NJHW8qG8mOX8lQupDHD21gmJYBgKrVe0NLJVxa_5SQFzn-KRHg4qZOKBrKmhQHHQpciyfQ3Meenut-jhBSZlTgqKidW77JEaNRI"/><span className="font-headline-sm text-lg sm:text-headline-sm text-on-surface tracking-tight font-bold">BoutiquePro</span></div><nav className="hidden lg:flex items-center gap-space-lg"><a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#features">Fonctionnalités</a><a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#how-it-works">Comment ça marche</a><a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#tarifs">Tarifs</a><a className="font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors font-medium" href="#faq-accordion">FAQ</a></nav><div className="flex items-center gap-2 sm:gap-space-md">
<button className="lg:hidden text-on-surface p-2 flex items-center justify-center" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span></button>
<button onClick={() => onLoginClick(false)} className="font-title-md text-title-md text-on-surface-variant hover:text-on-surface transition-colors hidden sm:inline-flex font-semibold mr-4">Se connecter</button><button onClick={() => onLoginClick(true)} className="inline-flex items-center justify-center px-4 sm:px-6 py-2 rounded-xl bg-primary text-on-primary font-title-md text-sm sm:text-base hover:bg-primary-container active:scale-[0.98] transition-all shadow-sm font-semibold whitespace-nowrap"><span className="hidden sm:inline">Commencer gratuitement</span><span className="sm:hidden">Démarrer</span></button></div></div>
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
</header><main className="w-full pt-20 bg-surface"><div className="flex flex-col w-full overflow-hidden">
{/* 1. HERO SECTION */}
<section className="relative w-full pt-20 pb-24 px-4 md:px-8 bg-gradient-to-b from-surface-container-low/40 via-surface to-surface flex flex-col items-center text-center">
<div className="absolute top-12 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
<div className="absolute top-48 left-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-2xl pointer-events-none -z-10"></div>
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant/30 text-primary font-title-md text-sm shadow-sm mb-6 transition-all hover:bg-surface-container-high cursor-default">
<span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
<span className="font-medium">✨ La gestion de boutique, enfin simplifiée.</span>
</div>
<h1 className="max-w-5xl font-display-hero text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-6">
      Gérez votre boutique. Suivez vos ventes.<br className="hidden md:inline"/>
<span className="bg-gradient-to-r from-primary via-primary-container to-tertiary bg-clip-text text-transparent">Développez votre activité.</span>
</h1>
<p className="max-w-2xl text-lg text-on-surface-variant mb-10 leading-relaxed font-medium">
      La solution tout-en-un conçue pour les commerçants africains. Centralisez vos produits, gérez vos stocks en temps réel, enregistrez vos ventes et suivez vos bénéfices en FCFA en toute sérénité.
    </p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4 w-full sm:w-auto">
<button onClick={() => onLoginClick(true)} className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-primary text-on-primary font-title-md text-base hover:bg-primary-container active:scale-[0.98] transition-all shadow-md shadow-primary/20 font-bold">
<span>Commencer gratuitement</span>
<span className="material-symbols-outlined text-xl">arrow_forward</span>
</button>
<a className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-surface-container-lowest text-on-surface font-title-md text-base border border-outline-variant/40 hover:bg-surface-container-low active:scale-[0.98] transition-all shadow-sm font-semibold" href="#mockup">
<span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
<span>Découvrir BoutiquePro</span>
</a>
</div>
<p className="text-sm text-outline flex items-center justify-center gap-2 mb-16 flex-wrap font-medium">
<span>Sans carte bancaire</span>
<span>•</span>
<span>Configuration en 2 minutes</span>
<span>•</span>
<span className="font-bold text-primary">100% adapté à l&apos;Afrique (FCFA)</span>
</p>
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
              app.boutiquepro.africa
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
<span>BoutiquePro rassemble tout au même endroit avec une simplicité déconcertante.</span>
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
<span className="text-xs font-bold text-on-surface">BoutiquePro Mobile</span>
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
<p className="text-sm text-on-surface-variant font-medium">Enregistrez vos premiers encaissements au comptoir et laissez BoutiquePro calculer vos bénéfices réels.</p>
</div>
</div>
</div>
</section>

{/* 11. TARIFICATION */}
<section className="w-full py-20 px-4 md:px-8 bg-surface-container-low/40" id="tarifs">
<div className="max-w-6xl mx-auto">
<div className="text-center max-w-2xl mx-auto mb-16">
<span className="text-xs text-primary font-bold uppercase tracking-wider">Tarification juste</span>
<h2 className="text-3xl font-extrabold text-on-surface mt-2 mb-3">Un abonnement adapté à votre activité.</h2>
<p className="text-base text-on-surface-variant font-medium">Des tarifs transparents, sans frais cachés, payables en monnaie locale.</p>
</div>
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
<div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
<div>
<span className="text-xs font-bold text-outline uppercase tracking-wider">Démarrage</span>
<h3 className="text-2xl font-extrabold text-on-surface mt-1 mb-2">GRATUIT</h3>
<p className="text-xs text-on-surface-variant mb-6 font-medium">Idéal pour tester et démarrer votre boutique en toute sérénité.</p>
<div className="text-3xl font-extrabold text-on-surface mb-6">
              0 <span className="text-sm font-semibold text-outline">FCFA / mois</span>
</div>
<ul className="space-y-3 text-sm text-on-surface-variant mb-8 font-medium">
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Jusqu&apos;à 50 produits</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Ventes et tickets illimités</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Tableau de bord essentiel</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Reçus WhatsApp</li>
<li className="flex items-center gap-2 text-outline"><span className="material-symbols-outlined text-base">remove</span> Suivi multi-utilisateurs</li>
</ul>
</div>
<button onClick={() => onLoginClick(true)} className="w-full py-3 rounded-xl bg-surface-container text-on-surface font-bold text-base text-center hover:bg-surface-container-high transition-all">
            Commencer gratuitement
          </button>
</div>
<div className="bg-surface-container-lowest p-8 rounded-2xl border-2 border-primary shadow-xl flex flex-col justify-between relative transform lg:-translate-y-2">
<div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider shadow-sm">
            ⭐ Le plus populaire
          </div>
<div>
<span className="text-xs font-bold text-primary uppercase tracking-wider">Croissance</span>
<h3 className="text-2xl font-extrabold text-on-surface mt-1 mb-2">PRO</h3>
<p className="text-xs text-on-surface-variant mb-6 font-medium">Pour les commerçants établis voulant un contrôle sans faille.</p>
<div className="text-3xl font-extrabold text-primary mb-6">
              5 000 <span className="text-sm font-semibold text-outline">FCFA / mois</span>
</div>
<ul className="space-y-3 text-sm text-on-surface mb-8 font-medium">
<li className="flex items-center gap-2 font-bold"><span className="material-symbols-outlined text-primary text-base">check_circle</span> Produits illimités</li>
<li className="flex items-center gap-2 font-bold"><span className="material-symbols-outlined text-primary text-base">check_circle</span> Alertes de stock automatiques</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Carnet de crédit &amp; dettes clients</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Suivi des charges &amp; dépenses</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Rapports PDF &amp; Excel</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Support WhatsApp prioritaire</li>
</ul>
</div>
<button onClick={() => onLoginClick(true)} className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-base text-center hover:bg-primary-container shadow-md shadow-primary/20 transition-all">
            Commencer avec Pro
          </button>
</div>
<div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
<div>
<span className="text-xs font-bold text-secondary uppercase tracking-wider">Multi-Boutiques</span>
<h3 className="text-2xl font-extrabold text-on-surface mt-1 mb-2">BUSINESS</h3>
<p className="text-xs text-on-surface-variant mb-6 font-medium">Pour entreprises commerciales et boutiques à plusieurs caisses.</p>
<div className="text-3xl font-extrabold text-on-surface mb-6">
              15 000 <span className="text-sm font-semibold text-outline">FCFA / mois</span>
</div>
<ul className="space-y-3 text-sm text-on-surface-variant mb-8 font-medium">
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary text-base">check</span> Toutes les fonctionnalités Pro</li>
<li className="flex items-center gap-2 font-bold"><span className="material-symbols-outlined text-secondary text-base">check</span> Multi-utilisateurs (Caissiers)</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary text-base">check</span> Gestion multi-points de vente</li>
<li className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary text-base">check</span> Statistiques avancées de marges</li>
</ul>
</div>
<button onClick={() => onLoginClick(true)} className="w-full py-3 rounded-xl bg-surface-container text-on-surface font-bold text-base text-center hover:bg-surface-container-high transition-all">
            Choisir Business
          </button>
</div>
</div>
</div>
</section>


{/* 12. FAQ */}
<section id="faq-accordion" className="w-full py-20 px-4 md:px-8 bg-surface">
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-16">
      <span className="text-xs text-primary font-bold uppercase tracking-wider">Foire aux questions</span>
      <h2 className="text-3xl font-extrabold text-on-surface mt-2 mb-4">Questions fréquentes</h2>
      <p className="text-base text-on-surface-variant font-medium">Tout ce que vous devez savoir sur BoutiquePro.</p>
    </div>
    <div className="space-y-4">
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Faut-il une connexion internet pour utiliser BoutiquePro ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          Oui, l&apos;application nécessite une connexion internet. C&apos;est ce qui nous permet de synchroniser vos données en temps réel sur le cloud et de garantir qu&apos;aucune vente ne soit perdue si votre appareil tombe en panne.
        </div>
      </details>
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Est-ce que je peux l&apos;utiliser sur mon téléphone mobile ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          Absolument ! L&apos;interface de BoutiquePro a été spécialement conçue pour s&apos;adapter parfaitement à l&apos;écran de votre smartphone. Vous pouvez gérer votre boutique de n&apos;importe où.
        </div>
      </details>
      <details className="group bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden open:ring-2 open:ring-primary/20">
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-on-surface hover:text-primary transition-colors">
          <span>Puis-je créer des comptes pour mes employés ou caissiers ?</span>
          <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div className="p-6 pt-0 text-on-surface-variant font-medium">
          Pour le moment, l&apos;application est configurée pour un seul propriétaire par compte pour une simplicité maximale. La gestion multi-utilisateurs avec des droits restreints pour les caissiers est une fonctionnalité qui sera ajoutée très bientôt !
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
<button onClick={() => onLoginClick(true)} className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-surface-container-lowest text-primary font-bold text-base hover:bg-surface-bright active:scale-[0.98] transition-all shadow-xl">
<span>Commencer gratuitement</span>
<span className="material-symbols-outlined text-xl">arrow_forward</span>
</button>
</div>
<p className="text-sm text-tertiary-fixed font-bold tracking-wide">
        Simple. Moderne. Pensé pour les commerçants.
      </p>
</div>
</section>
</div></main><footer className="w-full bg-inverse-surface text-inverse-on-surface"><div className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-10 border-b border-on-surface-variant/20"><div className="lg:col-span-2 flex flex-col gap-4"><div className="flex items-center gap-2"><span className="text-xl font-bold text-inverse-on-surface tracking-tight">BoutiquePro</span></div><p className="text-sm text-inverse-on-surface/80 max-w-sm font-medium">Le système d&apos;exploitation commercial nouvelle génération pensé pour les commerçants modernes d'Afrique. Gestion des stocks, caisse tactile et réconciliations instantanées.</p></div><div className="flex flex-col gap-2"><h4 className="font-bold text-base text-inverse-on-surface">Produit</h4><ul className="flex flex-col gap-1 text-sm text-inverse-on-surface/75 font-medium"><li><a className="hover:text-inverse-primary transition-colors" href="#">Fonctionnalités</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Tableau de bord</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Gestion des stocks</a></li></ul></div><div className="flex flex-col gap-2"><h4 className="font-bold text-base text-inverse-on-surface">Entreprise</h4><ul className="flex flex-col gap-1 text-sm text-inverse-on-surface/75 font-medium"><li><a className="hover:text-inverse-primary transition-colors" href="#">À propos</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Contact</a></li></ul></div><div className="flex flex-col gap-2"><h4 className="font-bold text-base text-inverse-on-surface">Légal</h4><ul className="flex flex-col gap-1 text-sm text-inverse-on-surface/75 font-medium"><li><a className="hover:text-inverse-primary transition-colors" href="#">Conditions d&apos;utilisation</a></li><li><a className="hover:text-inverse-primary transition-colors" href="#">Politique de confidentialité</a></li></ul></div></div><div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"><p className="text-xs text-inverse-on-surface/60 font-medium">© 2024 BoutiquePro Technologies. Tous droits réservés.</p><div className="flex items-center gap-1 text-tertiary-fixed font-bold text-sm"><span className="material-symbols-outlined text-[18px]">favorite</span><span>Fait avec fierté pour les entrepreneurs africains.</span></div></div></div></footer>
    </div>
  );
}
