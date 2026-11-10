import { supabase } from "@/lib/supabase";
import { isNetworkLikeError, withNetworkTimeout } from "@/lib/offlineQueue";

export type NetworkHealthStatus =
  | "online"
  | "offline"
  | "degraded"
  | "checking";

export interface NetworkHealthSnapshot {
  status: NetworkHealthStatus;
  isReachable: boolean;
  navigatorOnline: boolean;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  consecutiveFailures: number;
  authInvalid: boolean;
}

const DEGRADED_LATENCY_MS = 2200;
const HEALTHY_PROBE_INTERVAL_MS = 45000;
const UNHEALTHY_PROBE_INTERVAL_MS = 20000;

let currentSnapshot: NetworkHealthSnapshot = {
  status:
    typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : "online",
  isReachable: typeof navigator === "undefined" ? true : navigator.onLine,
  navigatorOnline:
    typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
  latencyMs: null,
  lastCheckedAt: null,
  lastHealthyAt: null,
  consecutiveFailures: 0,
  authInvalid: false,
};

const listeners = new Set<(snap: NetworkHealthSnapshot) => void>();
let inflightProbe: Promise<NetworkHealthSnapshot> | null = null;
let monitorStarted = false;
let probeTimer: ReturnType<typeof setTimeout> | null = null;

function notifyListeners(): void {
  const copy = { ...currentSnapshot };
  listeners.forEach((cb) => {
    try {
      cb(copy);
    } catch {}
  });
}

function scheduleNextProbe(): void {
  if (!monitorStarted || typeof window === "undefined") return;
  if (probeTimer) clearTimeout(probeTimer);
  const delay =
    currentSnapshot.status === "online"
      ? HEALTHY_PROBE_INTERVAL_MS
      : UNHEALTHY_PROBE_INTERVAL_MS;

  probeTimer = setTimeout(() => {
    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      void probeServerHealth({ timeoutMs: 3500 }).finally(() => {
        scheduleNextProbe();
      });
    } else {
      scheduleNextProbe();
    }
  }, delay);
}

/**
 * Détecte une réponse auth/JWT expirée ou invalide (distincte d'une panne réseau).
 */
export function isAuthInvalidError(err: unknown): boolean {
  if (!err || isNetworkLikeError(err)) return false;
  const e = err as {
    status?: number;
    code?: string | number;
    message?: string;
    details?: string;
    hint?: string;
  };
  if (e?.status === 401) return true;
  const code = String(e?.code || "").toUpperCase();
  if (code === "PGRST301" || code === "PGRST302" || code === "PGRST303") {
    return true;
  }
  const msg = String(
    e?.message || e?.details || e?.hint || err || ""
  ).toLowerCase();
  return (
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("token is expired") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("invalid refresh token") ||
    msg.includes("session_not_found") ||
    msg.includes("authentification requise")
  );
}

/**
 * Détecte une réponse HTML / non-JSON typique d'un portail captif Wi-Fi
 * ou d'un proxy bloquant ("faux en-ligne").
 */
export function isCaptivePortalOrParseError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  const name = String(e?.name || "").toLowerCase();
  const msg = String(e?.message || err || "").toLowerCase();
  return (
    name === "syntaxerror" ||
    msg.includes("unexpected token") ||
    (msg.includes("json") && msg.includes("parse")) ||
    msg.includes("is not valid json")
  );
}

export function getNetworkHealthSnapshot(): NetworkHealthSnapshot {
  return { ...currentSnapshot };
}

export function subscribeNetworkHealth(
  listener: (snap: NetworkHealthSnapshot) => void
): () => void {
  listeners.add(listener);
  listener({ ...currentSnapshot });
  return () => {
    listeners.delete(listener);
  };
}

export function reportNetworkSuccess(latencyMs?: number): void {
  const nowIso = new Date().toISOString();
  const navOn =
    typeof navigator === "undefined" ? true : Boolean(navigator.onLine);
  const nextStatus: NetworkHealthStatus =
    typeof latencyMs === "number" && latencyMs > DEGRADED_LATENCY_MS
      ? "degraded"
      : "online";

  currentSnapshot = {
    status: nextStatus,
    isReachable: true,
    navigatorOnline: navOn,
    latencyMs: latencyMs ?? currentSnapshot.latencyMs,
    lastCheckedAt: nowIso,
    lastHealthyAt: nowIso,
    consecutiveFailures: 0,
    authInvalid: false,
  };
  notifyListeners();
}

export function reportNetworkFailure(err?: unknown): void {
  const nowIso = new Date().toISOString();
  const navOn =
    typeof navigator === "undefined" ? true : Boolean(navigator.onLine);
  const authInvalid = isAuthInvalidError(err);

  if (authInvalid) {
    // Le serveur a répondu 401/JWT : le réseau est là, mais le jeton est expiré
    currentSnapshot = {
      ...currentSnapshot,
      status: "online",
      isReachable: true,
      navigatorOnline: navOn,
      lastCheckedAt: nowIso,
      authInvalid: true,
    };
  } else {
    currentSnapshot = {
      ...currentSnapshot,
      status: "offline",
      isReachable: false,
      navigatorOnline: navOn,
      lastCheckedAt: nowIso,
      consecutiveFailures: currentSnapshot.consecutiveFailures + 1,
      authInvalid: false,
    };
  }
  notifyListeners();
}

