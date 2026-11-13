import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, it } from "node:test";
import {
  createCleanEmptyState,
  storeReducer,
  type Product,
  type ProductBatch,
  type Sale,
} from "@/context/StoreContext";
import {
  enqueueOutboxOperation,
  generateClientUUID,
  getOutboxItem,
  getOutboxItems,
  subscribeOfflineEvents,
  updateOutboxItem,
  type OfflineBroadcastEvent,
} from "@/lib/offlineDb";
import { getOfflineSalesCount, saveOfflineSale } from "@/lib/offlineQueue";
import {
  processOutboxForScope,
  recoverStaleSyncingItems,
} from "@/lib/syncEngine";
import { installTestHarness, type TestHarness } from "./helpers/mockBrowserEnv";

let harness: TestHarness;

describe("Lot 5 — Scénarios 7, 11 & 12 : Multi-Onglets, Idempotence, Causalité & PWA", () => {
  beforeEach(() => {
    harness = installTestHarness();
  });

  it("Scénario 7 : Verrou distribué multi-onglets (Web Locks & fallback bail localStorage) + BroadcastChannel", async () => {
    const userId = "user-1";
    const storeId = "store-lock";

    await enqueueOutboxOperation({
      id: "sale:lock-1",
      idempotencyKey: "lock-1",
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440601",
      payload: {
        id: "550e8400-e29b-41d4-a716-446655440601",
        items: [],
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
        paymentMethod: "cash",
        createdAt: "2026-01-10T10:00:00.000Z",
      },
    });

    // Partie A : Web Locks API exclusive bloquant une exécution concurrente sur un autre onglet (forceAll=true pour contourner inflightScopeSync et tester le verrou Web Locks)
    harness.setWebLocksEnabled(true);
    let releaseSlowRpc!: () => void;
    const slowRpcGate = new Promise<void>((resolve) => {
      releaseSlowRpc = resolve;
    });

    let rpcCount = 0;
    harness.setRpcHandler("create_sale", async () => {
      rpcCount += 1;
      await slowRpcGate;
      return { data: "ok", error: null };
    });

    const pTab1 = processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    // Laisser Tab 1 acquérir le Web Lock et entrer dans create_sale
    for (let i = 0; i < 50 && rpcCount === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const tab2Res = await processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    assert.equal(tab2Res.skippedLocked, true, "Tab 2 bloqué par Web Lock exclusif");
    assert.equal(rpcCount, 1, "Aucun double envoi vers create_sale");

    releaseSlowRpc();
    const tab1Res = await pTab1;
    assert.equal(tab1Res.succeeded, 1);
    assert.equal(tab1Res.skippedLocked, false);

    // Partie B : Fallback bail localStorage horodaté quand navigator.locks est absent
    harness.setWebLocksEnabled(false);
    await enqueueOutboxOperation({
      id: "sale:lock-2",
      idempotencyKey: "lock-2",
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440602",
      payload: {
        id: "550e8400-e29b-41d4-a716-446655440602",
        items: [],
        subtotal: 2000,
        tax: 0,
        discount: 0,
        total: 2000,
        paymentMethod: "cash",
        createdAt: "2026-01-10T10:01:00.000Z",
      },
    });

    window.localStorage.setItem(
      `boutiquepro_sync_lock_${storeId}`,
      JSON.stringify({ owner: "foreign-tab-999", expiresAt: Date.now() + 20000 })
    );
    const blockedByLease = await processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    assert.equal(blockedByLease.skippedLocked, true);

    window.localStorage.removeItem(`boutiquepro_sync_lock_${storeId}`);
    harness.setRpcHandler("create_sale", async () => ({ data: "ok", error: null }));
    const afterLeaseFreed = await processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    assert.equal(afterLeaseFreed.succeeded, 1);

    // Partie C : BroadcastChannel inter-onglets (un canal externe écoute OUTBOX_UPDATED)
    const receivedFromOtherTab: OfflineBroadcastEvent[] = [];
    const secondTabChannel = new BroadcastChannel("boutiquepro-offline-sync");
    secondTabChannel.onmessage = (ev: MessageEvent<OfflineBroadcastEvent>) => {
      receivedFromOtherTab.push(ev.data);
    };
    const localUnsub = subscribeOfflineEvents(() => {});

    await enqueueOutboxOperation({
      id: "sale:broadcast-1",
      idempotencyKey: "broadcast-1",
      userId,
      storeId,
      opType: "ADD_CUSTOMER",
      entityType: "customer",
      entityId: "cust-bc-1",
      payload: { id: "cust-bc-1", name: "Client Broadcast", phone: "90000001", totalPurchases: 0, lastVisit: "2026-01-10" },
    });
    await new Promise((r) => setTimeout(r, 5));
    localUnsub();
    secondTabChannel.close();

    assert.ok(
      receivedFromOtherTab.some((ev) => ev.type === "OUTBOX_UPDATED" && ev.storeId === storeId),
      "Le 2e onglet reçoit OUTBOX_UPDATED via BroadcastChannel"
    );
  });

  it("Scénario 11 : Anti double-clic reducer, non double-comptage LS+IDB, coalescence UPDATE_* & crash recovery", async () => {
    const userId = "user-1";
    const storeId = "store-idem";

    const prod: Product = {
      id: "prod-idem",
      name: "Café 250g",
      sku: "CAF",
      category: "Boissons",
      price: 2500,
      cost: 1800,
      stock: 10,
      minStock: 2,
      image: "☕",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-05T08:00:00.000Z",
    };
    const batch: ProductBatch = {
      id: "batch-idem",
      storeId,
      productId: prod.id,
      batchNumber: "LOT-CAF",
      expiryDate: "2026-12-01",
      initialQuantity: 10,
      currentQuantity: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const sale: Sale = {
      id: "550e8400-e29b-41d4-a716-446655440701",
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          quantity: 2,
          unitPrice: 2500,
          total: 5000,
          unitMultiplier: 1,
          quantityReference: 2,
        },
      ],
      subtotal: 5000,
      tax: 0,
      discount: 0,
      total: 5000,
      paymentMethod: "cash",
      createdAt: "2026-01-10T14:00:00.000Z",
      userId,
      storeId,
    };

    // 1. Double-clic COMPLETE_SALE dans storeReducer -> stock et lot ne sont déduits QU'UNE SEULE FOIS (10 -> 8)
    let state = { ...createCleanEmptyState("Boutique"), products: [prod], batches: [batch] };
    state = storeReducer(state, { type: "COMPLETE_SALE", payload: sale });
    state = storeReducer(state, { type: "COMPLETE_SALE", payload: sale });
    assert.equal(state.sales.length, 1);
    assert.equal(state.products[0].stock, 8);
    assert.equal(state.batches[0].currentQuantity, 8);

    // Double-clic ADD_INVENTORY_SESSION -> écart appliqué une seule fois
    state = storeReducer(state, {
      type: "ADD_INVENTORY_SESSION",
      payload: {
        id: "inv-dup",
        date: "2026-01-10",
        totalVarianceValue: 1800,
        items: [{ productId: prod.id, productName: prod.name, expectedStock: 8, actualStock: 9, variance: 1, costPrice: 1800 }],
      },
    });
    state = storeReducer(state, {
      type: "ADD_INVENTORY_SESSION",
      payload: {
        id: "inv-dup",
        date: "2026-01-10",
        totalVarianceValue: 1800,
        items: [{ productId: prod.id, productName: prod.name, expectedStock: 8, actualStock: 9, variance: 1, costPrice: 1800 }],
      },
    });
    assert.equal(state.inventorySessions.length, 1);
    assert.equal(state.products[0].stock, 9);

    // 2. Non double-comptage LS + Outbox IDB
    await saveOfflineSale(storeId, sale);
    await saveOfflineSale(storeId, sale);
    assert.equal(await getOfflineSalesCount(storeId), 1, "Un seul élément compté même avec LS + IDB");

    // 3. Coalescence UPDATE_PRODUCT préservant expectedUpdatedAt initial
    await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_PRODUCT",
      entityType: "product",
      entityId: prod.id,
      payload: { ...prod, price: 2700 },
      expectedUpdatedAt: "2026-01-05T08:00:00.000Z",
    });
    await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_PRODUCT",
      entityType: "product",
      entityId: prod.id,
      payload: { ...prod, price: 2900 },
      expectedUpdatedAt: null,
    });

    const prodOps = await getOutboxItems({ storeId, opType: "UPDATE_PRODUCT" });
    assert.equal(prodOps.length, 1, "Mises à jour produit coalescées en une seule opération");
    assert.equal((prodOps[0].payload as Product).price, 2900);
    assert.equal(
      prodOps[0].expectedUpdatedAt,
      "2026-01-05T08:00:00.000Z",
      "Le jeton OCC initial doit être conservé lors de la coalescence"
    );

    // Coalescence UPDATE_SETTINGS
    await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_SETTINGS",
      entityType: "settings",
      entityId: storeId,
      payload: { name: "Nom V1" },
      expectedUpdatedAt: "2026-01-05T09:00:00.000Z",
    });
    await enqueueOutboxOperation({
      userId,
      storeId,
      opType: "UPDATE_SETTINGS",
      entityType: "settings",
      entityId: storeId,
      payload: { city: "Kpalimé" },
    });
    const settingsOps = await getOutboxItems({ storeId, opType: "UPDATE_SETTINGS" });
    assert.equal(settingsOps.length, 1);
    assert.deepEqual(settingsOps[0].payload, { name: "Nom V1", city: "Kpalimé" });
    assert.equal(settingsOps[0].expectedUpdatedAt, "2026-01-05T09:00:00.000Z");

    // 4. Crash recovery : opération bloquée en `syncing` après fermeture onglet
    const stuckOp = await enqueueOutboxOperation({
      id: "stuck-syncing-op",
      userId,
      storeId,
      opType: "ADD_CATEGORY",
      entityType: "category",
      entityId: "cat-crash",
      payload: { id: "cat-crash", name: "Crash Recovery", icon: "⚡", color: "#000000" },
    });
    await updateOutboxItem(stuckOp.id, { status: "syncing" });
    const recoveredCount = await recoverStaleSyncingItems(userId, storeId);
    assert.equal(recoveredCount, 1);
    assert.equal((await getOutboxItem(stuckOp.id))?.status, "pending");
  });

  it("Scénario 12 : UUIDv4 RFC 4122 en rafale, ordre causal strict, blocage prérequis & config PWA", async () => {
    const userId = "user-causal";
    const storeId = "store-causal";

    // 1. 1000 UUIDv4 en rafale sans collision et conformes RFC 4122
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const generated = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = generateClientUUID();
      assert.match(id, uuidRegex);
      generated.add(id);
    }
    assert.equal(generated.size, 1000, "Zéro collision sur 1 000 UUIDv4 en rafale");

    // 2. Ordre causal déterministe à timestamp égal via priorité métier
    const sameTs = "2026-01-10T15:00:00.000Z";
    const sessionId = generateClientUUID();
    const prodId = generateClientUUID();
    const saleId = generateClientUUID();
    const debtPayId = generateClientUUID();

    // Enfiler volontairement dans le désordre inverse
    await enqueueOutboxOperation({
      id: `cash_close:${sessionId}`,
      userId,
      storeId,
      opType: "CLOSE_CASH_SESSION",
      entityType: "cash_session",
      entityId: sessionId,
      payload: { id: sessionId, storeId, userId, openingAmount: 10000, closingAmount: 15000, openedAt: sameTs, closedAt: sameTs, status: "closed" },
      createdAt: sameTs,
    });
    await enqueueOutboxOperation({
      id: `debt:${debtPayId}`,
      userId,
      storeId,
      opType: "RECORD_DEBT_PAYMENT",
      entityType: "debt_payment",
      entityId: debtPayId,
      payload: { id: debtPayId, saleId, paymentAmount: 2000, method: "cash" },
      createdAt: sameTs,
    });
    await enqueueOutboxOperation({
      id: `sale:${saleId}`,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: saleId,
      payload: { id: saleId, items: [], subtotal: 5000, tax: 0, discount: 0, total: 5000, paymentMethod: "credit", createdAt: sameTs, sessionId },
      createdAt: sameTs,
    });
    await enqueueOutboxOperation({
      id: `prod:${prodId}`,
      userId,
      storeId,
      opType: "ADD_PRODUCT",
      entityType: "product",
      entityId: prodId,
      payload: { id: prodId, name: "Café", sku: "C", category: "A", price: 500, cost: 300, stock: 5, minStock: 1, image: "☕", createdAt: sameTs },
      createdAt: sameTs,
    });
    await enqueueOutboxOperation({
      id: `cash_open:${sessionId}`,
      userId,
      storeId,
      opType: "OPEN_CASH_SESSION",
      entityType: "cash_session",
      entityId: sessionId,
      payload: { id: sessionId, storeId, userId, openingAmount: 10000, openedAt: sameTs, status: "open" },
      createdAt: sameTs,
    });

    const execOrder: string[] = [];
    harness.setTableHandler("cash_sessions", async (ctx) => {
      if (ctx.op === "select") return { data: null, error: null };
      if (ctx.op === "upsert") {
        const rows = ctx.payload as Array<{ status?: string }>;
        execOrder.push(rows[0]?.status === "closed" ? "CLOSE_CASH_SESSION" : "OPEN_CASH_SESSION");
      }
      return { data: null, error: null };
    });
    harness.setRpcHandler("upsert_product_atomic", async () => {
      execOrder.push("ADD_PRODUCT");
      return { data: { conflict: false }, error: null };
    });
    harness.setRpcHandler("create_sale", async () => {
      execOrder.push("COMPLETE_SALE");
      return { data: saleId, error: null };
    });
    harness.setRpcHandler("record_debt_payment", async () => {
      execOrder.push("RECORD_DEBT_PAYMENT");
      return { data: null, error: null };
    });

    const causalRes = await processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    assert.equal(causalRes.succeeded, 5);
    assert.deepEqual(execOrder, [
      "OPEN_CASH_SESSION",
      "ADD_PRODUCT",
      "COMPLETE_SALE",
      "RECORD_DEBT_PAYMENT",
      "CLOSE_CASH_SESSION",
    ]);

    // 3. Blocage causal par hasUnresolvedPrerequisite si la vente à crédit échoue
    const creditSaleId = generateClientUUID();
    const blockedPayId = generateClientUUID();
    const unrelatedCustId = generateClientUUID();

    await enqueueOutboxOperation({
      id: `sale:${creditSaleId}`,
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: creditSaleId,
      payload: { id: creditSaleId, items: [], subtotal: 4000, tax: 0, discount: 0, total: 4000, paymentMethod: "credit", createdAt: "2026-01-10T16:00:00.000Z" },
      createdAt: "2026-01-10T16:00:00.000Z",
    });
    await enqueueOutboxOperation({
      id: `debt:${blockedPayId}`,
      userId,
      storeId,
      opType: "RECORD_DEBT_PAYMENT",
      entityType: "debt_payment",
      entityId: blockedPayId,
      payload: { id: blockedPayId, saleId: creditSaleId, paymentAmount: 1000, method: "cash" },
      createdAt: "2026-01-10T16:01:00.000Z",
    });
    await enqueueOutboxOperation({
      id: `cust:${unrelatedCustId}`,
      userId,
      storeId,
      opType: "ADD_CUSTOMER",
      entityType: "customer",
      entityId: unrelatedCustId,
      payload: { id: unrelatedCustId, name: "Client Indépendant", phone: "90000002", totalPurchases: 0, lastVisit: "2026-01-10" },
      createdAt: "2026-01-10T16:02:00.000Z",
    });

    let debtRpcCalledForBlocked = false;
    harness.setRpcHandler("create_sale", async () => ({
      data: null,
      error: { code: "23514", message: "stock constraint error" },
    }));
    harness.setRpcHandler("record_debt_payment", async () => {
      debtRpcCalledForBlocked = true;
      return { data: null, error: null };
    });

    const prereqRes = await processOutboxForScope({ userId, storeId, role: "admin", forceAll: true });
    assert.equal(debtRpcCalledForBlocked, false, "Le paiement de dette NE DOIT PAS être envoyé si sa vente a échoué");
    assert.equal(prereqRes.failed, 1);
    assert.equal(prereqRes.succeeded, 1, "Le client indépendant continue de passer");
    assert.equal((await getOutboxItem(`sale:${creditSaleId}`))?.status, "failed");
    assert.equal((await getOutboxItem(`debt:${blockedPayId}`))?.status, "pending");

    // 4. Vérification statique / configuration PWA (`next.config.mjs` & route `/~offline`)
    const projectRoot = process.env.BOUTIQUEPRO_PROJECT_ROOT || process.cwd();
    const nextConfigPath = path.join(projectRoot, "next.config.mjs");
    const offlinePagePath = path.join(projectRoot, "src", "app", "~offline", "page.tsx");
    assert.equal(fs.existsSync(offlinePagePath), true, "Page fallback /~offline présente");

    const nextConfigText = fs.readFileSync(nextConfigPath, "utf8");
    assert.match(nextConfigText, /reloadOnOnline:\s*false/);
    assert.match(nextConfigText, /skipWaiting:\s*false/);
    assert.match(nextConfigText, /document:\s*"\/~offline"/);
    assert.match(nextConfigText, /supabase\\\.co[\s\S]*?handler:\s*"NetworkOnly"/);
    assert.match(nextConfigText, /pathname\.startsWith\("\/api\/"\)[\s\S]*?handler:\s*"NetworkOnly"/);
    assert.match(nextConfigText, /accounts\\\.google\\\.com[\s\S]*?handler:\s*"NetworkOnly"/);
    assert.match(nextConfigText, /disable:\s*false/);

    // Vérifier aussi que l'export ESM réel de next.config.mjs charge et expose les headers /sw.js
    const nativeImport = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{
      default?: {
        headers?: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
      };
    }>;
    const mod = await nativeImport(pathToFileURL(nextConfigPath).href);
    assert.equal(typeof mod.default, "object");
    if (typeof mod.default?.headers === "function") {
      const headersConfig = await mod.default.headers();
      const swHeaderRule = headersConfig.find((r) => r.source === "/sw.js");
      assert.ok(swHeaderRule, "Règle HTTP dédiée pour /sw.js");
      assert.ok(
        swHeaderRule.headers.some(
          (h) => h.key === "Cache-Control" && h.value.includes("no-store")
        )
      );
    }
  });
});

