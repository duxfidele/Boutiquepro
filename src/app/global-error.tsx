"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-white font-sans">
        <div className="max-w-md w-full p-6 rounded-2xl border border-red-500/30 bg-red-950/20 space-y-4 shadow-2xl">
          <h2 className="text-lg font-bold text-red-400">Erreur globale d'initialisation</h2>
          <div className="p-3 rounded-xl bg-slate-900 text-xs font-mono text-red-300 overflow-x-auto max-h-48">
            <p className="font-bold">{error?.name}: {error?.message}</p>
            {error?.stack && <pre className="mt-2 text-[10px] text-slate-400 whitespace-pre-wrap">{error.stack}</pre>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => reset()}
              className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
            >
              Recharger
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  try { localStorage.clear(); sessionStorage.clear(); } catch(e){}
                  window.location.reload();
                }
              }}
              className="py-2 px-4 rounded-xl bg-slate-800 text-white text-xs font-semibold"
            >
              Vider le cache
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
