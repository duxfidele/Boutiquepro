/**
 * Module de Monitoring et Télémétrie Sentry pour Next.js (Client & Serveur)
 * Permet la capture immédiate des exceptions sans dépendre de packages lourds.
 * Compatible avec l'API officielle Sentry Store (v7).
 */

export interface SentryContext {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id?: string; email?: string; storeId?: string };
}

/**
 * Analyse une URL Sentry DSN (ex: https://pubkey@sentry.io/123456)
 */
function parseDsn(dsn: string): { host: string; projectId: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const pathParts = url.pathname.split("/").filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];

    if (!publicKey || !host || !projectId) return null;
    return { host, projectId, publicKey };
  } catch {
    return null;
  }
}

/**
 * Envoie un événement d'erreur vers Sentry via l'API REST officielle Store.
 */
export async function captureException(error: Error | any, context?: SentryContext): Promise<string | null> {
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    process.env.SENTRY_DSN ||
    "";

  console.error("[Sentry Monitoring] Exception interceptée :", error);

  if (!dsn) {
    // Si pas de DSN configuré, journaliser proprement en local sans bloquer
    return null;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.warn("[Sentry] Format de DSN invalide :", dsn);
    return null;
  }

  const eventId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    logger: "boutiquepro",
    environment: process.env.NODE_ENV || "production",
    exception: {
      values: [
        {
          type: error?.name || "Error",
          value: error?.message || String(error),
          stacktrace: error?.stack
            ? {
                frames: error.stack
                  .split("\n")
                  .slice(1)
                  .map((line: string) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    user: context?.user,
    tags: {
      app: "boutiquepro",
      ...(context?.tags || {}),
    },
    extra: context?.extra,
  };

  try {
    const endpoint = `https://${parsed.host}/api/${parsed.projectId}/store/`;
    const authHeader = `Sentry sentry_version=7, sentry_client=boutiquepro/1.0, sentry_key=${parsed.publicKey}`;

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": authHeader,
      },
      body: JSON.stringify(payload),
    });

    return eventId;
  } catch (err) {
    console.warn("[Sentry] Échec de l'envoi de l'événement:", err);
    return null;
  }
}

/**
 * Capture un message informatif ou un avertissement dans Sentry.
 */
export async function captureMessage(message: string, level: "info" | "warning" | "error" = "info", context?: SentryContext): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";
  if (!dsn) {
    console.log(`[Sentry:${level}]`, message);
    return;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const eventId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).substring(2, 15);

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level,
    message: { formatted: message },
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
  };

  try {
    const endpoint = `https://${parsed.host}/api/${parsed.projectId}/store/`;
    const authHeader = `Sentry sentry_version=7, sentry_client=boutiquepro/1.0, sentry_key=${parsed.publicKey}`;

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": authHeader,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[Sentry] Échec d'envoi du message :", err);
  }
}

