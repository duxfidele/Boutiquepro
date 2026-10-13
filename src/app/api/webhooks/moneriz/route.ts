import { verifyMonerizSignature } from '@/lib/server/moneriz-signature';
import { parseMonerizEvent, commitMonerizInbox } from '@/lib/server/moneriz-app';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.MONERIZ_WEBHOOK_SECRET;
  if (!secret) {
    console.error('MONERIZ_WEBHOOK_SECRET non configuré sur le serveur.');
    return new Response('Webhook secret not configured', { status: 503 });
  }

  // Ne pas appeler request.json() avant la vérification cryptographique
  const rawBody = await request.text();
  const signature = request.headers.get('X-Moneriz-Signature') ?? request.headers.get('x-moneriz-signature') ?? '';

  if (!verifyMonerizSignature(rawBody, secret, signature)) {
    console.warn('Rejet webhook Moneriz: Signature invalide ou horodatage expiré.');
    return new Response('Invalid signature', { status: 401 });
  }

  let event;
  try {
    event = parseMonerizEvent(JSON.parse(rawBody));
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  if (!event) {
    return new Response('Invalid Moneriz event structure', { status: 400 });
  }

  try {
    // Inbox persistante, dédoublonnée sur event.id
    await commitMonerizInbox(event);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Erreur traitement inbox webhook Moneriz:', error);
    // 503 afin que Moneriz retente la livraison plus tard en cas de panne
    return new Response('Storage error', { status: 503 });
  }
}
