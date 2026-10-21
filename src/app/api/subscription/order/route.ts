import { createSubscriptionOrder, PlanKey } from '@/lib/server/moneriz-app';
import { supabaseServer } from '@/lib/server/supabase-server';
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Rate limiting : max 10 commandes par minute par adresse IP
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`subscription-order:${clientIp}`, { maxRequests: 10, windowSeconds: 60 });
  if (!rate.success) {
    return rateLimitExceededResponse(
      rate.resetInSeconds,
      'Trop de requêtes de commande. Veuillez patienter une minute avant de réessayer.'
    );
  }

  try {
    const body = await request.json();
    const { planKey, storeId, customerEmail } = body;

    if (!planKey) {
      return Response.json({ error: 'planKey est requis' }, { status: 400 });
    }

    // Contrôle strict d'authentification et d'autorisation côté serveur
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

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

    if (storeId) {
      const { data: member } = await supabaseServer
        .from('store_members')
        .select('role')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member || member.role !== 'admin') {
        return Response.json(
          { error: 'Action non autorisée : vous devez être administrateur de cette boutique.' },
          { status: 403 }
        );
      }
    }

    const order = await createSubscriptionOrder({
      planKey: planKey as PlanKey,
      storeId,
      customerEmail: user.email || customerEmail,
    });

    return Response.json({ ok: true, order });
  } catch (error: any) {
    console.error('Erreur création commande:', error);
    return Response.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
