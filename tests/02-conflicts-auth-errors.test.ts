import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  readScopedCart,
  writeScopedCart,
  type Expense,
  type Product,
  type Quote,
  type Sale,
} from "@/context/StoreContext";
import {
  enqueueOutboxOperation,
  getOutboxCounts,
  getOutboxItem,
  getOutboxItems,
  makeScopeKey,
  markOutboxAuthPaused,
  retryOutboxItem,
  subscribeOfflineEvents,
  type OfflineBroadcastEvent,
} from "@/lib/offlineDb";
import { isAuthInvalidError } from "@/lib/networkMonitor";
import {
  processOutboxForScope,
  resolveOutboxConflict,
} from "@/lib/syncEngine";
import { installTestHarness, type TestHarness } from "./helpers/mockBrowserEnv";

let harness: TestHarness;

describe("Lot 5 — Scénarios 4, 5 & 6 : Expiration JWT, Conflits OCC & Quarantaine Erreurs", () => {
  beforeEach(() => {
    harness = installTestHarness();
  });

  it("Scénario 4 : Expiration JWT offline -> auth_paused préservant outbox + panier, puis reprise après reconnexion", async () => {
    const userId = "user-auth-test";
    const storeId = "store-A";

    const cartProduct: Product = {
      id: "prod-cart",
      name: "Sucre 1kg",
      sku: "SUC-1",
      category: "Épicerie",
      price: 800,
      cost: 600,
      stock: 50,
      minStock: 5,
      image: "🍬",
      createdAt: "2026-01-01T08:00:00.000Z",
    };
    writeScopedCart(userId, storeId, [{ product: cartProduct, quantity: 3 }]);

    const sale1: Sale = {
      id: "550e8400-e29b-41d4-a716-446655440101",
      items: [
        {
          productId: cartProduct.id,
          productName: cartProduct.name,
          quantity: 1,
          unitPrice: 800,
          total: 800,
        },
      ],
      subtotal: 800,
      tax: 0,
      discount: 0,
      total: 800,
      paymentMethod: "cash",
      createdAt: "2026-01-10T12:00:00.000Z",
      userId,
      storeId,
    };

    const exp: Expense = {
      id: "550e8400-e29b-41d4-a716-446655440102",
      date: "2026-01-10",
      category: "Loyer",
      description: "Transport marchandise",
      amount: 5000,
    };

    await enqueueOutboxOperation({
      id: `sale:${sale1.id}`,
      idempotencyKey: sale1.id,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: sale1.id,
      payload: sale1,
      createdAt: "2026-01-10T12:00:00.000Z",
    });

    await enqueueOutboxOperation({
      id: `exp:${exp.id}`,
      idempotencyKey: exp.id,
      userId,
      storeId,
      opType: "ADD_EXPENSE",
      entityType: "expense",
      entityId: exp.id,
      payload: exp,
      createdAt: "2026-01-10T12:01:00.000Z",
    });

    // Réseau présent mais jeton JWT expiré -> PGRST301 / HTTP 401
    harness.setOnline(true);
    const jwtError = { status: 401, code: "PGRST301", message: "JWT expired" };
    assert.equal(isAuthInvalidError(jwtError), true);

    harness.setRpcHandler("create_sale", async () => ({
      data: null,
      error: jwtError,
    }));

    const events: OfflineBroadcastEvent[] = [];
    const unsub = subscribeOfflineEvents((ev) => events.push(ev));

    const firstAttempt = await processOutboxForScope({
      userId,
      storeId,
      role: "admin",
      forceAll: true,
    });
    unsub();

    assert.equal(firstAttempt.authPaused, true);
    assert.equal(firstAttempt.networkOffline, false);
    assert.equal(firstAttempt.succeeded, 0);

    // Toutes les opérations restantes doivent être en `auth_paused`, aucune supprimée
    const pausedItems = await getOutboxItems({
      scopeKey: makeScopeKey(userId, storeId),
      storeId,
    });
    assert.equal(pausedItems.length, 2);
    assert.ok(pausedItems.every((i) => i.status === "auth_paused"));
    assert.ok(events.some((e) => e.type === "AUTH_PAUSED" && e.paused === true));

    // Le panier en localStorage reste intact
    assert.equal(readScopedCart(userId, storeId)[0]?.quantity, 3);

    // Tant que forceAll n'est pas appelé (session non restaurée), un cycle ordinaire ne force pas
    const skippedRes = await processOutboxForScope({
      userId,
      storeId,
      role: "admin",
      forceAll: false,
    });
    assert.equal(skippedRes.processed, 0);

    // Reconnexion de l'utilisateur -> reprise automatique
    harness.setRpcHandler("create_sale", async () => ({ data: sale1.id, error: null }));
    const resumedCount = await markOutboxAuthPaused(userId, storeId, false);
    assert.equal(resumedCount, 2);

    const resumedSync = await processOutboxForScope({
      userId,
      storeId,
      role: "admin",
    });
    assert.equal(resumedSync.succeeded, 2);
    assert.equal(resumedSync.authPaused, false);
    assert.equal((await getOutboxItems({ storeId })).length, 0);
  });

  it("Scénario 5 : Conflits multi-appareils VERSION_MISMATCH & résolution keep_server vs force_local", async () => {
    const userId = "user-admin";
    const storeId = "store-A";

    const editedProduct: Product = {
      id: "prod-conflict-1",
      name: "Lait Nido 900g",
      sku: "LAIT-900",
      category: "Alimentation",
      price: 5500,
      cost: 4100,
      stock: 15,
      minStock: 3,
      image: "🥛",
      createdAt: "2026-01-01T08:00:00.000Z",
      updatedAt: "2026-01-05T10:00:00.000Z",
    };

    const editedQuote: Quote = {
      id: "550e8400-e29b-41d4-a716-446655440202",
      storeId,
      quoteNumber: "DEV-2026-009",
      customerName: "Koffi",
      subtotal: 10000,
      tax: 0,
      discount: 0,
      total: 10000,
      status: "sent",
      createdAt: "2026-01-05T09:00:00.000Z",
      updatedAt: "2026-01-05T10:00:00.000Z",
      items: [],
    };

    const prodOp = await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_PRODUCT",
      entityType: "product",
      entityId: editedProduct.id,
      payload: editedProduct,
      expectedUpdatedAt: "2026-01-05T10:00:00.000Z",
      createdAt: "2026-01-06T09:00:00.000Z",
    });

    const quoteOp = await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_QUOTE",
      entityType: "quote",
      entityId: editedQuote.id,
      payload: editedQuote,
      expectedUpdatedAt: "2026-01-05T10:00:00.000Z",
      createdAt: "2026-01-06T09:01:00.000Z",
    });

    const settingsOp = await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_SETTINGS",
      entityType: "settings",
      entityId: storeId,
      payload: { name: "Boutique Modifiée Hors-Ligne" },
      expectedUpdatedAt: "2026-01-05T10:00:00.000Z",
      createdAt: "2026-01-06T09:02:00.000Z",
    });

    const receivedForceFlags: Array<{ fn: string; force: unknown; expected: unknown }> = [];

    harness.setRpcHandler("upsert_product_atomic", async (params) => {
      receivedForceFlags.push({
        fn: "upsert_product_atomic",
        force: params.p_force_overwrite,
        expected: params.p_expected_updated_at,
      });
      if (!params.p_force_overwrite) {
        return {
          data: {
            conflict: true,
            reason: "VERSION_MISMATCH",
            server_record: { id: editedProduct.id, price: 6000, updated_at: "2026-01-05T14:00:00.000Z" },
          },
          error: null,
        };
      }
      return { data: { conflict: false }, error: null };
    });

    harness.setRpcHandler("upsert_quote_atomic", async (params) => {
      if (!params.p_force_overwrite) {
        return {
          data: {
            conflict: true,
            reason: "QUOTE_ALREADY_CONVERTED",
            server_record: { id: editedQuote.id, status: "converted" },
          },
          error: null,
        };
      }
      return { data: { conflict: false }, error: null };
    });

    harness.setRpcHandler("upsert_store_settings_atomic", async (params) => {
      if (!params.p_force_overwrite) {
        return {
          data: {
            conflict: true,
            reason: "VERSION_MISMATCH",
            server_record: { store_id: storeId, name: "Boutique Autre Appareil" },
          },
          error: null,
        };
      }
      return { data: { conflict: false }, error: null };
    });

    const events: OfflineBroadcastEvent[] = [];
    const unsub = subscribeOfflineEvents((e) => events.push(e));
    const run = await processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    unsub();

    assert.equal(run.conflicts, 3);
    assert.equal(run.succeeded, 0);
    assert.equal(events.filter((e) => e.type === "CONFLICT_DETECTED").length, 3);

    const savedProdConflict = await getOutboxItem(prodOp.id);
    assert.equal(savedProdConflict?.status, "conflict");
    assert.equal(savedProdConflict?.conflictData?.code, "VERSION_MISMATCH");
    assert.equal(
      (savedProdConflict?.conflictData?.serverRecord as { price?: number })?.price,
      6000
    );

    const savedQuoteConflict = await getOutboxItem(quoteOp.id);
    assert.deepEqual(savedQuoteConflict?.conflictData?.resolutionOptions, [
      "keep_server",
      "dismiss",
    ]);

    // 1. Résolution "keep_server" sur le devis
    const keepRes = await resolveOutboxConflict({
      itemId: quoteOp.id,
      decision: "keep_server",
      userId,
      storeId,
      role: "admin",
    });
    assert.equal(keepRes.success, true);
    assert.equal(await getOutboxItem(quoteOp.id), null);

    // 2. Résolution "force_local" sur le produit -> p_force_overwrite: true & p_expected_updated_at: null
    // Note: resolveOutboxConflict relance processOutboxForScope (pending items uniquement) donc settingsOp reste en conflict sans bloquer!
    const forceRes = await resolveOutboxConflict({
      itemId: prodOp.id,
      decision: "force_local",
      userId,
      storeId,
      role: "admin",
    });
    assert.equal(forceRes.success, true);
    assert.equal(await getOutboxItem(prodOp.id), null);

    const lastCall = receivedForceFlags[receivedForceFlags.length - 1];
    assert.equal(lastCall.force, true);
    assert.equal(lastCall.expected, null);

    // settingsOp est toujours préservé en conflit pour décision utilisateur
    assert.equal((await getOutboxItem(settingsOp.id))?.status, "conflict");
  });

  it("Scénario 6 : Quarantaine erreurs métier / RLS / SQL / abonnement sans bloquer les ventes saines", async () => {
    const userId = "user-cashier";
    const storeId = "store-A";

    // Opération 1 : suppression produit refusée par RLS (42501) -> quarantaine immédiate
    await enqueueOutboxOperation({
      id: "op-rls-delete",
      userId,
      storeId,
      opType: "DELETE_PRODUCT",
      entityType: "product",
      entityId: "prod-protected",
      payload: { id: "prod-protected" },
      createdAt: "2026-01-10T10:00:00.000Z",
    });

    // Opération 2 : dépense refusée par contrainte SQL CHECK (23514) -> quarantaine immédiate
    await enqueueOutboxOperation({
      id: "op-sql-check",
      userId,
      storeId,
      opType: "ADD_EXPENSE",
      entityType: "expense",
      entityId: "550e8400-e29b-41d4-a716-446655440301",
      payload: {
        id: "550e8400-e29b-41d4-a716-446655440301",
        date: "2026-01-10",
        category: "Autre",
        description: "Invalide",
        amount: -10,
      },
      createdAt: "2026-01-10T10:01:00.000Z",
    });

    // Opération 3 : vente bloquée par abonnement expiré (P0001) -> quarantaine puis retry manuel possible
    await enqueueOutboxOperation({
      id: "op-sub-expired",
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440302",
      payload: {
        id: "550e8400-e29b-41d4-a716-446655440302",
        items: [],
        subtotal: 1500,
        tax: 0,
        discount: 0,
        total: 1500,
        paymentMethod: "cash",
        createdAt: "2026-01-10T10:02:00.000Z",
      },
      createdAt: "2026-01-10T10:02:00.000Z",
    });

    // Opération 4 : vente saine indépendante -> DOIT passer dans le même cycle malgré les 3 échecs !
    await enqueueOutboxOperation({
      id: "op-valid-sale",
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440303",
      payload: {
        id: "550e8400-e29b-41d4-a716-446655440303",
        items: [],
        subtotal: 5000,
        tax: 0,
        discount: 0,
        total: 5000,
        paymentMethod: "cash",
        createdAt: "2026-01-10T10:03:00.000Z",
      },
      createdAt: "2026-01-10T10:03:00.000Z",
    });

    // Opération 5 : erreur transitoire inconnue -> plafonnée après 3 essais (`failed`)
    await enqueueOutboxOperation({
      id: "op-transient",
      userId,
      storeId,
      opType: "ADD_CUSTOMER",
      entityType: "customer",
      entityId: "550e8400-e29b-41d4-a716-446655440304",
      payload: {
        id: "550e8400-e29b-41d4-a716-446655440304",
        name: "Client Test",
        phone: "90000000",
        totalPurchases: 0,
        lastVisit: "2026-01-10T10:04:00.000Z",
      },
      createdAt: "2026-01-10T10:04:00.000Z",
    });

    harness.setTableHandler("products", async (ctx) => {
      if (ctx.op === "delete") {
        return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
      }
      return { data: [], error: null };
    });

    harness.setTableHandler("expenses", async (ctx) => {
      if (ctx.op === "upsert") {
        return { data: null, error: { code: "23514", message: "expenses_amount_check violated" } };
      }
      return { data: [], error: null };
    });

    harness.setTableHandler("customers", async (ctx) => {
      if (ctx.op === "upsert") {
        return { data: null, error: { code: "40001", message: "could not serialize access" } };
      }
      return { data: [], error: null };
    });

    harness.setRpcHandler("create_sale", async (params) => {
      if (params.p_sale_id === "550e8400-e29b-41d4-a716-446655440302") {
        return { data: null, error: { code: "P0001", message: "Abonnement expiré pour cette boutique" } };
      }
      return { data: params.p_sale_id, error: null };
    });

    const res1 = await processOutboxForScope({ userId, storeId, role: "cashier", forceAll: true });
    assert.equal(res1.succeeded, 1, "La vente saine passe malgré les erreurs antérieures");
    assert.equal(res1.failed, 4);

    assert.equal((await getOutboxItem("op-rls-delete"))?.status, "failed");
    assert.equal((await getOutboxItem("op-sql-check"))?.status, "failed");
    assert.equal((await getOutboxItem("op-sub-expired"))?.status, "failed");
    assert.equal(await getOutboxItem("op-valid-sale"), null, "Vente saine supprimée de l'outbox");
    assert.equal((await getOutboxItem("op-transient"))?.status, "pending", "Erreur transitoire réessayable < 3 essais");

    // 2e et 3e essais transitoires -> bascule définitive en quarantaine `failed` (MAX_DETERMINISTIC_RETRIES = 3)
    await processOutboxForScope({ userId, storeId, role: "cashier", forceAll: true });
    await processOutboxForScope({ userId, storeId, role: "cashier", forceAll: true });
    assert.equal((await getOutboxItem("op-transient"))?.status, "failed");
    assert.equal((await getOutboxItem("op-transient"))?.errorCode, "MAX_RETRIES_EXCEEDED");

    // Après renouvellement d'abonnement, retryOutboxItem permet de débloquer et réussir `op-sub-expired`
    harness.setRpcHandler("create_sale", async (params) => ({ data: params.p_sale_id, error: null }));
    await retryOutboxItem("op-sub-expired");
    const counts = await getOutboxCounts({ storeId });
    assert.equal(counts.pending, 1);
    assert.equal(counts.failed, 3);

    const retryRun = await processOutboxForScope({ userId, storeId, role: "cashier", forceAll: true });
    assert.equal(retryRun.succeeded, 1);
    assert.equal(await getOutboxItem("op-sub-expired"), null);
  });
});

