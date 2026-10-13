"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, CheckCircle2, Loader2, Smartphone, CreditCard } from 'lucide-react';

interface BrowserCheckout {
  id: string;
  integrationMode: 'redirect' | 'iframe';
  checkoutUrl: string;
  embedUrl: string | null;
}

interface MonerizCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  session: BrowserCheckout;
  onSuccess?: () => void;
}

export default function MonerizCheckoutModal({
  isOpen,
  onClose,
  orderId,
  session,
  onSuccess,
}: MonerizCheckoutModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !session || !containerRef.current) return;

    if (session.integrationMode === 'redirect') {
      window.location.assign(session.checkoutUrl);
      return;
    }

    if (!session.embedUrl) {
      setInitError("URL d'intégration Moneriz non disponible.");
      return;
    }

    let cleanup: (() => void) | undefined;

    try {
      cleanup = mountMonerizCheckout(
        containerRef.current,
        session,
        async (message) => {
          if (message.status === 'paid' && message.confirmation === 'confirmed') {
            setIsVerifying(true);
            // Polling de vérification serveur
            let attempts = 0;
            const interval = setInterval(async () => {
              attempts++;
              try {
                const res = await fetch(`/api/subscription/status?orderId=${encodeURIComponent(orderId)}`);
                const data = await res.json();
                if (data?.order?.status === 'paid' || attempts >= 8) {
                  clearInterval(interval);
                  setIsVerifying(false);
                  setIsPaid(true);
                  if (onSuccess) onSuccess();
                }
              } catch {
                if (attempts >= 8) {
                  clearInterval(interval);
                  setIsVerifying(false);
                  setIsPaid(true);
                  if (onSuccess) onSuccess();
                }
              }
            }, 2000);
          }
        }
      );
    } catch (err: any) {
      setInitError(err?.message || "Erreur lors du chargement du module Moneriz.");
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [isOpen, session, orderId, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-base flex items-center gap-2">
                Paiement Sécurisé Moneriz
              </h3>
              <p className="text-xs text-outline flex items-center gap-2 font-medium">
                <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-primary" /> Wave, T-Money, Moov, Orange</span>
                <span>•</span>
                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3 text-primary" /> Carte Visa / Mastercard</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-outline hover:text-on-surface rounded-xl hover:bg-surface-container transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          {isPaid ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4 animate-in zoom-in-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-black text-on-surface mb-2">Paiement Réussi !</h4>
              <p className="text-sm text-on-surface-variant max-w-md mb-6 font-medium">
                Votre transaction Moneriz a été confirmée avec succès. Votre abonnement MaBoutiquePro est maintenant actif !
              </p>
              <button
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary-container transition-all shadow-md"
              >
                Accéder à ma boutique
              </button>
            </div>
          ) : isVerifying ? (
            <div className="py-12 flex flex-col items-center text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <h4 className="text-xl font-bold text-on-surface mb-1">Vérification de la confirmation...</h4>
              <p className="text-xs text-outline font-medium">
                Validation du webhook sécurisé en cours. Veuillez patienter un instant.
              </p>
            </div>
          ) : initError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-red-500 font-semibold mb-4">{initError}</p>
              <a
                href={session.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm"
              >
                Payer sur la page hébergée Moneriz ↗
              </a>
            </div>
          ) : (
            <div ref={containerRef} id="moneriz-checkout-container" className="min-h-[420px]" />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container-low/30 text-center text-xs text-outline">
          Encaissement sécurisé et crypté par Moneriz • Facturation en FCFA (XOF)
        </div>
      </div>
    </div>
  );
}

/**
 * Fonction officielle d'intégration Liveframe postMessage v1 Moneriz
 */
function mountMonerizCheckout(
  container: HTMLElement,
  session: BrowserCheckout,
  onPayment: (message: any) => void = () => {}
) {
  if (!container) throw new Error('Conteneur checkout introuvable');
  const embed = new URL(session.embedUrl!);
  const checkout = new URL(session.checkoutUrl);
  const token = embed.pathname.match(/^\/integrer\/([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token || checkout.origin !== embed.origin || checkout.pathname !== '/payer/' + token) {
    throw new Error('URL de checkout invalide');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(embed.hostname);
  if (embed.protocol !== 'https:' && !(local && embed.protocol === 'http:')) {
    throw new Error('Origine du checkout invalide');
  }

  const shell = document.createElement('div');
  shell.style.cssText = 'width:100%;min-width:0;max-width:640px;margin-inline:auto';

  const frame = document.createElement('iframe');
  frame.title = 'Paiement sécurisé Moneriz';
  frame.style.cssText = 'display:block;width:100%;height:560px;border:0;background:transparent;color-scheme:normal';
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');

  const notice = document.createElement('p');
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  notice.style.cssText = 'margin:12px 0 0;font:400 13px/1.6 system-ui;color:#625d70';
  notice.textContent = 'Le module tarde à répondre. Actualisez cette page pour reprendre son chargement. Si vous avez déjà payé, attendez la confirmation avant de recommencer.';

  const fallback = document.createElement('a');
  fallback.href = checkout.href;
  fallback.hidden = true;
  fallback.target = '_blank';
  fallback.rel = 'noopener noreferrer';
  fallback.textContent = 'Ouvrir le paiement dans une nouvelle page ↗';
  fallback.style.cssText = 'display:none;align-items:center;justify-content:center;min-height:44px;margin-top:8px;font:500 13px/1.5 system-ui;color:#514586;text-align:center;text-decoration:underline';

  let timer: any;
  let resumeKnown = false;

  function receive(event: MessageEvent) {
    if (event.origin !== embed.origin || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.source !== 'moneriz' || message.version !== 1 || message.token !== token) return;
    if (!['moneriz.ready', 'moneriz.resize', 'moneriz.payment', 'moneriz.resume'].includes(message.type)) return;

    clearTimeout(timer);
    notice.hidden = true;

    if (message.type === 'moneriz.resize' && Number.isInteger(message.height) && message.height >= 320 && message.height <= 4000) {
      frame.style.height = message.height + 'px';
    }

    if (message.type === 'moneriz.resume' && typeof message.resumeUrl === 'string') {
      try {
        const resume = new URL(message.resumeUrl);
        const attempt = resume.searchParams.get('tentative') || '';
        if (
          resume.origin !== checkout.origin ||
          resume.pathname !== checkout.pathname ||
          resume.username ||
          resume.password ||
          resume.hash ||
          [...resume.searchParams.keys()].length !== 1 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt)
        )
          return;
        fallback.href = resume.href;
        fallback.hidden = false;
        fallback.style.display = 'flex';
        resumeKnown = true;
      } catch {
        return;
      }
    }

    if (message.type === 'moneriz.payment') {
      fallback.hidden = !resumeKnown;
      fallback.style.display = resumeKnown ? 'flex' : 'none';
      onPayment(message);
    }
  }

  window.addEventListener('message', receive);
  timer = setTimeout(() => {
    notice.hidden = false;
  }, 15000);

  frame.src = embed.href;
  shell.append(frame, notice, fallback);
  container.append(shell);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('message', receive);
    shell.remove();
  };
}
