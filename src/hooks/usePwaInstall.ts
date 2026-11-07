"use client";

import { useState, useEffect, useCallback } from "react";

declare global {
  interface Window {
    __pwaDeferredPrompt?: any;
    __pwaJustInstalled?: boolean;
  }
}

export type PwaPlatform = "ios" | "android" | "desktop";

export function usePwaInstall() {
  const [mounted, setMounted] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent || "";
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isAndroidDevice = /Android/i.test(ua);

    if (isIOSDevice) {
      setPlatform("ios");
    } else if (isAndroidDevice) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        (window.navigator as any).standalone === true ||
        Boolean(window.__pwaJustInstalled);
      setIsInstalled(standalone);
    };

    const syncPrompt = () => {
      setHasNativePrompt(Boolean(window.__pwaDeferredPrompt));
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaDeferredPrompt = e;
      setHasNativePrompt(true);
    };

    const handleAppInstalled = () => {
      window.__pwaJustInstalled = true;
      window.__pwaDeferredPrompt = null;
      setHasNativePrompt(false);
      setIsInstalled(true);
      setShowGuideModal(false);
    };

    checkStandalone();
    syncPrompt();
    setMounted(true);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", checkStandalone);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("pwa-prompt-ready", syncPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", checkStandalone);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("pwa-prompt-ready", syncPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (typeof window === "undefined") return;

    const promptEvent = window.__pwaDeferredPrompt;
    if (promptEvent && typeof promptEvent.prompt === "function") {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === "accepted") {
          window.__pwaJustInstalled = true;
          window.__pwaDeferredPrompt = null;
          setHasNativePrompt(false);
          setIsInstalled(true);
        } else {
          window.__pwaDeferredPrompt = null;
          setHasNativePrompt(false);
        }
        return;
      } catch {
        // Repli sur le guide visuel si l'invite système échoue
      }
    }

    setShowGuideModal(true);
  }, []);

  return {
    canShowInstall: mounted && !isInstalled,
    isInstalled,
    hasNativePrompt,
    platform,
    showGuideModal,
    setShowGuideModal,
    handleInstallClick,
  };
}

