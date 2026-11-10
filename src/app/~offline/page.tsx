"use client";

import React from "react";
import Link from "next/link";
import { WifiOff, ShoppingCart, LayoutDashboard, RefreshCw } from "lucide-react";

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-3xl border border-border/60 bg-card p-8 text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto ring-8 ring-amber-500/5">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">
            Vous êtes hors-ligne
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cette page n&apos;a pas encore été mise en cache sur cet appareil. Vos données locales et ventes en file d&apos;attente restent intactes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-2">
          <Link
            href="/pos"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity shadow-md"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ouvrir la Caisse (POS)</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-bold text-foreground hover:bg-secondary/80 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Retour à l&apos;accueil</span>
          </Link>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réessayer le chargement</span>
          </button>
        </div>
      </div>
    </div>
  );
}

