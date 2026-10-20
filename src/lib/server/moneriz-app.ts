import { supabaseServer as supabase } from './supabase-server';
import type { BrowserCheckout, CheckoutAttempt } from './moneriz-checkout';
import fs from 'node:fs';
import path from 'node:path';

import { 
  SUBSCRIPTION_PLANS, 
  PlanKey, 
  PlanConfig, 
  SubscriptionTier,
  TIER_LIMITS 
} from '@/lib/subscriptionPlans';

export type { PlanKey, PlanConfig };
export const SAAS_PLANS = SUBSCRIPTION_PLANS;

export interface StoredOrder {
  orderId: string;
  storeId?: string;
  planKey: PlanKey;
  amount: number;
  currency: 'XOF';
  mode: 'test' | 'live';
  reference: string;
  idempotencyKey: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  customerEmail?: string;
  session?: BrowserCheckout | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonerizEvent {
  id: string;
  type: string;
  createdAt: string;
  data: {
    payment?: {
      id: string;
      status: string;
      amount: number;
      currency: string;
      reference?: string;
      metadata?: Record<string, any>;
      paidAt?: string;
    };
    withdrawal?: Record<string, any>;
    late?: boolean;
  };
}

// Fichier de secours local persistant pour la résilience
const FALLBACK_DB_PATH = path.join(process.cwd(), '.moneriz_local_store.json');

function readLocalFallback(): { orders: Record<string, StoredOrder>; events: Record<string, any> } {
  try {
    if (fs.existsSync(FALLBACK_DB_PATH)) {
      const content = fs.readFileSync(FALLBACK_DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Erreur lecture fallback local Moneriz:', e);
  }
  return { orders: {}, events: {} };
}

function writeLocalFallback(data: { orders: Record<string, StoredOrder>; events: Record<string, any> }) {
  try {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erreur écriture fallback local Moneriz:', e);
  }
}

/**
 * Crée ou retrouve une commande d'abonnement avant de lancer le checkout Moneriz
 */
export async function createSubscriptionOrder(params: {
  storeId?: string;
  planKey: PlanKey;
  customerEmail?: string;
}): Promise<StoredOrder> {
  const plan = SAAS_PLANS[params.planKey] || SAAS_PLANS.pro_monthly;
  const secret = process.env.MONERIZ_SECRET_KEY || '';
  const isTest = secret.startsWith('izp_test_');
  const mode: 'test' | 'live' = isTest ? 'test' : 'live';

  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const reference = `mbp-${mode}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const idempotencyKey = `mbp-idem-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  const order: StoredOrder = {
    orderId,
    storeId: params.storeId,
    planKey: plan.id,
    amount: plan.amount,
    currency: 'XOF',
    mode,
    reference,
    idempotencyKey,
    status: 'pending',
    customerEmail: params.customerEmail,
    session: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Sauvegarde dans le fallback local
  const local = readLocalFallback();
  local.orders[orderId] = order;
  writeLocalFallback(local);

  // 2. Tentative de sauvegarde dans Supabase si la table existe
  try {
    await supabase.from('moneriz_checkout_attempts').insert({
      id: orderId,
      order_id: orderId,
      store_id: params.storeId || null,
      plan_id: plan.id,
      amount: plan.amount,
      currency: 'XOF',
      mode,
      reference,
      idempotency_key: idempotencyKey,
      status: 'pending',
      customer_email: params.customerEmail || null,
      created_at: order.createdAt,
    });
  } catch (err) {
    // Silencieux si la table Supabase n'est pas encore créée
  }

  return order;
}

/**
 * Prépare la tentative de checkout autorisée selon le contrat Moneriz
 */
export async function prepareAuthorizedCheckout(
  request: Request,
  orderId: string,
  extraParams?: { planKey?: PlanKey; storeId?: string; customerEmail?: string }
): Promise<
  | { ok: true; attempt: CheckoutAttempt }
  | { ok: false; status: 401 | 403 | 404 | 409 | 429; code: string }
> {
  if (!orderId || typeof orderId !== 'string') {
    return { ok: false, status: 404, code: 'ORDER_NOT_FOUND' };
  }

  // 1. Recherche dans le fallback local
  const local = readLocalFallback();
  let stored = local.orders[orderId];

  // 2. Recherche dans Supabase
  if (!stored) {
    try {
      const { data } = await supabase
        .from('moneriz_checkout_attempts')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (data) {
        stored = {
          orderId: data.order_id,
          storeId: data.store_id,
          planKey: data.plan_id as PlanKey,
          amount: data.amount,
          currency: 'XOF',
          mode: data.mode,
          reference: data.reference,
          idempotencyKey: data.idempotency_key,
          status: data.status,
          customerEmail: data.customer_email,
          session: data.session_id
            ? {
                id: data.session_id,
                integrationMode: 'iframe',
                checkoutUrl: data.checkout_url,
                embedUrl: data.embed_url,
              }
            : null,
          createdAt: data.created_at,
          updatedAt: data.created_at,
        };
      }
    } catch {
      // Ignorer si pas disponible
    }
  }

  if (!stored && extraParams?.planKey) {
    const plan = SAAS_PLANS[extraParams.planKey] || SAAS_PLANS.pro_monthly;
    const secret = process.env.MONERIZ_SECRET_KEY || '';
    const isTest = secret.startsWith('izp_test_');
    const mode: 'test' | 'live' = isTest ? 'test' : 'live';
    const reference = `mbp-${mode}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const idempotencyKey = `mbp-idem-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    stored = {
      orderId,
      storeId: extraParams.storeId,
      planKey: plan.id,
      amount: plan.amount,
      currency: 'XOF',
      mode,
      reference,
      idempotencyKey,
      status: 'pending',
      customerEmail: extraParams.customerEmail,
      session: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    local.orders[orderId] = stored;
    writeLocalFallback(local);
  }

  if (!stored) {
    return { ok: false, status: 404, code: 'ORDER_NOT_FOUND' };
  }

  if (stored.status === 'paid') {
    return { ok: false, status: 409, code: 'ORDER_ALREADY_PAID' };
  }

  const plan = SAAS_PLANS[stored.planKey] || SAAS_PLANS.pro_monthly;

  // Origine exacte enregistrée dans le dashboard Moneriz
  const embedOrigin = 'https://maboutiquepro.app';

  const attempt: CheckoutAttempt = {
    mode: stored.mode,
    idempotencyKey: stored.idempotencyKey,
    request: {
      amount: plan.amount,
      currency: 'XOF',
      title: plan.title,
      reference: stored.reference,
      integrationMode: 'iframe',
      embedOrigin,
      metadata: {
        orderId: stored.orderId,
        storeId: stored.storeId,
        planKey: stored.planKey,
      },
    },
    session: stored.session || null,
  };

  return { ok: true, attempt };
}

/**
 * Sauvegarde la session créée par Moneriz sur la tentative
 */
export async function saveCheckoutSession(
  attempt: CheckoutAttempt,
  session: BrowserCheckout
): Promise<void> {
  const orderId = attempt.request.metadata.orderId;

  // 1. Sauvegarde locale
  const local = readLocalFallback();
  if (local.orders[orderId]) {
    local.orders[orderId].session = session;
    local.orders[orderId].updatedAt = new Date().toISOString();
    writeLocalFallback(local);
  }

  // 2. Sauvegarde Supabase
  try {
    await supabase
      .from('moneriz_checkout_attempts')
      .update({
        session_id: session.id,
        checkout_url: session.checkoutUrl,
        embed_url: session.embedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);
  } catch (err) {
    // Silencieux
  }
}

/**
 * Valide l'enveloppe du webhook Moneriz
 */
export function parseMonerizEvent(value: unknown): MonerizEvent | null {
  if (!value || typeof value !== 'object') return null;
  const evt = value as Record<string, any>;

  if (typeof evt.id !== 'string' || !evt.id.startsWith('evt_')) {
    return null;
  }
  if (typeof evt.type !== 'string') {
    return null;
  }
  if (!evt.data || typeof evt.data !== 'object') {
    return null;
  }

  return {
    id: evt.id,
    type: evt.type,
    createdAt: typeof evt.createdAt === 'string' ? evt.createdAt : new Date().toISOString(),
    data: evt.data,
  };
}

/**
 * Enregistre l'événement dans une boîte de réception (inbox) persistante et dédoublonnée,
 * puis applique l'activation métier de l'abonnement.
 */
export async function commitMonerizInbox(event: MonerizEvent): Promise<void> {
  const local = readLocalFallback();

  // Dédoublonnage : si l'événement a déjà été traité, on acquitte immédiatement avec succès
  if (local.events[event.id]) {
    return;
  }

  // Enregistrer l'événement reçu
  local.events[event.id] = {
    receivedAt: new Date().toISOString(),
    type: event.type,
    payload: event,
    processed: false,
  };
  writeLocalFallback(local);

  // Tentative dans Supabase
  try {
    await supabase.from('moneriz_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed: false,
      payload: event,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Si la table n'existe pas encore, le fallback local est déjà actif
  }

  // Traitement métier : confirmation de paiement
  if (event.type === 'payment.succeeded') {
    const payment = event.data?.payment;
    if (payment) {
      const orderId = payment.metadata?.orderId;
      const reference = payment.reference;

      // Retrouver la commande
      let targetOrder: StoredOrder | undefined;
      for (const ord of Object.values(local.orders)) {
        if (orderId && ord.orderId === orderId) {
          targetOrder = ord;
          break;
        }
        if (reference && ord.reference === reference) {
          targetOrder = ord;
          break;
        }
      }

      // Vercel serverless: interroger Supabase si la commande n'est pas en mémoire locale
      if (!targetOrder && (orderId || reference)) {
        try {
          let query = supabase.from('moneriz_checkout_attempts').select('*');
          if (orderId) {
            query = query.eq('order_id', orderId);
          } else if (reference) {
            query = query.eq('reference', reference);
          }
          const { data: dbOrder } = await query.maybeSingle();
          if (dbOrder) {
            targetOrder = {
              orderId: dbOrder.order_id,
              storeId: dbOrder.store_id,
              planKey: dbOrder.plan_id as PlanKey,
              amount: Number(dbOrder.amount),
              currency: dbOrder.currency || 'XOF',
              mode: dbOrder.mode,
              reference: dbOrder.reference,
              idempotencyKey: dbOrder.idempotency_key,
              status: dbOrder.status,
              customerEmail: dbOrder.customer_email,
              session: null,
              createdAt: dbOrder.created_at,
              updatedAt: dbOrder.updated_at || dbOrder.created_at,
            };
          }
        } catch (dbErr) {
          console.error("Erreur interrogation moneriz_checkout_attempts:", dbErr);
        }
      }

      // Secours ultime : si non trouvée mais que les métadonnées de Moneriz ont storeId
      if (!targetOrder && (payment.metadata?.storeId || payment.metadata?.orderId)) {
        const metaStoreId = payment.metadata?.storeId;
        const metaPlanKey = (payment.metadata?.planKey as PlanKey) || 'pro_monthly';
        targetOrder = {
          orderId: orderId || payment.id,
          storeId: metaStoreId,
          planKey: metaPlanKey,
          amount: payment.amount,
          currency: (payment.currency as 'XOF') || 'XOF',
          mode: 'live',
          reference: reference || payment.id,
          idempotencyKey: payment.id,
          status: 'pending',
          session: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      if (targetOrder) {
        // Validation montant et devise
        if (payment.amount === targetOrder.amount && payment.currency === targetOrder.currency) {
          targetOrder.status = 'paid';
          targetOrder.updatedAt = new Date().toISOString();
          local.events[event.id].processed = true;
          writeLocalFallback(local);

          const plan = SAAS_PLANS[targetOrder.planKey] || SAAS_PLANS.pro_monthly;
          const durationMonths = plan.durationMonths || 1;

          // Si une boutique est rattachée, activer l'abonnement centralisé dans Supabase
          if (targetOrder.storeId) {
            try {
              // 1. Trouver le propriétaire de la boutique
              const { data: stData } = await supabase
                .from('stores')
                .select('owner_id')
                .eq('id', targetOrder.storeId)
                .maybeSingle();

              const ownerId = stData?.owner_id;

              // Règle stricte sans accumulation :
              // Dès qu'un paiement est validé, la formule démarre à l'instant du paiement
              // pour exactement 30 jours (mensuel) ou 365 jours (annuel).
              const durationDays = durationMonths === 12 ? 365 : 30;
              const now = new Date();
              const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

              if (ownerId) {

                // A. Mettre à jour l'abonnement centralisé au niveau du compte admin
                await supabase.from('admin_subscriptions').upsert({
                  user_id: ownerId,
                  plan_tier: plan.tier,
                  status: 'active',
                  billing_cycle: plan.cycle,
                  current_period_starts_at: new Date().toISOString(),
                  current_period_ends_at: endsAt.toISOString(),
                  max_stores: plan.limits.maxStores,
                  max_cashiers: plan.limits.maxCashiers,
                  updated_at: new Date().toISOString(),
                });

                // B. Enregistrer la traçabilité dans l'historique d'abonnement
                await supabase.from('subscription_history').insert({
                  user_id: ownerId,
                  new_tier: plan.tier,
                  new_status: 'active',
                  reason: 'moneriz_payment',
                  amount_paid: payment.amount,
                  currency: payment.currency || 'XOF',
                  moneriz_event_id: event.id,
                });

                // C. Mettre à jour toutes les boutiques de cet administrateur
                await supabase
                  .from('stores')
                  .update({
                    subscription_plan: plan.tier,
                    subscription_status: 'active',
                    subscription_ends_at: endsAt.toISOString(),
                  })
                  .eq('owner_id', ownerId);
              } else {
                // Repli direct par boutique si owner non encore renseigné
                await supabase
                  .from('stores')
                  .update({
                    subscription_plan: plan.tier,
                    subscription_status: 'active',
                    subscription_ends_at: endsAt.toISOString(),
                  })
                  .eq('id', targetOrder.storeId);
              }
            } catch (err) {
              console.error("Erreur mise à jour abonnement suite paiement Moneriz:", err);
            }
          }

          // Mettre à jour l'enregistrement Supabase de la tentative
          try {
            await supabase
              .from('moneriz_checkout_attempts')
              .update({
                status: 'paid',
                updated_at: new Date().toISOString(),
              })
              .eq('order_id', targetOrder.orderId);
          } catch {}
        }
      }
    }
  } else if (event.type === 'payment.failed') {
    const payment = event.data?.payment;
    const orderId = payment?.metadata?.orderId;
    if (orderId && local.orders[orderId]) {
      local.orders[orderId].status = 'failed';
      local.orders[orderId].updatedAt = new Date().toISOString();
      writeLocalFallback(local);
    }
  } else if (event.type === 'payment.expired') {
    const payment = event.data?.payment;
    const orderId = payment?.metadata?.orderId;
    if (orderId && local.orders[orderId] && local.orders[orderId].status !== 'paid') {
      local.orders[orderId].status = 'expired';
      local.orders[orderId].updatedAt = new Date().toISOString();
      writeLocalFallback(local);
    }
  }
}

/**
 * Récupère le statut d'une commande
 */
export async function getOrderStatus(orderId: string): Promise<StoredOrder | null> {
  const local = readLocalFallback();
  if (local.orders[orderId]) {
    return local.orders[orderId];
  }

  try {
    const { data } = await supabase
      .from('moneriz_checkout_attempts')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (data) {
      return {
        orderId: data.order_id,
        storeId: data.store_id,
        planKey: data.plan_id as PlanKey,
        amount: data.amount,
        currency: 'XOF',
        mode: data.mode,
        reference: data.reference,
        idempotencyKey: data.idempotency_key,
        status: data.status,
        customerEmail: data.customer_email,
        session: data.session_id
          ? {
              id: data.session_id,
              integrationMode: 'iframe',
              checkoutUrl: data.checkout_url,
              embedUrl: data.embed_url,
            }
          : null,
        createdAt: data.created_at,
        updatedAt: data.created_at,
      };
    }
  } catch {}

  return null;
}
