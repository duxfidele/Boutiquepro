"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { ModuleKey } from "@/types/modules";

const PREWARM_ROUTES_ADMIN: Array<{ path: string; module?: ModuleKey }> = [
  { path: "/pos" },
  { path: "/products" },
  { path: "/customers" },
  { path: "/debts", module: "debts" },
  { path: "/quotes" },
  { path: "/orders", module: "orders" },
  { path: "/inventory", module: "inventory" },
  { path: "/expenses", module: "expenses" },
  { path: "/analytics", module: "analytics" },
  { path: "/settings" },
  { path: "/profile" },
  { path: "/~offline" },
];

const PREWARM_ROUTES_CASHIER: Array<{ path: string; module?: ModuleKey }> = [
  { path: "/pos" },
  { path: "/products" },
  { path: "/customers" },
  { path: "/debts", module: "debts" },
  { path: "/profile" },
  { path: "/~offline" },
];

export default function PwaLifecycleManager() {
  const { user, role, activeStore, getModuleStatus } = useAuth();
  const router = useRouter();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const isApplyingUpdateRef = useRef(false);
  const prewarmedScopeRef = useRef<string | null>(null);

  // 1. Gestion douce des mises à jour Service Worker (pas de rechargement brutal pendant un encaissement)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let isMounted = true;
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      if (isApplyingUpdateRef.current) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    const attachToRegistration = (reg: ServiceWorkerRegistration) => {
      if (!isMounted) return;
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller &&
            isMounted
          ) {
            setWaitingWorker(reg.waiting || installing);
            setDismissedUpdate(false);
          }
        });
      });
    };

    const bindRegistration = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) {
          attachToRegistration(existing);
          return;
        }
        const readyReg = await navigator.serviceWorker.ready;
        attachToRegistration(readyReg);
      } catch {}
    };

    void bindRegistration();

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  // 2. Préchargement discret des routes critiques dès que la session & la boutique sont prêtes en ligne
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id || !activeStore?.id) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const scopeKey = `${user.id}:${activeStore.id}:${role || "none"}`;
    if (prewarmedScopeRef.current === scopeKey) return;

    const candidates =
      role === "cashier" ? PREWARM_ROUTES_CASHIER : PREWARM_ROUTES_ADMIN;

    const allowedRoutes = candidates
      .filter((r) => !r.module || getModuleStatus(r.module) !== "disabled")
      .map((r) => r.path);

    const runPrewarm = () => {
      prewarmedScopeRef.current = scopeKey;
      allowedRoutes.forEach((routePath, index) => {
        setTimeout(() => {
          if (typeof navigator !== "undefined" && !navigator.onLine) return;
          try {
            router.prefetch(routePath);
          } catch {}
        }, index * 250);
      });
    };

    const timer = window.setTimeout(runPrewarm, 2200);
    return () => window.clearTimeout(timer);
  }, [user?.id, activeStore?.id, role, getModuleStatus, router]);

  const handleApplyUpdate = () => {
    if (!waitingWorker) return;
    isApplyingUpdateRef.current = true;
    setIsApplyingUpdate(true);
    try {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      isApplyingUpdateRef.current = false;
      setIsApplyingUpdate(false);
      window.location.reload();
    }
  };

  if (!waitingWorker || dismissedUpdate) {
    return null;
  }

  return (
    <div className="print:hidden fixed bottom-20 lg:bottom-5 right-4 left-4 sm:left-auto sm:max-w-sm z-50 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl p-3.5 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
      <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground">
          Mise à jour prête
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          Une nouvelle version de MaBoutiquePro est disponible.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleApplyUpdate}
          disabled={isApplyingUpdate}
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${isApplyingUpdate ? "animate-spin" : ""}`}
          />
          <span>{isApplyingUpdate ? "..." : "Actualiser"}</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissedUpdate(true)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          aria-label="Fermer la notification de mise à jour"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
