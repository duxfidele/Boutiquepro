"use client";

import React, { useState, useEffect } from "react";
import { MessageCircle, X, Send, Copy, Check, Phone, FileText, ExternalLink } from "lucide-react";
import { formatWhatsAppNumber, getWhatsAppUrl } from "@/lib/whatsapp";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  defaultPhone?: string;
  customerName?: string;
  messageText: string;
  onPhoneUpdated?: (newPhone: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  title = "Partager sur WhatsApp",
  defaultPhone = "",
  customerName = "",
  messageText,
  onPhoneUpdated,
}) => {
  const [phone, setPhone] = useState(defaultPhone);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPhone(defaultPhone || "");
      setCopied(false);
    }
  }, [isOpen, defaultPhone]);

  if (!isOpen) return null;

  const formattedNumber = formatWhatsAppNumber(phone);
  const isValidPhone = Boolean(formattedNumber);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erreur copie presse-papier:", err);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!formattedNumber) return;
    if (onPhoneUpdated && phone.trim() !== defaultPhone) {
      onPhoneUpdated(phone.trim());
    }
    const url = getWhatsAppUrl(formattedNumber, messageText);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border/80 shadow-2xl p-5 text-foreground animate-scale-in space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">{title}</h3>
              {customerName && (
                <p className="text-xs text-muted-foreground">Destinataire : <strong className="text-foreground">{customerName}</strong></p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Saisie Téléphone */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">
            Numéro WhatsApp du client <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="tel"
              autoFocus
              placeholder="Ex: 90 12 34 56 ou +228 90 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValidPhone) {
                  e.preventDefault();
                  handleOpenWhatsApp();
                }
              }}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border/80 bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] pt-0.5">
            {formattedNumber ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <Check className="h-3 w-3" /> WhatsApp valide : +{formattedNumber}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Indicatif Togo (+228) appliqué automatiquement si 8 chiffres.
              </span>
            )}
          </div>
        </div>

        {/* Aperçu du message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-primary hover:underline font-medium flex items-center gap-1 text-[11px]"
            >
              <FileText className="h-3 w-3" />
              {showPreview ? "Masquer l'aperçu du texte" : "Voir l'aperçu du message"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded bg-secondary/50"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copier le texte</span>
                </>
              )}
            </button>
          </div>

          {showPreview && (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-secondary/40 border border-border/60 p-3 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed select-all">
              {messageText}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!isValidPhone}
            onClick={handleOpenWhatsApp}
            className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-emerald-600/25"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Ouvrir WhatsApp</span>
            <ExternalLink className="h-3 w-3 opacity-75" />
          </button>
        </div>
      </div>
    </div>
  );
};
