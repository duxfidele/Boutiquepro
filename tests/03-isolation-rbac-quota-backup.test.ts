import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  createCleanEmptyState,
  readScopedCart,
  writeScopedCart,
  type Product,
  type StoreState,
} from "@/context/StoreContext";
import {
  appendSyncLog,
  clearSensitiveSnapshotsForUser,
  enqueueOutboxOperation,
  exportStoreOfflineBackup,
  getLastStorageError,
  getOutboxItems,
  getStorageDiagnostics,
  getStoreSnapshot,
  getSyncLogs,
  importStoreOfflineBackup,
  makeScopeKey,
  pruneOldSyncLogs,
  sanitizeSnapshotStateForRole,
  saveStoreSnapshot,
  saveSyncCursor,
  STORE_SYNC_LOGS,
} from "@/lib/offlineDb";
import { pullStoreIncrementalDelta } from "@/lib/syncEngine";
import { installTestHarness, type TestHarness } from "./helpers/mockBrowserEnv";

let harness: TestHarness;

describe("Lot 5 — Scénarios 8, 9 & 10 : Isolation Multi-Tenant, RBAC Caissier, Quota & Backup", () => {
  beforeEach(() => {
    harness = installTestHarness();
  });

  it("Scénario 8 : Isolation stricte userId:storeId (boutiques A/B, utilisateurs 1/2) & purge déconnexion", async () => {
    const prodA: Product = {
      id: "p-storeA",
      name: "Article Boutique A",
      sku: "A1",
      category: "A",
      price: 1000,
      cost: 700,
      stock: 10,
      minStock: 2,
      image: "🅰️",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const prodB: Product = {
      id: "p-storeB",
      name: "Article Boutique B",
      sku: "B1",
      category: "B",
      price: 2000,
      cost: 1500,
      stock: 20,
      minStock: 2,
      image: "🅱️",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const stateA: StoreState = { ...createCleanEmptyState("Boutique A"), products: [prodA] };
    const stateB: StoreState = { ...createCleanEmptyState("Boutique B"), products: [prodB] };

    // Enregistrer snapshots, paniers et outbox pour User1:StoreA, User1:StoreB et User2:StoreA
    await saveStoreSnapshot({ userId: "user-1", storeId: "store-A", role: "admin", state: stateA });
    await saveStoreSnapshot({ userId: "user-1", storeId: "store-B", role: "admin", state: stateB });
    await saveStoreSnapshot({ userId: "user-2", storeId: "store-A", role: "cashier", state: stateA });

    writeScopedCart("user-1", "store-A", [{ product: prodA, quantity: 4 }]);
    writeScopedCart("user-1", "store-B", [{ product: prodB, quantity: 2 }]);
    writeScopedCart("user-2", "store-A", []);

    await enqueueOutboxOperation({
      id: "u1-sale-A",
      userId: "user-1",
      storeId: "store-A",
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440401",
      payload: { id: "550e8400-e29b-41d4-a716-446655440401", total: 1000 },
    });

    await saveSyncCursor({
      userId: "user-1",
      storeId: "store-A",
      entityTable: "products",
      lastSyncedAt: "2026-01-10T10:00:00.000Z",
    });

    // Bascule Boutique A -> Boutique B : aucune fuite de Boutique A dans B
    const snapB = await getStoreSnapshot("user-1", "store-B");
    assert.equal(snapB?.state.products.length, 1);
    assert.equal(snapB?.state.products[0].id, "p-storeB");
    assert.equal(readScopedCart("user-1", "store-B")[0].product.id, "p-storeB");

    // Bascule User1 -> User2 sur Store A : aucune fuite du panier ni des opérations privées
    assert.equal(readScopedCart("user-2", "store-A").length, 0);
    const user2Outbox = await getOutboxItems({
      scopeKey: makeScopeKey("user-2", "store-A"),
      storeId: "store-A",
      includeLegacyUserForStore: true,
    });
    assert.equal(user2Outbox.length, 0, "User 2 ne reçoit pas l'outbox scopée de User 1");

    // Déconnexion User 1 -> clearSensitiveSnapshotsForUser supprime les snapshots User 1 mais préserve User 2 ET toute l'outbox !
    const removedCount = await clearSensitiveSnapshotsForUser("user-1");
    assert.equal(removedCount, 2);
    assert.equal(await getStoreSnapshot("user-1", "store-A"), null);
    assert.equal(await getStoreSnapshot("user-1", "store-B"), null);
    assert.ok(await getStoreSnapshot("user-2", "store-A"), "Snapshot User 2 préservé");

    const user1OutboxAfterSignout = await getOutboxItems({
      scopeKey: makeScopeKey("user-1", "store-A"),
      storeId: "store-A",
    });
    assert.equal(
      user1OutboxAfterSignout.length,
      1,
      "La déconnexion ne détruit JAMAIS les opérations non synchronisées de l'outbox"
    );
  });

  it("Scénario 9 : Isolation RBAC Caissier -> zéro coût d'achat, marge, commande ou dépense en local IDB", async () => {
    const storeId = "store-rbac";
    const cashierId = "user-cashier";
    const adminId = "user-admin";

    // Remplir le serveur avec des données sensibles complètes
    harness.setTableRows("settings", [
      { store_id: storeId, name: "Boutique RBAC", currency: "FCFA", tax_rate: 0 },
    ]);
    harness.setTableRows("categories", [
      { id: "cat1", store_id: storeId, name: "Boissons", icon: "🥤", color: "#6343EA" },
    ]);
    harness.setTableRows("products", [
      {
        id: "prod-rbac-1",
        store_id: storeId,
        name: "Jus Ananas",
        sku: "JUS-1",
        category: "Boissons",
        price: 1500,
        stock: 30,
        min_stock: 5,
        image: "🍍",
        created_at: "2026-01-01T08:00:00.000Z",
      },
    ]);
    harness.setTableRows("product_units", [
      {
        id: "unit-1",
        store_id: storeId,
        product_id: "prod-rbac-1",
        name: "Pack 6",
        multiplier: 6,
        price: 8400,
        cost: 5900,
        is_reference: false,
      },
    ]);
    harness.setTableRows("product_costs", [
      { store_id: storeId, product_id: "prod-rbac-1", cost: 1050 },
    ]);
    harness.setTableRows("sale_item_costs", [
      { store_id: storeId, sale_item_id: "si-rbac-1", sale_id: "sale-rbac-1", unit_cost: 1050, is_estimated: false },
    ]);
    harness.setTableRows("sales", [
      {
        id: "sale-rbac-1",
        store_id: storeId,
        subtotal: 1500,
        tax: 0,
        discount: 0,
        total: 1500,
        payment_method: "cash",
        created_at: "2026-01-09T10:00:00.000Z",
        items: [
          { id: "si-rbac-1", product_id: "prod-rbac-1", product_name: "Jus Ananas", quantity: 1, unit_price: 1500, total: 1500 },
        ],
      },
    ]);
    harness.setTableRows("orders", [
      { id: "ord-secret", store_id: storeId, supplier_name: "Fournisseur Secret", total_cost: 250000, status: "pending", created_at: "2026-01-08T00:00:00.000Z", items: [] },
    ]);
    harness.setTableRows("expenses", [
      { id: "exp-secret", store_id: storeId, date: "2026-01-08", category: "Salaire", description: "Salaire gérant", amount: 150000 },
    ]);
    harness.setTableRows("inventory_sessions", [
      { id: "inv-secret", store_id: storeId, date: "2026-01-08", total_variance_value: -15000, items: [] },
    ]);
    harness.setTableRows("product_price_history", [
      { id: "ph-cost", store_id: storeId, product_id: "prod-rbac-1", price_type: "cost", old_price: 900, new_price: 1050, created_at: "2026-01-05T00:00:00.000Z" },
      { id: "ph-sell", store_id: storeId, product_id: "prod-rbac-1", price_type: "selling", old_price: 1400, new_price: 1500, created_at: "2026-01-06T00:00:00.000Z" },
    ]);

    // 1. Pull en tant que CAISSIER
    await pullStoreIncrementalDelta({
      userId: cashierId,
      storeId,
      storeName: "Boutique RBAC",
      role: "cashier",
      currentState: createCleanEmptyState("Boutique RBAC"),
      forceFull: true,
    });

    // Vérifier qu'aucune table sensible n'a même été requêtée par le caissier
    const queriedTables = new Set(harness.getTableCalls().map((c) => c.table));
    assert.equal(queriedTables.has("orders"), false);
    assert.equal(queriedTables.has("expenses"), false);
    assert.equal(queriedTables.has("inventory_sessions"), false);
    assert.equal(queriedTables.has("product_costs"), false);
    assert.equal(queriedTables.has("sale_item_costs"), false);

    // Vérifier le contenu exact du snapshot persisté en IndexedDB pour le caissier
    const cashierSnap = await getStoreSnapshot(cashierId, storeId);
    assert.ok(cashierSnap);
    assert.equal(cashierSnap.state.products[0].cost, 0);
    assert.equal(cashierSnap.state.products[0].units?.[0].cost, null);
    assert.equal(cashierSnap.state.sales[0].items[0].cost, undefined);
    assert.equal(cashierSnap.state.orders.length, 0);
    assert.equal(cashierSnap.state.expenses.length, 0);
    assert.equal(cashierSnap.state.inventorySessions.length, 0);
    assert.ok(cashierSnap.state.priceHistory.every((h) => h.priceType !== "cost"));
    assert.equal(cashierSnap.state.priceHistory.length, 1, "Historique de prix de vente conservé");

    // Vérifier aussi sanitizeSnapshotStateForRole défensif sur un état sale complet
    const dirtyAdminState: StoreState = {
      ...createCleanEmptyState("Boutique RBAC"),
      products: [{ ...cashierSnap.state.products[0], cost: 1050, units: [{ id: "u1", storeId, productId: "p1", name: "Pack", multiplier: 6, cost: 5900, isReference: false }] }],
      orders: [{ id: "o1", supplierName: "Secret", items: [], totalCost: 50000, status: "pending", createdAt: "2026-01-01" }],
      expenses: [{ id: "e1", date: "2026-01-01", category: "Loyer", description: "Secret", amount: 90000 }],
      inventorySessions: [{ id: "i1", date: "2026-01-01", totalVarianceValue: -5000, items: [{ productId: "p1", productName: "Jus", expectedStock: 5, actualStock: 4, variance: -1, costPrice: 1050 }] }],
    };
    const cleaned = sanitizeSnapshotStateForRole(dirtyAdminState, "cashier");
    assert.equal(cleaned.products[0].cost, 0);
    assert.equal(cleaned.products[0].units?.[0].cost, null);
    assert.equal(cleaned.orders.length, 0);
    assert.equal(cleaned.expenses.length, 0);
    assert.equal(cleaned.inventorySessions[0].totalVarianceValue, 0);
    assert.equal(cleaned.inventorySessions[0].items[0].costPrice, 0);

    // 2. Comparaison avec pull ADMIN : toutes les données financières sont présentes
    harness.clearCallLogs();
    await pullStoreIncrementalDelta({
      userId: adminId,
      storeId,
      storeName: "Boutique RBAC",
      role: "admin",
      currentState: createCleanEmptyState("Boutique RBAC"),
      forceFull: true,
    });
    const adminSnap = await getStoreSnapshot(adminId, storeId);
    assert.equal(adminSnap?.state.products[0].cost, 1050);
    assert.equal(adminSnap?.state.orders.length, 1);
    assert.equal(adminSnap?.state.expenses.length, 1);
  });

  it("Scénario 10 : Quota IndexedDB (prune logs sans perte outbox) & Backup JSON avec Checksum FNV-64", async () => {
    const userId = "user-admin";
    const storeId = "store-backup";

    // Enfiler 2 opérations critiques + plusieurs logs `info` et `error`
    await enqueueOutboxOperation({
      id: "sale-backup-1",
      idempotencyKey: "sale-backup-1",
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440501",
      payload: { id: "550e8400-e29b-41d4-a716-446655440501", total: 12000 },
    });
    await enqueueOutboxOperation({
      id: "sale-backup-2",
      idempotencyKey: "sale-backup-2",
      userId,
      storeId,
      opType: "COMPLETE_SALE",
      entityType: "sale",
      entityId: "550e8400-e29b-41d4-a716-446655440502",
      payload: { id: "550e8400-e29b-41d4-a716-446655440502", total: 8000 },
    });

    for (let i = 0; i < 6; i++) {
      await appendSyncLog({
        userId,
        storeId,
        level: i % 2 === 0 ? "info" : "error",
        message: `Log #${i}`,
      });
    }

    // Rotation manuelle à 3 logs -> supprime les logs `info` en priorité et garde l'outbox intacte
    const deletedLogs = await pruneOldSyncLogs(3);
    assert.equal(deletedLogs, 3);
    const remainingLogs = await getSyncLogs({ storeId });
    assert.equal(remainingLogs.length, 3);
    assert.ok(remainingLogs.every((l) => l.level === "error"), "Les erreurs critiques sont conservées");
    assert.equal((await getOutboxItems({ storeId })).length, 2, "L'outbox n'est jamais purgée");

    // Simulation QuotaExceededError lors d'une écriture -> purge auto + retry sans échec
    for (let i = 0; i < 55; i++) {
      await appendSyncLog({ userId, storeId, level: "info", message: `Extra log ${i}` });
    }
    const quotaErr = new Error("QuotaExceededError: Storage limit reached");
    quotaErr.name = "QuotaExceededError";
    harness.injectNextPutError(STORE_SYNC_LOGS, quotaErr);

    await appendSyncLog({ userId, storeId, level: "warn", message: "After quota recovery" });
    assert.equal(getLastStorageError(), "QUOTA_EXCEEDED");

    // Diagnostics de quota >= 80 %
    harness.setQuotaEstimate(1000, 850);
    const diag = await getStorageDiagnostics(storeId);
    assert.equal(diag.usagePercent, 85);
    assert.equal(diag.isNearLimit, true);
    assert.equal(diag.outboxCount, 2);

    // Sauvegarde JSON + Checksum
    const prod: Product = {
      id: "p-bk",
      name: "Savon",
      sku: "SAV",
      category: "Hygiène",
      price: 500,
      cost: 300,
      stock: 40,
      minStock: 5,
      image: "🧼",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await saveStoreSnapshot({
      userId,
      storeId,
      role: "admin",
      state: { ...createCleanEmptyState("Boutique Backup"), products: [prod] },
    });
    await saveSyncCursor({
      userId,
      storeId,
      entityTable: "products",
      lastSyncedAt: "2026-01-10T10:00:00.000Z",
    });

    const backup = await exportStoreOfflineBackup(userId, storeId);
    assert.equal(backup.format, "boutiquepro-offline-backup");
    assert.equal(backup.version, 2);
    assert.ok(backup.checksum.startsWith("fnv64:"));
    assert.equal(backup.outbox.length, 2);

    // Test 1 : Fichier JSON altéré (prix falsifié) -> DOIT être rejeté par checksum
    const tampered = JSON.parse(JSON.stringify(backup));
    tampered.snapshot.state.products[0].price = 1;
    const tamperedRes = await importStoreOfflineBackup(JSON.stringify(tampered), userId, storeId);
    assert.equal(tamperedRes.success, false);
    assert.match(tamperedRes.error || "", /checksum|intégrité/i);

    // Test 2 : Import vers mauvaise boutique -> DOIT être rejeté
    const wrongStoreRes = await importStoreOfflineBackup(JSON.stringify(backup), userId, "autre-boutique");
    assert.equal(wrongStoreRes.success, false);
    assert.match(wrongStoreRes.error || "", /autre boutique/i);

    // Test 3 : Suppression d'un seul item local puis ré-import -> importe le manquant et ignore le doublon
    await (await import("@/lib/offlineDb")).removeOutboxItem("sale-backup-1");
    const restoreRes = await importStoreOfflineBackup(JSON.stringify(backup), userId, storeId);
    assert.equal(restoreRes.success, true);
    assert.equal(restoreRes.importedOutboxCount, 1);
    assert.equal(restoreRes.skippedDuplicateCount, 1);
    assert.equal((await getOutboxItems({ storeId })).length, 2);
  });
});

