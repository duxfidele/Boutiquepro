"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Error caught:", error);
  }, [error]);

  const handleResetData = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error(e);
      }
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="max-w-lg w-full p-6 rounded-2xl border border-destructive/30 bg-destructive/5 space-y-4 shadow-xl">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="w-8 h-8 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">Erreur de chargement</h2>
            <p className="text-xs text-muted-foreground">Détail technique :</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-background border border-border/60 text-xs font-mono text-destructive overflow-x-auto max-h-48">
          <p className="font-bold">{error?.name || "Error"}: {error?.message || "Erreur client"}</p>
          {error?.stack && (
            <pre className="mt-2 text-[10px] text-muted-foreground whitespace-pre-wrap">{error.stack}</pre>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
          <button
            onClick={handleResetData}
            className="py-2 px-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-secondary/80"
          >
            <Trash2 className="w-4 h-4" />
            Vider le cache local
          </button>
        </div>
      </div>
    </div>
  );
}
