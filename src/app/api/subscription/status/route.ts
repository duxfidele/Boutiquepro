import { getOrderStatus } from '@/lib/server/moneriz-app';
import { supabaseServer } from '@/lib/server/supabase-server';
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Rate limiting : max 60 requêtes de polling par minute par adresse IP
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`subscription-status:${clientIp}`, { maxRequests: 60, windowSeconds: 60 });
  if (!rate.success) {
    return rateLimitExceededResponse(rate.resetInSeconds);
  }

  // 1. Authentification côté serveur obligatoire (Contrôle n°6)
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return Response.json(
      { error: 'Authentification requise : token de session manquant.' },
      { status: 401 }
    );
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) {
    return Response.json(
      { error: 'Session invalide ou expirée.' },
      { status: 401 }
    );
  }

  // 2. Validation stricte de l'entrée orderId (Contrôle n°14)
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId')?.trim();

  if (!orderId || orderId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
    return Response.json({ error: 'Format orderId invalide ou manquant' }, { status: 400 });
  }

  const order = await getOrderStatus(orderId);
  if (!order) {
    return Response.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  // 3. Verrouillage par enregistrement (IDOR - Contrôle n°7) : vérifier que l'utilisateur est bien l'admin de la boutique
  if (order.storeId) {
    const { data: member } = await supabaseServer
      .from('store_members')
      .select('role')
      .eq('store_id', order.storeId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member || member.role !== 'admin') {
      return Response.json(
        { error: 'Accès non autorisé à cette commande.' },
        { status: 403 }
      );
    }
  } else if (order.customerEmail && user.email && order.customerEmail.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json(
      { error: 'Accès non autorisé à cette commande.' },
      { status: 403 }
    );
  }

  // 4. Réponse API épurée (Contrôle n°17) : uniquement les champs utiles au statut du paiement
  return Response.json({
    ok: true,
    order: {
      orderId: order.orderId,
      status: order.status,
      planKey: order.planKey,
      updatedAt: order.updatedAt,
    },
  });
}
