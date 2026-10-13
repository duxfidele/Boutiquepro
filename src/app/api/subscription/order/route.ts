import { createSubscriptionOrder, PlanKey } from '@/lib/server/moneriz-app';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planKey, storeId, customerEmail } = body;

    if (!planKey) {
      return Response.json({ error: 'planKey est requis' }, { status: 400 });
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
