import React, { useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Rocket,
  Zap,
  Crown,
  Star,
  ShieldCheck,
  Lock,
  Store,
  Package,
  BookOpen,
  Receipt,
  TrendingUp,
  CreditCard,
  Sparkles,
  HelpCircle,
  LogIn,
  Menu,
  X,
  Heart,
  LayoutDashboard,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Wallet,
  ArrowUpRight,
} from "lucide-react";

interface LandingPageProps {
  onLoginClick: (isSignUp: boolean) => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[#060517] font-sans text-white antialiased selection:bg-purple-500/30 selection:text-purple-200 overflow-x-hidden relative">
      {/* ================================================================ */}
      {/* FAISCEAUX LUMINEUX COSMIQUES D'ARRIÈRE-PLAN (STYLE NEXORA)       */}
      {/* ================================================================ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Halo central supérieur violet/indigo */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-indigo-600/25 via-purple-600/15 to-transparent rounded-full blur-[130px]" />
        {/* Faisceau diagonal bleu électrique à gauche */}
        <div className="absolute top-[280px] -left-40 w-[700px] h-[320px] bg-gradient-to-r from-blue-600/30 via-cyan-500/15 to-transparent rotate-[-28deg] blur-[100px]" />
        <div className="absolute top-[520px] -left-20 w-[600px] h-[120px] bg-gradient-to-r from-blue-500/40 via-indigo-500/20 to-transparent rotate-[-25deg] blur-[60px]" />
        {/* Faisceau diagonal magenta/violet à droite */}
        <div className="absolute top-[260px] -right-40 w-[750px] h-[340px] bg-gradient-to-l from-fuchsia-600/30 via-purple-600/20 to-transparent rotate-[28deg] blur-[100px]" />
        <div className="absolute top-[480px] -right-20 w-[650px] h-[110px] bg-gradient-to-l from-pink-500/40 via-fuchsia-500/25 to-transparent rotate-[25deg] blur-[55px]" />
      </div>

      {/* ================================================================ */}
      {/* HEADER / NAVIGATION                                              */}
      {/* ================================================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#060517]/80 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="h-16 sm:h-20 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between gap-3">
          {/* Logo à gauche */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden flex items-center justify-center p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Menu de navigation"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-purple-400" />
              ) : (
                <Menu className="w-5 h-5 text-purple-400" />
              )}
            </button>

            <a href="#" className="flex items-center gap-2.5 min-w-0 group">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-lg shadow-purple-500/25 shrink-0">
                <div className="w-full h-full bg-[#0b0924] rounded-[11px] flex items-center justify-center overflow-hidden">
                  <img alt="MaBoutiquePro Logo" className="h-6 sm:h-7 w-auto object-contain" src="/logo.png" />
                </div>
              </div>
              <span className="text-base sm:text-xl font-extrabold tracking-tight text-white truncate">
                MaBoutiquePro
              </span>
            </a>
          </div>

          {/* Liens de navigation au centre */}
          <nav className="hidden lg:flex items-center gap-8">
            <a
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1"
              href="#features"
            >
              <span>Fonctionnalités</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <a
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1"
              href="#avantages"
            >
              <span>Solutions</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <a
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              href="#tarifs"
            >
              Tarifs
            </a>
            <a
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1"
              href="#faq"
            >
              <span>Ressources</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </nav>

          {/* Actions à droite */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <button
              onClick={() => onLoginClick(false)}
              className="text-sm font-semibold text-slate-200 hover:text-white transition-colors hidden sm:inline-flex px-2 py-1.5 cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={() => onLoginClick(true)}
              className="relative inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white text-xs sm:text-sm font-bold shadow-[0_0_25px_rgba(139,92,246,0.5)] hover:shadow-[0_0_35px_rgba(168,85,247,0.75)] hover:brightness-110 active:scale-[0.98] transition-all duration-300 cursor-pointer"
            >
              Essai Gratuit
            </button>
          </div>
        </div>

        {/* Menu Mobile Déroulant */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#0c0a24]/98 backdrop-blur-2xl border-b border-white/10 shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
            <a
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-slate-200 hover:text-purple-400 transition-colors font-semibold flex items-center gap-3"
              href="#features"
            >
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              Fonctionnalités
            </a>
            <a
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-slate-200 hover:text-purple-400 transition-colors font-semibold flex items-center gap-3"
              href="#tarifs"
            >
              <CreditCard className="w-5 h-5 text-purple-400 shrink-0" />
              Tarifs d&apos;abonnement
            </a>
            <a
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-slate-200 hover:text-purple-400 transition-colors font-semibold flex items-center gap-3"
              href="#faq"
            >
              <HelpCircle className="w-5 h-5 text-purple-400 shrink-0" />
              Questions fréquentes
            </a>
            <div className="w-full h-px bg-white/10 my-1" />
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLoginClick(false);
              }}
              className="text-base text-white hover:text-purple-400 transition-colors font-bold text-left flex items-center gap-3 py-1"
            >
              <LogIn className="w-5 h-5 text-purple-400 shrink-0" />
              Se connecter à ma boutique
            </button>
          </div>
        )}
      </header>

      <main className="relative z-10 w-full pt-20 sm:pt-24">
        {/* ================================================================ */}
        {/* 1. HERO SECTION (STYLE NEXORA AVEC DASHBOARD & CARTES FLOTTANTES)*/}
        {/* ================================================================ */}
        <section className="relative w-full pt-8 sm:pt-14 pb-16 sm:pb-24 px-4 sm:px-6 md:px-8 flex flex-col items-center text-center">
          {/* Badge Pilule Supérieur */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/15 text-slate-200 text-xs sm:text-sm backdrop-blur-md shadow-[0_0_20px_rgba(139,92,246,0.2)] mb-6">
            <span>🚀</span>
            <span className="font-medium">La plateforme tout-en-un pour la croissance de votre commerce</span>
          </div>

          {/* Grand Titre sur 2 lignes style Nexora */}
          <h1 className="max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-5 sm:mb-6 leading-[1.1]">
            <span className="block">Vendez plus vite.</span>
            <span className="block mt-1">
              Grandissez{" "}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                sereinement.
              </span>
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="max-w-2xl text-sm sm:text-lg text-slate-300/90 mb-8 sm:mb-10 leading-relaxed font-normal">
            MaBoutiquePro aide les commerçants à automatiser la caisse, contrôler les stocks en temps réel, suivre les créances clients et piloter leurs bénéfices en FCFA sur une seule plateforme intelligente.
          </p>

          {/* Boutons CTA (Style exact Nexora : Pilule dégradée avec rond blanc + bouton secondaire) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full max-w-md sm:max-w-none mb-12 sm:mb-16">
            <button
              onClick={() => onLoginClick(true)}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 pl-6 pr-3 py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white text-sm sm:text-base font-bold shadow-[0_0_35px_rgba(139,92,246,0.55)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] hover:brightness-110 active:scale-[0.98] transition-all duration-300 cursor-pointer"
            >
              <span>Essai Gratuit 14 Jours</span>
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-purple-700 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 shadow-sm">
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </span>
            </button>

            <a
              href="#tarifs"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 text-sm sm:text-base font-semibold text-slate-200 hover:text-white transition-colors group"
            >
              <span>Voir les Tarifs</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* ============================================================== */}
          {/* MAQUETTE INTERACTIVE DU DASHBOARD + 3 CARTES FLOTTANTES        */}
          {/* ============================================================== */}
          <div className="relative w-full max-w-5xl mx-auto">
            {/* Lueur intense derrière le dashboard */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/30 via-purple-600/35 to-pink-600/30 rounded-[36px] blur-2xl opacity-80 pointer-events-none" />

            {/* CARTE FLOTTANTE GAUCHE (Desktop) : Recettes du Jour */}
            <div className="hidden lg:block absolute -left-16 xl:-left-24 top-1/2 -translate-y-1/2 z-20 w-56 p-4 rounded-2xl bg-[#110e2e]/85 backdrop-blur-2xl border border-blue-400/30 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(59,130,246,0.25)] text-left transform -rotate-2 hover:rotate-0 transition-transform duration-500">
              <p className="text-xs font-medium text-slate-300 mb-1">CA du Jour</p>
              <p className="text-2xl font-extrabold text-white tracking-tight mb-1">245 600 F</p>
              <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-3">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+14.5% vs hier</span>
              </p>
              {/* Mini Courbe SVG */}
              <svg className="w-full h-10 overflow-visible" viewBox="0 0 180 45">
                <defs>
                  <linearGradient id="leftWave" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,35 Q25,20 45,28 T90,18 T135,24 T180,6 L180,45 L0,45 Z"
                  fill="url(#leftWave)"
                />
                <path
                  d="M0,35 Q25,20 45,28 T90,18 T135,24 T180,6"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* CARTE FLOTTANTE HAUT-DROITE (Desktop) : Produits & Stocks */}
            <div className="hidden lg:block absolute -right-14 xl:-right-20 -top-6 z-20 w-56 p-4 rounded-2xl bg-[#141036]/85 backdrop-blur-2xl border border-purple-400/30 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(168,85,247,0.25)] text-left transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <p className="text-xs font-medium text-slate-300 mb-1">Articles en Stock</p>
              <p className="text-2xl font-extrabold text-white tracking-tight mb-1">1 842</p>
              <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+18.6% ce mois</span>
              </p>
              <div className="flex items-end justify-between gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <svg className="w-28 h-8 overflow-visible" viewBox="0 0 120 35">
                  <path
                    d="M0,28 Q25,24 45,16 T85,20 T120,5"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* CARTE FLOTTANTE BAS-DROITE (Desktop) : Taux de Recouvrement */}
            <div className="hidden lg:block absolute -right-16 xl:-right-24 bottom-8 z-20 w-56 p-4 rounded-2xl bg-[#141036]/85 backdrop-blur-2xl border border-pink-400/30 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(236,72,153,0.25)] text-left transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <p className="text-xs font-medium text-slate-300 mb-1">Recouvrement Dettes</p>
              <p className="text-2xl font-extrabold text-white tracking-tight mb-1">96.4%</p>
              <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+8.2% via WhatsApp</span>
              </p>
              <div className="flex items-end justify-between gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-400/30 flex items-center justify-center text-pink-300 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <svg className="w-28 h-8 overflow-visible" viewBox="0 0 120 35">
                  <path
                    d="M0,26 Q30,14 55,22 T90,10 T120,6"
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* CADRE PRINCIPAL DU DASHBOARD MABOUTIQUEPRO */}
            <div className="relative z-10 rounded-2xl sm:rounded-3xl bg-[#0c0a22]/95 border border-white/15 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.85)] overflow-hidden text-left">
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] sm:min-h-[480px]">
                {/* Barre latérale du Dashboard Mockup */}
                <div className="hidden md:flex md:col-span-3 bg-[#09071a] border-r border-white/[0.07] p-5 flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-7 px-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-1">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                      </div>
                      <span className="font-bold text-sm text-white tracking-tight">MaBoutiquePro</span>
                    </div>

                    <div className="space-y-1.5 text-xs font-medium">
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white font-semibold shadow-md shadow-indigo-600/25">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Vue d&apos;ensemble</span>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors">
                        <ShoppingCart className="w-4 h-4" />
                        <span>Caisse Tactile (POS)</span>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors">
                        <Package className="w-4 h-4" />
                        <span>Stocks &amp; Produits</span>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors">
                        <BookOpen className="w-4 h-4" />
                        <span>Carnet de Dettes</span>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors">
                        <BarChart3 className="w-4 h-4" />
                        <span>Rapports &amp; Marges</span>
                      </div>
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors">
                        <Settings className="w-4 h-4" />
                        <span>Paramètres</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-400">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Caisse Ouverte • En ligne</span>
                    </div>
                    <span>Synchronisation temps réel</span>
                  </div>
                </div>

                {/* Zone centrale du Dashboard Mockup */}
                <div className="md:col-span-9 p-5 sm:p-7 flex flex-col justify-between bg-gradient-to-b from-[#100d2b] to-[#0b0920]">
                  {/* En-tête interne */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <span>Bonjour, Gérant</span>
                        <span>👋</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Voici le bilan en direct de votre boutique aujourd&apos;hui.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-slate-300 self-start sm:self-auto">
                      <span>Cette Semaine</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  {/* Graphique de Performance (Barres lumineuses dégradées style Nexora) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#151236]/70 border border-white/[0.08] mb-5">
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs sm:text-sm font-semibold text-white">
                        Aperçu des Ventes &amp; Recettes (FCFA)
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 text-[11px] text-slate-300 flex items-center gap-1">
                        <span>7 derniers jours</span>
                        <ChevronDown className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="flex items-end gap-3 sm:gap-5 h-36 sm:h-44 pt-4 px-1">
                      {/* Axe Y */}
                      <div className="hidden sm:flex flex-col justify-between h-full text-[10px] text-slate-500 font-medium pr-2 pb-5">
                        <span>500k</span>
                        <span>350k</span>
                        <span>200k</span>
                        <span>100k</span>
                      </div>

                      {/* Les 7 Barres Lun -> Dim */}
                      {[
                        { day: "Lun", h: "48%", from: "from-blue-400", to: "to-indigo-600" },
                        { day: "Mar", h: "64%", from: "from-blue-400", to: "to-indigo-600" },
                        { day: "Mer", h: "82%", from: "from-indigo-400", to: "to-purple-600" },
                        { day: "Jeu", h: "68%", from: "from-indigo-400", to: "to-purple-600" },
                        { day: "Ven", h: "96%", from: "from-purple-400", to: "to-fuchsia-600" },
                        { day: "Sam", h: "78%", from: "from-purple-400", to: "to-fuchsia-600" },
                        { day: "Dim", h: "56%", from: "from-fuchsia-400", to: "to-pink-600" },
                      ].map((bar) => (
                        <div key={bar.day} className="flex-1 flex flex-col items-center h-full justify-end group">
                          <div
                            style={{ height: bar.h }}
                            className={`w-full max-w-[28px] sm:max-w-[34px] rounded-t-xl rounded-b-md bg-gradient-to-b ${bar.from} ${bar.to} shadow-[0_0_20px_rgba(139,92,246,0.35)] group-hover:brightness-125 transition-all duration-300`}
                          />
                          <span className="text-[10px] sm:text-[11px] text-slate-400 mt-2 font-medium">
                            {bar.day}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3 Cartes KPI en bas du Dashboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="p-4 rounded-2xl bg-[#151236]/70 border border-white/[0.08]">
                      <p className="text-xs text-slate-400 mb-1">Chiffre d&apos;Affaires</p>
                      <p className="text-xl font-extrabold text-white mb-1">1 450 000 F</p>
                      <p className="text-[11px] font-semibold text-emerald-400 mb-2">
                        ↑ +12.5% vs sem. dernière
                      </p>
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#151236]/70 border border-white/[0.08]">
                      <p className="text-xs text-slate-400 mb-1">Ventes Encaissées</p>
                      <p className="text-xl font-extrabold text-white mb-1">842 tickets</p>
                      <p className="text-[11px] font-semibold text-emerald-400 mb-2">
                        ↑ +18.6% vs sem. dernière
                      </p>
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#151236]/70 border border-white/[0.08]">
                      <p className="text-xs text-slate-400 mb-1">Bénéfice Net Réel</p>
                      <p className="text-xl font-extrabold text-white mb-1">415 000 F</p>
                      <p className="text-[11px] font-semibold text-emerald-400 mb-2">
                        ↑ +15.2% marge nette
                      </p>
                      <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-400/30 flex items-center justify-center text-pink-300">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* BARRE DE PREUVE SOCIALE SOUS LE DASHBOARD (STYLE NEXORA)       */}
          {/* ============================================================== */}
          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 border-2 border-[#060517] flex items-center justify-center text-[11px] font-bold text-white">
                  KA
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-[#060517] flex items-center justify-center text-[11px] font-bold text-white">
                  AM
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 border-2 border-[#060517] flex items-center justify-center text-[11px] font-bold text-white">
                  SD
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-[#060517] flex items-center justify-center text-[11px] font-bold text-white">
                  +
                </div>
              </div>
              <span>
                <b className="text-white">Des centaines</b> de boutiques équipées avec MaBoutiquePro
              </span>
            </div>

            <div className="hidden sm:block w-px h-5 bg-white/15" />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-amber-400">
                <Star className="w-4 h-4 fill-amber-400" />
                <Star className="w-4 h-4 fill-amber-400" />
                <Star className="w-4 h-4 fill-amber-400" />
                <Star className="w-4 h-4 fill-amber-400" />
                <Star className="w-4 h-4 fill-amber-400" />
              </div>
              <span>
                <b className="text-white">4.9/5</b> • 100% pensé pour le FCFA &amp; Mobile Money
              </span>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 2. SECTION FONCTIONNALITÉS CLÉS                                  */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-24 px-4 sm:px-6 md:px-8 border-t border-white/[0.07]" id="features">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fonctionnalités Puissantes</span>
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                Tout ce qu&apos;il faut pour{" "}
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  piloter votre boutique
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300/85">
                Une interface ultra-rapide pour vendre au comptoir, éviter les ruptures de stock et maîtriser votre trésorerie.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="avantages">
              {/* Carte 1 */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#100d28]/80 border border-white/10 hover:border-indigo-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_35px_rgba(99,102,241,0.2)] group">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Store className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Caisse Tactile &amp; Mode Hors-ligne</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">
                  Enregistrez vos ventes en 2 clics avec ou sans lecteur code-barres. Continuez à encaisser même en cas de coupure internet grâce au mode PWA.
                </p>
              </div>

              {/* Carte 2 */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#100d28]/80 border border-white/10 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_35px_rgba(168,85,247,0.2)] group">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Gestion des Stocks &amp; Alertes</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">
                  Soyez averti dès qu&apos;un produit approche du seuil critique. Gérez la vente en gros (cartons) et au détail (pièces) et importez via Excel.
                </p>
              </div>

              {/* Carte 3 */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#100d28]/80 border border-white/10 hover:border-pink-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_35px_rgba(236,72,153,0.2)] group">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Carnet de Dettes &amp; WhatsApp</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">
                  Suivez les crédits clients, enregistrez les acomptes et envoyez des relances professionnelles pré-remplies en 1 clic sur WhatsApp.
                </p>
              </div>

              {/* Carte 4 */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#100d28]/80 border border-white/10 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_35px_rgba(59,130,246,0.2)] group">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Receipt className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Reçus Thermiques &amp; Factures PDF</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">
                  Imprimez instantanément des tickets 80mm/58mm ou générez des factures et quittances A4 au format PDF avec le nom de votre boutique.
                </p>
              </div>

              {/* Carte 5 */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#100d28]/80 border border-white/10 hover:border-emerald-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_35px_rgba(16,185,129,0.2)] group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Bénéfice Net Réel en FCFA</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">
                  Visualisez votre marge réelle après déduction automatique des coûts d&apos;achat (invisibles pour les caissiers) et des charges de la boutique.
                </p>
              </div>

              {/* Carte 6 */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#100d28]/80 border border-white/10 hover:border-amber-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_35px_rgba(245,158,11,0.2)] group">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Multi-Boutiques &amp; Caissiers</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">
                  Gérez jusqu&apos;à 3 magasins avec des comptes caissiers restreints. Clôtures de caisse journalières (Rapports X et Z) et détection des écarts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 3. SECTION TARIFICATION D'ABONNEMENT                             */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-24 px-4 sm:px-6 md:px-8 bg-[#09071f]/80 border-t border-white/[0.07]" id="tarifs">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider mb-3">
                🎁 14 JOURS D&apos;ESSAI GRATUIT POUR TOUS
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-1 mb-3 tracking-tight">
                Des tarifs simples et{" "}
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  accessibles
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300/85">
                Testez gratuitement pendant 14 jours sans carte bancaire, puis choisissez la formule adaptée à votre commerce.
              </p>
            </div>

            {/* Toggle Mensuel / Annuel */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12">
              <div className="flex items-center justify-center gap-3">
                <span className={`text-xs sm:text-sm font-bold transition-colors ${!isAnnual ? "text-white" : "text-slate-400"}`}>
                  Facturation Mensuelle
                </span>
                <button
                  type="button"
                  onClick={() => setIsAnnual(!isAnnual)}
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isAnnual ? "bg-purple-600" : "bg-white/15"}`}
                  aria-label="Basculer vers la facturation annuelle"
                >
                  <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${isAnnual ? "translate-x-6" : "translate-x-0"}`} />
                </button>
                <span className={`text-xs sm:text-sm font-bold transition-colors ${isAnnual ? "text-white" : "text-slate-400"}`}>
                  Facturation Annuelle
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-extrabold uppercase border border-emerald-500/30">
                2 mois offerts
              </span>
            </div>

            {/* Les 3 Cartes de Prix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
              {/* PLAN STARTER */}
              <div className="bg-[#110e2e]/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-blue-500/30 hover:border-blue-400/60 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[11px] font-bold uppercase tracking-wider mb-4">
                    Solo &amp; Démarrage
                  </div>
                  <h3 className="text-2xl font-extrabold text-white mb-1">STARTER</h3>
                  <p className="text-xs text-slate-300/80 mb-6">
                    Pour commerçants indépendants souhaitant numériser leurs ventes et leurs stocks simplement.
                  </p>

                  <div className="mb-6">
                    <div className="text-3xl sm:text-4xl font-black text-blue-400">
                      {isAnnual ? "25 000" : "2 500"}{" "}
                      <span className="text-sm font-semibold text-slate-400">FCFA / {isAnnual ? "an" : "mois"}</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-xs text-emerald-400 font-semibold mt-1">Soit ~2 083 FCFA / mois (5 000 F d&apos;économie)</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">Payable par Mobile Money chaque mois</p>
                    )}
                  </div>

                  <ul className="space-y-3 text-sm text-slate-200 mb-8">
                    <li className="flex items-start gap-2.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>1 Boutique &amp; 1 Gérant (Admin)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Gestion des produits &amp; du stock</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Ventes directes au comptoir illimitées</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Calcul des marges &amp; bénéfices nets</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><b>Mode Hors-ligne (PWA)</b> sans internet</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => onLoginClick(true)}
                  className="group w-full py-3.5 px-5 rounded-full bg-white/[0.07] hover:bg-blue-600 border border-blue-400/40 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Rocket className="w-4 h-4 text-blue-400 group-hover:text-white transition-colors" />
                  <span>Commencer gratuitement</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              {/* PLAN PRO (POPULAIRE) */}
              <div className="bg-gradient-to-b from-[#1a1443] to-[#110e2e] p-6 sm:p-8 pt-9 rounded-3xl border-2 border-purple-500 shadow-[0_0_50px_rgba(139,92,246,0.3)] flex flex-col justify-between relative transform lg:-translate-y-2">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white text-[11px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                  <Star className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                  <span>LE PLUS POPULAIRE</span>
                </div>

                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[11px] font-bold uppercase tracking-wider mb-4">
                    Boutique Active
                  </div>
                  <h3 className="text-2xl font-extrabold text-white mb-1">PRO</h3>
                  <p className="text-xs text-slate-300/85 mb-6">
                    Pour boutiques avec reçus thermiques, suivi des dettes clients et 1 caissier inclus.
                  </p>

                  <div className="mb-6">
                    <div className="text-3xl sm:text-4xl font-black text-white">
                      {isAnnual ? "50 000" : "5 000"}{" "}
                      <span className="text-sm font-semibold text-slate-300">FCFA / {isAnnual ? "an" : "mois"}</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-xs text-emerald-400 font-semibold mt-1">Soit ~4 166 FCFA / mois (10 000 F d&apos;économie)</p>
                    ) : (
                      <p className="text-xs text-slate-300 mt-1">Payable par Mobile Money chaque mois</p>
                    )}
                  </div>

                  <ul className="space-y-3 text-sm text-slate-100 mb-8">
                    <li className="flex items-start gap-2.5 font-bold text-purple-300">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>Tout ce qui est inclus dans Starter</span>
                    </li>
                    <li className="flex items-start gap-2.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><b>1 Caissier inclus</b> avec compte dédié</span>
                    </li>
                    <li className="flex items-start gap-2.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><b>Carnet de Crédit &amp; Relances WhatsApp</b></span>
                    </li>
                    <li className="flex items-start gap-2.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><b>Tickets thermiques 80mm &amp; Factures A4</b></span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>Inventaires physiques &amp; Commandes fournisseurs</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => onLoginClick(true)}
                  className="group w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white font-bold text-sm shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:brightness-110 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                  <span>Essayer gratuitement 14 jours</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              {/* PLAN BUSINESS */}
              <div className="bg-[#110e2e]/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-pink-500/30 hover:border-pink-400/60 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 text-[11px] font-bold uppercase tracking-wider mb-4">
                    Multi-Magasins &amp; Équipe
                  </div>
                  <h3 className="text-2xl font-extrabold text-white mb-1">BUSINESS</h3>
                  <p className="text-xs text-slate-300/80 mb-6">
                    Pour propriétaires gérant plusieurs points de vente avec une équipe de caissiers.
                  </p>

                  <div className="mb-6">
                    <div className="text-3xl sm:text-4xl font-black text-pink-400">
                      {isAnnual ? "100 000" : "10 000"}{" "}
                      <span className="text-sm font-semibold text-slate-400">FCFA / {isAnnual ? "an" : "mois"}</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-xs text-emerald-400 font-semibold mt-1">Soit ~8 333 FCFA / mois (20 000 F d&apos;économie)</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">Payable par Mobile Money chaque mois</p>
                    )}
                  </div>

                  <ul className="space-y-3 text-sm text-slate-200 mb-8">
                    <li className="flex items-start gap-2.5 font-bold text-pink-300">
                      <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                      <span>Toutes les fonctionnalités Pro incluses</span>
                    </li>
                    <li className="flex items-start gap-2.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                      <span><b>Jusqu&apos;à 3 Boutiques actives</b></span>
                    </li>
                    <li className="flex items-start gap-2.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                      <span><b>Jusqu&apos;à 3 Caissiers au total</b></span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                      <span>Tableau de bord consolidé multi-magasins</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                      <span>Support VIP prioritaire WhatsApp 7j/7</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => onLoginClick(true)}
                  className="group w-full py-3.5 px-5 rounded-full bg-white/[0.07] hover:bg-pink-600 border border-pink-400/40 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>Choisir Business après l&apos;essai</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>

            {/* Réassurance Moneriz */}
            <div className="mt-10 text-center text-xs text-slate-300 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 p-4 rounded-2xl bg-white/[0.03] border border-white/10 max-w-3xl mx-auto">
              <span className="flex items-center justify-center gap-2 font-semibold text-white">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Paiement sécurisé via Moneriz (T-Money, Moov, Wave, Orange Money, Carte)</span>
              </span>
              <span className="flex items-center justify-center gap-1.5 font-semibold text-emerald-400">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Sans engagement • Annulation libre</span>
              </span>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 4. SECTION FAQ                                                   */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-24 px-4 sm:px-6 md:px-8 border-t border-white/[0.07]" id="faq">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-2 inline-block">
                Questions Fréquentes
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
                Tout savoir avant de démarrer
              </h2>
              <p className="text-sm text-slate-300/80">
                Des réponses claires pour vous accompagner sereinement.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-[#100d28]/80 border border-white/10">
                <h3 className="text-base font-bold text-white mb-2">
                  Comment fonctionne la période d&apos;essai gratuit de 14 jours ?
                </h3>
                <p className="text-sm text-slate-300/85 leading-relaxed">
                  Dès votre inscription, vous bénéficiez immédiatement de 14 jours d&apos;accès complet à toutes les fonctionnalités PRO, sans aucun engagement et sans carte bancaire.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#100d28]/80 border border-white/10">
                <h3 className="text-base font-bold text-white mb-2">
                  Comment s&apos;effectue le règlement de l&apos;abonnement ?
                </h3>
                <p className="text-sm text-slate-300/85 leading-relaxed">
                  Le paiement se fait directement en FCFA par Mobile Money (T-Money, Moov Flooz, Wave, Orange Money, MTN) ou par carte bancaire via notre passerelle sécurisée Moneriz.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#100d28]/80 border border-white/10">
                <h3 className="text-base font-bold text-white mb-2">
                  Puis-je utiliser l&apos;application sans connexion internet ?
                </h3>
                <p className="text-sm text-slate-300/85 leading-relaxed">
                  Oui ! MaBoutiquePro fonctionne en mode hors-ligne (PWA). Vous pouvez continuer à encaisser vos clients même si la connexion internet est coupée. Vos ventes se synchronisent dès le retour du réseau.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#100d28]/80 border border-white/10">
                <h3 className="text-base font-bold text-white mb-2">
                  Mes caissiers peuvent-ils voir mes marges ou mes prix d&apos;achat ?
                </h3>
                <p className="text-sm text-slate-300/85 leading-relaxed">
                  Non. Chaque caissier dispose d&apos;un accès strictement limité à la caisse et ne peut jamais consulter vos prix d&apos;achat, votre bénéfice net ni vos dépenses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 5. GRAND CTA FINAL                                               */}
        {/* ================================================================ */}
        <section className="w-full py-16 sm:py-24 px-4 sm:px-6 md:px-8 border-t border-white/[0.07]">
          <div className="max-w-4xl mx-auto p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-indigo-900/60 via-purple-900/60 to-fuchsia-900/50 border border-purple-400/30 shadow-[0_0_70px_rgba(139,92,246,0.25)] text-center flex flex-col items-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-purple-200 border border-white/15 text-xs font-bold uppercase tracking-wider mb-4">
              Prêt en 2 minutes
            </span>
            <h2 className="text-2xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              Prenez le contrôle de votre boutique dès aujourd&apos;hui
            </h2>
            <p className="max-w-xl text-sm sm:text-lg text-slate-200/90 mb-8 leading-relaxed">
              Rejoignez les commerçants qui gagnent du temps, sécurisent leurs encaissements et éliminent les pertes de stock.
            </p>
            <button
              onClick={() => onLoginClick(true)}
              className="group inline-flex items-center justify-center gap-3 pl-7 pr-3.5 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white font-bold text-sm sm:text-base shadow-[0_0_35px_rgba(139,92,246,0.6)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Démarrer mes 14 jours gratuits</span>
              <span className="w-8 h-8 rounded-full bg-white text-purple-700 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* ================================================================ */}
      {/* FOOTER                                                           */}
      {/* ================================================================ */}
      <footer className="relative z-10 w-full bg-[#040310] border-t border-white/[0.08] text-slate-400">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-24 sm:pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 pb-6 border-b border-white/[0.08] text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span className="text-lg font-extrabold text-white">MaBoutiquePro</span>
              <span className="text-xs text-slate-400">
                — Caisse, stocks &amp; gestion commerciale pour l&apos;Afrique
              </span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-xs text-slate-300 font-medium flex-wrap justify-center sm:justify-end">
              <a href="#tarifs" className="hover:text-purple-400 transition-colors">Tarifs</a>
              <a href="#features" className="hover:text-purple-400 transition-colors">Fonctionnalités</a>
              <a href="#faq" className="hover:text-purple-400 transition-colors">FAQ</a>
              <a href="/privacy" className="hover:text-purple-400 transition-colors">Règles de confidentialité</a>
              <a href="/terms" className="hover:text-purple-400 transition-colors">Conditions d&apos;utilisation</a>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium text-center sm:text-left">
            <p>© 2026 MaBoutiquePro. Tous droits réservés.</p>
            <p className="flex items-center gap-1.5 justify-center">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
              <span>Développé avec fierté pour les entrepreneurs africains.</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Barre WhatsApp Sticky en bas (Mobile) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-[#09071c]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate">Besoin d&apos;aide ou d&apos;informations ?</p>
          <p className="text-[10px] text-emerald-400 font-semibold truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
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
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
        <span>Discuter sur WhatsApp</span>
      </a>
    </div>
  );
}
