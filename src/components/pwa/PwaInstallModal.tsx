"use client";

import React from "react";
import { X, Download, Smartphone, Monitor, Share, PlusSquare, MoreVertical, CheckCircle2 } from "lucide-react";
import type { PwaPlatform } from "@/hooks/usePwaInstall";

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: PwaPlatform;
}

export default function PwaInstallModal({
  isOpen,
  onClose,
  platform,
}: PwaInstallModalProps) {
  const [selectedTab, setSelectedTab] = React.useState<PwaPlatform>(platform);

  React.useEffect(() => {
    setSelectedTab(platform);
  }, [platform, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[#0e0c26] text-white border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
              <img src="/logo.png" alt="MaBoutiquePro" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-white">
                Installer MaBoutiquePro
              </h3>
              <p className="text-xs text-slate-300">
                Accès rapide sur votre écran &amp; mode hors-ligne
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sélecteur d'appareil */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedTab("android")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                selectedTab === "android"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("ios")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                selectedTab === "ios"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone / iPad</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("desktop")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                selectedTab === "desktop"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>PC / Mac</span>
            </button>
          </div>
        </div>

        {/* Instructions selon l'appareil */}
        <div className="p-6 space-y-3.5 text-sm">
          {selectedTab === "ios" && (
            <>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Dans <b>Safari</b>, appuyez sur le bouton{" "}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
                    <Share className="w-3.5 h-3.5 text-sky-400" /> Partager
                  </span>{" "}
                  en bas (ou en haut) de l&apos;écran.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Faites défiler le menu et choisissez{" "}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
                    <PlusSquare className="w-3.5 h-3.5 text-emerald-400" /> Sur l&apos;écran d&apos;accueil
                  </span>.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Appuyez sur <b>Ajouter</b> en haut à droite : l&apos;icône <b>MaBoutiquePro</b> apparaît immédiatement sur votre téléphone.
                </p>
              </div>
            </>
          )}

          {selectedTab === "android" && (
            <>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Dans <b>Chrome</b>, appuyez sur le menu{" "}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
                    <MoreVertical className="w-3.5 h-3.5 text-purple-300" />
                  </span>{" "}
                  en haut à droite du navigateur.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Sélectionnez{" "}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
                    <Download className="w-3.5 h-3.5 text-emerald-400" /> Installer l&apos;application
                  </span>{" "}
                  (ou <b>Ajouter à l&apos;écran d&apos;accueil</b>).
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Confirmez en appuyant sur <b>Installer</b> pour utiliser la caisse en plein écran et hors-ligne.
                </p>
              </div>
            </>
          )}

          {selectedTab === "desktop" && (
            <>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Dans <b>Google Chrome</b> ou <b>Microsoft Edge</b>, regardez tout à droite de la barre d&apos;adresse (URL) et cliquez sur l&apos;icône{" "}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
                    <Download className="w-3.5 h-3.5 text-sky-400" /> Installer MaBoutiquePro
                  </span>.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-6 h-6 rounded-full bg-purple-500/25 text-purple-300 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Ou cliquez sur le menu <b>⋮</b> en haut à droite &rarr; <b>Enregistrer et partager</b> &rarr; <b>Installer MaBoutiquePro</b>.
                </p>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Fonctionne sans connexion Internet et synchronise vos ventes automatiquement.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white font-bold text-sm hover:brightness-110 transition-all cursor-pointer"
          >
            J&apos;ai compris
          </button>
        </div>
      </div>
    </div>
  );
}

