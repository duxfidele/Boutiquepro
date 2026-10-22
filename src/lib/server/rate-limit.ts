/**
 * Module de Rate Limiting Serveur pour Next.js (App Router)
 * Protection contre le spam, les dénis de service et les attaques par force brute.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Stockage en mémoire (sliding window / token bucket)
// Sur un environnement serverless (Vercel), chaque conteneur maintient son compteur
const rateLimitStore = new Map<string, RateLimitRecord>();

// Nettoyage automatique périodique des clés expirées toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((record, key) => {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000).unref?.();

export interface RateLimitOptions {
  maxRequests?: number;
  windowSeconds?: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Extrait l'adresse IP du client depuis les en-têtes de la requête HTTP
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Vérifie si la requête respecte la limite de fréquence autorisée
 * @param key Identifiant unique (ex: `checkout:192.168.1.1` ou `order:user_123`)
 * @param options maxRequests (défaut: 10), windowSeconds (défaut: 60)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const maxRequests = options.maxRequests ?? 10;
  const windowMs = (options.windowSeconds ?? 60) * 1000;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    // Nouvelle fenêtre
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  // Fenêtre en cours
  if (record.count >= maxRequests) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetInSeconds,
    };
  }

  record.count += 1;
  const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    resetInSeconds,
  };
}

/**
 * Crée une réponse HTTP 429 Too Many Requests standardisée
 */
export function rateLimitExceededResponse(
  resetInSeconds: number,
  customMessage?: string
): Response {
  return Response.json(
    {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message:
          customMessage ||
          `Trop de requêtes. Veuillez patienter ${resetInSeconds} secondes avant de réessayer.`,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(resetInSeconds),
        'X-RateLimit-Reset': String(resetInSeconds),
      },
    }
  );
}
