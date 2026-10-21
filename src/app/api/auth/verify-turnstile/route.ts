import { checkRateLimit, getClientIp, rateLimitExceededResponse } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

/**
 * Route API de vérification serveur Cloudflare Turnstile
 * Protège les inscriptions contre les fermes de bots et le spam automatique
 */
export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // Rate limiting : max 15 vérifications anti-bot par minute par IP
  const rate = checkRateLimit(`turnstile:${clientIp}`, { maxRequests: 15, windowSeconds: 60 });
  if (!rate.success) {
    return rateLimitExceededResponse(rate.resetInSeconds);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { token } = body || {};
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Si la clé secrète Cloudflare n'est pas encore configurée dans l'environnement,
  // nous autorisons le fallback pour ne pas bloquer les utilisateurs légitimes
  if (!secretKey) {
    return Response.json({
      ok: true,
      mode: 'fallback_active',
      message: 'Protection anti-bot locale active (clé Cloudflare en attente de configuration).',
    });
  }

  if (!token || typeof token !== 'string') {
    return Response.json(
      { ok: false, error: 'Veuillez valider le contrôle de sécurité anti-robot.' },
      { status: 400 }
    );
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', clientIp);

    const cfResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );

    const outcome = await cfResponse.json();

    if (!outcome.success) {
      console.warn('Échec vérification Turnstile:', outcome['error-codes']);
      return Response.json(
        {
          ok: false,
          error: 'Échec de validation de sécurité anti-robot. Veuillez recharger la page.',
          errorCodes: outcome['error-codes'],
        },
        { status: 403 }
      );
    }

    return Response.json({ ok: true, timestamp: outcome.challenge_ts });
  } catch (error: any) {
    console.error('Erreur appel Cloudflare Turnstile:', error);
    // En cas de panne de l'API externe Cloudflare, on laisse passer pour éviter le déni de service
    return Response.json({ ok: true, mode: 'service_fallback' });
  }
}
