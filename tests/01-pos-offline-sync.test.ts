import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  createCleanEmptyState,
  readScopedCart,
  storeReducer,
  writeScopedCart,
  type Product,
  type ProductBatch,
  type Sale,
  type StoreState,
} from "@/context/StoreContext";
import {
  enqueueOutboxOperation,
  getOutboxCounts,
  getOutboxItems,
  getStoreSnapshot,
  makeScopeKey,
  markOutboxAuthPaused,
  migrateLegacyOfflineStorage,
  openOfflineDB,
  saveStoreSnapshot,
} from "@/lib/offlineDb";
import {
  getNetworkHealthSnapshot,
  isAuthInvalidError,
  isCaptivePortalOrParseError,
  probeServerHealth,
} from "@/lib/networkMonitor";
import {
  isNetworkLikeError,
  saveOfflineSale,
  withNetworkTimeout,
} from "@/lib/offlineQueue";
import {
  computeExponentialBackoffMs,
  processOutboxForScope,
  pullStoreIncrementalDelta,
} from "@/lib/syncEngine";
import { installTestHarness, type TestHarness } from "./helpers/mockBrowserEnv";

let harness: TestHarness;

function sampleProduct(overrides?: Partial<Product>): Product {
  return {
    id: "prod-1",
    name: "Riz Parfumé 5kg",
    sku: "RIZ-5KG",
    category: "Alimentation",
    price: 4500,
    cost: 3500,
    stock: 20,
    minStock: 5,
    image: "🍚",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    storeId: "store-A",
    userId: "user-1",
    ...overrides,
  };
}

