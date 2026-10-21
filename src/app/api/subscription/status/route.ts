import { getOrderStatus } from '@/lib/server/moneriz-app';
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Rate limiting : max 60 requêtes de polling par minute par adresse IP
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`subscription-status:${clientIp}`, { maxRequests: 60, windowSeconds: 60 });
  if (!rate.success) {
    return rateLimitExceededResponse(rate.resetInSeconds);
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return Response.json({ error: 'orderId requis' }, { status: 400 });
  }

  const order = await getOrderStatus(orderId);
  if (!order) {
    return Response.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  return Response.json({
    ok: true,
    order: {
      orderId: order.orderId,
      status: order.status,
      planKey: order.planKey,
      amount: order.amount,
      currency: order.currency,
      mode: order.mode,
      storeId: order.storeId,
      updatedAt: order.updatedAt,
    },
  });
}
