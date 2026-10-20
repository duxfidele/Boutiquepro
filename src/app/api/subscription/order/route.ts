import { createSubscriptionOrder, PlanKey } from '@/lib/server/moneriz-app';
import { supabaseServer } from '@/lib/server/supabase-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planKey, storeId, customerEmail } = body;

    if (!planKey) {
      return Response.json({ error: 'planKey est requis' }, { status: 400 });
    }

    // Contrôle strict de propriété côté serveur : vérifier que l'appelant est admin
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token) {
      const { data: { user } } = await supabaseServer.auth.getUser(token);
      if (user && storeId) {
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
    }

    const order = await createSubscriptionOrder({
      planKey: planKey as PlanKey,
      storeId,
      customerEmail,
    });

    return Response.json({ ok: true, order });
  } catch (error: any) {
    console.error('Erreur création commande:', error);
    return Response.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