/**
 * Sonde légère réelle contre PostgreSQL/Supabase (`ping_health`)
 * avec timeout strict afin d'éliminer le faux en-ligne (Wi-Fi sans Internet / portail captif).
 */
export async function probeServerHealth(options?: {
  timeoutMs?: number;
  force?: boolean;
}): Promise<NetworkHealthSnapshot> {
  if (inflightProbe) {
    return inflightProbe;
  }

  const timeoutMs = options?.timeoutMs ?? 3500;
  const navOn =
    typeof navigator === "undefined" ? true : Boolean(navigator.onLine);

  if (!navOn && !options?.force) {
    currentSnapshot = {
      ...currentSnapshot,
      status: "offline",
      isReachable: false,
      navigatorOnline: false,
      lastCheckedAt: new Date().toISOString(),
    };
    notifyListeners();
    return { ...currentSnapshot };
  }

  inflightProbe = (async (): Promise<NetworkHealthSnapshot> => {
    const startMs = Date.now();
    const nowIso = new Date().toISOString();
    try {
      const { error } = await withNetworkTimeout(
        supabase.rpc("ping_health"),
        timeoutMs
      );
      const latencyMs = Date.now() - startMs;

      if (!error) {
        currentSnapshot = {
          status: latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "online",
          isReachable: true,
          navigatorOnline:
            typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
          latencyMs,
          lastCheckedAt: nowIso,
          lastHealthyAt: nowIso,
          consecutiveFailures: 0,
          authInvalid: false,
        };
        notifyListeners();
        return { ...currentSnapshot };
      }

      if (isCaptivePortalOrParseError(error) || isNetworkLikeError(error)) {
        currentSnapshot = {
          ...currentSnapshot,
          status: "offline",
          isReachable: false,
          navigatorOnline:
            typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
          latencyMs: null,
          lastCheckedAt: nowIso,
          consecutiveFailures: currentSnapshot.consecutiveFailures + 1,
          authInvalid: false,
        };
        notifyListeners();
        return { ...currentSnapshot };
      }

      const authErr = isAuthInvalidError(error);
      // Si l'erreur vient de Supabase (ex: JWT expiré ou permission anon), le serveur HTTP a bien répondu
      currentSnapshot = {
        status: latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "online",
        isReachable: true,
        navigatorOnline:
          typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
        latencyMs,
        lastCheckedAt: nowIso,
        lastHealthyAt: nowIso,
        consecutiveFailures: 0,
        authInvalid: authErr,
      };
      notifyListeners();
      return { ...currentSnapshot };
    } catch (err) {
      if (isAuthInvalidError(err)) {
        currentSnapshot = {
          ...currentSnapshot,
          status: "online",
          isReachable: true,
          navigatorOnline:
            typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
          lastCheckedAt: nowIso,
          authInvalid: true,
        };
      } else {
        currentSnapshot = {
          ...currentSnapshot,
          status: "offline",
          isReachable: false,
          navigatorOnline:
            typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
          latencyMs: null,
          lastCheckedAt: nowIso,
          consecutiveFailures: currentSnapshot.consecutiveFailures + 1,
          authInvalid: false,
        };
      }
      notifyListeners();
      return { ...currentSnapshot };
    } finally {
      inflightProbe = null;
    }
  })();

  return inflightProbe;
}

export function startNetworkMonitor(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (monitorStarted) {
    return () => {};
  }

  monitorStarted = true;

  const onOnline = () => {
    currentSnapshot = {
      ...currentSnapshot,
      status: "checking",
      navigatorOnline: true,
    };
    notifyListeners();
    void probeServerHealth({ timeoutMs: 3500, force: true }).finally(
      scheduleNextProbe
    );
  };

  const onOffline = () => {
    currentSnapshot = {
      ...currentSnapshot,
      status: "offline",
      isReachable: false,
      navigatorOnline: false,
      lastCheckedAt: new Date().toISOString(),
    };
    notifyListeners();
    scheduleNextProbe();
  };

  const onVisibilityOrFocus = () => {
    if (document.visibilityState === "visible") {
      void probeServerHealth({ timeoutMs: 3500 }).finally(scheduleNextProbe);
    }
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("focus", onVisibilityOrFocus);
  document.addEventListener("visibilitychange", onVisibilityOrFocus);

  // Sonde initiale immédiate sans bloquer l'UI
  void probeServerHealth({ timeoutMs: 3500 }).finally(scheduleNextProbe);

  return () => {
    monitorStarted = false;
    if (probeTimer) {
      clearTimeout(probeTimer);
      probeTimer = null;
    }
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("focus", onVisibilityOrFocus);
    document.removeEventListener("visibilitychange", onVisibilityOrFocus);
  };
}