describe("Lot 5 — Scénarios 1, 2 & 3 : POS Offline, Coupure Réseau & Reconcialiation", () => {
  beforeEach(() => {
    harness = installTestHarness();
  });

  it("Scénario 1 : Vente POS offline + FEFO + migration v1->v2 + survie au rechargement F5", async () => {
    const userId = "user-1";
    const storeId = "store-A";
    const prod = sampleProduct({ stock: 12 });
    const batches: ProductBatch[] = [
      {
        id: "batch-late",
        storeId,
        productId: prod.id,
        batchNumber: "LOT-2027",
        expiryDate: "2027-06-01",
        initialQuantity: 10,
        currentQuantity: 8,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "batch-early",
        storeId,
        productId: prod.id,
        batchNumber: "LOT-2026",
        expiryDate: "2026-03-01",
        initialQuantity: 5,
        currentQuantity: 4,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    // Pré-semer une base v1 (`pending_sales`) pour vérifier la migration sans perte
    const legacySale: Sale = {
      id: "legacy-sale-v1",
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unitPrice: 4500,
          total: 4500,
        },
      ],
      subtotal: 4500,
      tax: 0,
      discount: 0,
      total: 4500,
      paymentMethod: "cash",
      createdAt: "2026-01-09T09:00:00.000Z",
      storeId,
      userId,
    };
    harness.seedV1DatabaseWithPendingSales([
      {
        id: legacySale.id,
        storeId,
        sale: legacySale,
        createdAt: legacySale.createdAt,
        retryCount: 0,
        status: "pending",
      },
    ]);

    // Passage hors-ligne complet
    harness.setOnline(false);

    // Ouverture IDB v2 -> upgrade schema + migration v1 -> outbox v2
    await openOfflineDB();
    const mig = await migrateLegacyOfflineStorage({ userId, storeId, role: "admin" });
    assert.equal(mig.migratedSales, 1, "La vente v1 doit être migrée sans perte");

    // Panier en cours avant encaissement sauvegardé isolément
    let state: StoreState = {
      ...createCleanEmptyState("Boutique A"),
      products: [prod],
      batches,
    };
    state = storeReducer(state, { type: "ADD_TO_CART", payload: prod });
    writeScopedCart(userId, storeId, state.cart);
    assert.equal(readScopedCart(userId, storeId).length, 1);

    // Encaissement de 6 unités hors-ligne -> doit consommer d'abord LOT-2026 (4) puis LOT-2027 (2)
    const newSale: Sale = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          quantity: 6,
          unitPrice: 4500,
          total: 27000,
          unitMultiplier: 1,
          quantityReference: 6,
        },
      ],
      subtotal: 27000,
      tax: 0,
      discount: 0,
      total: 27000,
      paymentMethod: "cash",
      amountPaid: 27000,
      remainingAmount: 0,
      paymentStatus: "paid",
      createdAt: "2026-01-10T10:00:00.000Z",
      userId,
      storeId,
    };

    state = storeReducer(state, { type: "COMPLETE_SALE", payload: newSale });
    assert.equal(state.cart.length, 0, "Le panier doit être vidé après vente");
    assert.equal(state.products[0].stock, 6, "Stock local déduit instantanément (12 - 6)");

    const earlyBatch = state.batches.find((b) => b.id === "batch-early");
    const lateBatch = state.batches.find((b) => b.id === "batch-late");
    assert.equal(earlyBatch?.currentQuantity, 0, "FEFO: lot le plus proche péremption vidé en premier");
    assert.equal(lateBatch?.currentQuantity, 6, "FEFO: surplus prélevé sur lot suivant (8 - 2)");

    await enqueueOutboxOperation({
      id: `sale:${newSale.id}`,
      idempotencyKey: newSale.id,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: newSale.id,
      payload: newSale,
      createdAt: newSale.createdAt,
    });
    await saveStoreSnapshot({ userId, storeId, role: "admin", state });
    writeScopedCart(userId, storeId, state.cart);

    // Simuler un rechargement complet F5 (purge connexion DB en mémoire)
    harness.simulatePageReload();

    const restoredSnap = await getStoreSnapshot(userId, storeId);
    assert.ok(restoredSnap, "Snapshot IDB restauré après F5");
    assert.equal(restoredSnap.state.sales.length, 1);
    assert.equal(restoredSnap.state.sales[0].id, newSale.id);
    assert.equal(restoredSnap.state.products[0].stock, 6);
    assert.equal(readScopedCart(userId, storeId).length, 0);

    const outboxAfterF5 = await getOutboxItems({
      scopeKey: makeScopeKey(userId, storeId),
      storeId,
      includeLegacyUserForStore: true,
    });
    assert.equal(outboxAfterF5.length, 2, "Vente v1 migrée + vente v2 toutes deux conservées");
  });

  it("Scénario 2 : Coupure réseau brutale, faux en-ligne, Safari Load failed & backoff non-bloquant", async () => {
    const userId = "user-1";
    const storeId = "store-A";

    // Vérification taxonomie réseau exhaustive (Chrome, Safari iOS, Abort, 502/503/504)
    assert.equal(isNetworkLikeError(new Error("TypeError: Load failed")), true);
    assert.equal(isNetworkLikeError(new Error("Failed to fetch")), true);
    assert.equal(isNetworkLikeError({ name: "AbortError", message: "aborted" }), true);
    assert.equal(isNetworkLikeError({ status: 503, message: "Service Unavailable" }), true);
    assert.equal(isNetworkLikeError({ status: 401, code: "PGRST301", message: "JWT expired" }), false);

    // Faux en-ligne : promesse bloquée coupée rapidement par withNetworkTimeout
    await assert.rejects(
      withNetworkTimeout(new Promise(() => {}), 35),
      /NETWORK_TIMEOUT/
    );

    // Portail captif Wi-Fi renvoyant du HTML au lieu de JSON lors du ping_health
    const captiveErr = new SyntaxError("Unexpected token '<', \"<html>...\" is not valid JSON");
    assert.equal(isCaptivePortalOrParseError(captiveErr), true);
    harness.setOnline(true);
    harness.setRpcHandler("ping_health", async () => ({
      data: null,
      error: captiveErr,
    }));

    const probe = await probeServerHealth({ timeoutMs: 500, force: true });
    assert.equal(probe.status, "offline");
    assert.equal(probe.isReachable, false);
    assert.equal(getNetworkHealthSnapshot().isReachable, false);

    // Perte réseau en plein encaissement (Safari Load failed pendant create_sale)
    const sale: Sale = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      items: [
        {
          productId: "prod-1",
          productName: "Huile 1L",
          quantity: 2,
          unitPrice: 1200,
          total: 2400,
        },
      ],
      subtotal: 2400,
      tax: 0,
      discount: 0,
      total: 2400,
      paymentMethod: "cash",
      createdAt: "2026-01-10T10:05:00.000Z",
      storeId,
      userId,
    };
    await enqueueOutboxOperation({
      id: `sale:${sale.id}`,
      idempotencyKey: sale.id,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: sale.id,
      payload: sale,
      createdAt: sale.createdAt,
    });

    harness.setRpcHandler("create_sale", async () => {
      throw new TypeError("Load failed");
    });

    const syncRes = await processOutboxForScope({
      userId,
      storeId,
      role: "cashier",
      forceAll: true,
    });

    assert.equal(syncRes.networkOffline, true);
    assert.equal(syncRes.succeeded, 0);
    const items = await getOutboxItems({ storeId });
    assert.equal(items.length, 1);
    assert.equal(items[0].status, "pending", "Reste en pending pour reprise ultérieure");
    assert.equal(items[0].retryCount, 1);
    assert.ok(Date.parse(items[0].nextRetryAt) > Date.now(), "Backoff futur planifié");

    // Backoff exponentiel borné à 5 min (±20% jitter)
    const b1 = computeExponentialBackoffMs(1);
    const b10 = computeExponentialBackoffMs(10);
    assert.ok(b1 >= 1500 && b1 <= 2600);
    assert.ok(b10 <= 360000);
  });

  it("Scénario 3 : Offline prolongé -> Reconnexion Push-Before-Pull, idempotence 23505 & Bouclier Outbox", async () => {
    const userId = "user-1";
    const storeId = "store-A";

    // État initial serveur connu : stock = 10 unités
    const initialProd = sampleProduct({ id: "prod-shield", stock: 10 });
    const sAlreadyOnServer: Sale = {
      id: "550e8400-e29b-41d4-a716-446655440010",
      items: [
        {
          productId: initialProd.id,
          productName: initialProd.name,
          quantity: 3,
          unitPrice: 4500,
          total: 13500,
          unitMultiplier: 1,
          quantityReference: 3,
        },
      ],
      subtotal: 13500,
      tax: 0,
      discount: 0,
      total: 13500,
      paymentMethod: "cash",
      createdAt: "2026-01-10T11:00:00.000Z",
      storeId,
      userId,
    };

    const sPendingOffline: Sale = {
      id: "550e8400-e29b-41d4-a716-446655440011",
      items: [
        {
          productId: initialProd.id,
          productName: initialProd.name,
          quantity: 2,
          unitPrice: 4500,
          total: 9000,
          unitMultiplier: 1,
          quantityReference: 2,
        },
      ],
      subtotal: 9000,
      tax: 0,
      discount: 0,
      total: 9000,
      paymentMethod: "cash",
      createdAt: "2026-01-10T11:05:00.000Z",
      storeId,
      userId,
    };

    await enqueueOutboxOperation({
      id: `sale:${sAlreadyOnServer.id}`,
      idempotencyKey: sAlreadyOnServer.id,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: sAlreadyOnServer.id,
      payload: sAlreadyOnServer,
      createdAt: sAlreadyOnServer.createdAt,
    });
    await enqueueOutboxOperation({
      id: `sale:${sPendingOffline.id}`,
      idempotencyKey: sPendingOffline.id,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: sPendingOffline.id,
      payload: sPendingOffline,
      createdAt: sPendingOffline.createdAt,
    });

    // Le serveur a déjà reçu sAlreadyOnServer (stock serveur = 7), mais pas encore sPendingOffline
    harness.setTableRows("products", [
      {
        id: initialProd.id,
        store_id: storeId,
        user_id: userId,
        name: initialProd.name,
        sku: initialProd.sku,
        category: initialProd.category,
        price: 4500,
        stock: 7,
        min_stock: 5,
        image: "🍚",
        created_at: initialProd.createdAt,
        updated_at: "2026-01-10T11:01:00.000Z",
      },
    ]);
    harness.setTableRows("sales", [
      {
        id: sAlreadyOnServer.id,
        store_id: storeId,
        user_id: userId,
        subtotal: 13500,
        tax: 0,
        discount: 0,
        total: 13500,
        payment_method: "cash",
        amount_paid: 13500,
        remaining_amount: 0,
        payment_status: "paid",
        created_at: sAlreadyOnServer.createdAt,
        items: [
          {
            id: "si-1",
            product_id: initialProd.id,
            product_name: initialProd.name,
            quantity: 3,
            unit_price: 4500,
            total: 13500,
          },
        ],
      },
    ]);

    // Vérifier le BOUCLIER OUTBOX lors d'un pull avant push complet :
    // sPendingOffline étant encore en outbox et absente de serverSales, stock doit être protégé à 7 - 2 = 5
    const shieldedPull = await pullStoreIncrementalDelta({
      userId,
      storeId,
      storeName: "Boutique A",
      role: "cashier",
      currentState: { ...createCleanEmptyState("Boutique A"), products: [{ ...initialProd, stock: 5 }] },
    });
    assert.equal(
      shieldedPull.state.products.find((p) => p.id === initialProd.id)?.stock,
      5,
      "Le bouclier anti-écrasement déduit la vente locale non poussée (7 - 2 = 5)"
    );
    assert.equal(shieldedPull.state.sales.length, 2, "Les deux ventes restent visibles localement");

    // Reconnexion : Push-Before-Pull -> sAlreadyOnServer renvoie 23505 (idempotent!), sPendingOffline réussit
    const seenSaleIds: string[] = [];
    harness.setRpcHandler("create_sale", async (params) => {
      const sid = String(params.p_sale_id);
      seenSaleIds.push(sid);
      if (sid === sAlreadyOnServer.id) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint sales_pkey" },
        };
      }
      return { data: sid, error: null };
    });

    // Garder legacy sales mirror pour vérifier nettoyage post-sync
    await saveOfflineSale(storeId, sPendingOffline);
    assert.equal(isAuthInvalidError({ code: "23505" }), false);

    const pushRes = await processOutboxForScope({
      userId,
      storeId,
      role: "cashier",
      forceAll: true,
    });
    assert.equal(pushRes.succeeded, 2, "23505 traité comme succès idempotent + seconde vente poussée");
    assert.equal(pushRes.failed, 0);
    assert.deepEqual(seenSaleIds, [sAlreadyOnServer.id, sPendingOffline.id]);

    const countsAfter = await getOutboxCounts({
      scopeKey: makeScopeKey(userId, storeId),
      storeId,
    });
    assert.equal(countsAfter.actionableTotal, 0, "Outbox vidée proprement après synchronisation");
  });
});
