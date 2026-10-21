"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          theme?: 'auto' | 'light' | 'dark';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export default function TurnstileWidget({ onVerify, onError, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mode Fallback si la clé n'est pas encore renseignée
    if (!siteKey) {
      onVerify('local-shield-active');
      return;
    }

    let isMounted = true;

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token: string) => {
            if (isMounted) onVerify(token);
          },
          'error-callback': () => {
            if (isMounted && onError) onError();
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire();
          },
        });
        widgetIdRef.current = id;
        setIsReady(true);
      } catch (err) {
        console.warn('Erreur initialisation Turnstile:', err);
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector('script[src*="turnstile/v0/api.js"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => renderWidget();
        document.head.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(interval);
            renderWidget();
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onError, onExpire]);

  if (!siteKey) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground/80 font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>Protection anti-spam active</span>
      </div>
    );
  }

  return (
    <div className="flex justify-center my-2">
      <div ref={containerRef} />
    </div>
  );
}
