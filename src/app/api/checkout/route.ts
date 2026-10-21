import { createMonerizCheckout } from '@/lib/server/moneriz-checkout';
import { prepareAuthorizedCheckout, saveCheckoutSession } from '@/lib/server/moneriz-app';
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Rate limiting : max 10 tentatives de checkout par minute par adresse IP
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`checkout:${clientIp}`, { maxRequests: 10, windowSeconds: 60 });
  if (!rate.success) {
    return rateLimitExceededResponse(
      rate.resetInSeconds,
      'Trop de tentatives d\'initiation de paiement. Veuillez patienter une minute avant de réessayer.'
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !('orderId' in body) || typeof (body as any).orderId !== 'string') {
    return Response.json({ error: { code: 'ORDER_ID_REQUIRED' } }, { status: 400 });
  }

  try {
    const access = await prepareAuthorizedCheckout(request, (body as any).orderId, {
      planKey: (body as any).planKey,
      storeId: (body as any).storeId,
      customerEmail: (body as any).customerEmail,
    });
    if (!access.ok) {
      return Response.json({ error: { code: access.code } }, { status: access.status });
    }

    return await createMonerizCheckout(access.attempt, (session) =>
      saveCheckoutSession(access.attempt, session)
    );
  } catch (error) {
    return Response.json({ error: { code: 'CHECKOUT_UNAVAILABLE' } }, { status: 503 });
  }
}
