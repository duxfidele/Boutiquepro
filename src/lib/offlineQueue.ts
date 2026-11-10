import type { Sale, CashSession } from "@/context/StoreContext";
import {
  clearOutboxForScope,
  generateClientUUID,
  getDefaultPriorityForOp,
  getOutboxItem,
  getOutboxItems,
  isIndexedDBSupported,
  LEGACY_LS_KEYS,
  makeScopeKey,
  migrateLegacyOfflineStorage,
  openOfflineDB,
  removeOutboxItem,
  retryOutboxItem,
  STORE_PENDING_SALES_V1,
  upsertOutboxItem,
  type OutboxItem,
} from "@/lib/offlineDb";

export { generateClientUUID };

export interface OfflineSaleItem {
  id: string; // sale.id
  storeId: string;
  sale: Sale;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status?: "pending" | "failed";
  lastAttemptAt?: string;
}

export interface PendingDebtPaymentItem {
  id: string;
  storeId: string;
  saleId: string;
  paymentAmount: number;
  newPaid: number;
  newRemaining: number;
  newStatus: "paid" | "partial" | "unpaid";
  method: "cash" | "mobile_money" | "card";
  note?: string;
  cashierName?: string;
  createdAt: string;
}

export interface PendingCashSessionItem {
  id: string; // session.id
  storeId: string;
  session: CashSession;
  createdAt: string;
}

const LOCAL_STORAGE_FALLBACK_KEY = LEGACY_LS_KEYS.OFFLINE_SALES;
const PENDING_DEBT_PAYMENTS_KEY = LEGACY_LS_KEYS.PENDING_DEBT_PAYMENTS;
const PENDING_CASH_SESSIONS_KEY = LEGACY_LS_KEYS.PENDING_CASH_SESSIONS;

let legacyMigrationPromise: Promise<void> | null = null;

async function ensureLegacyMigrated(): Promise<void> {
  if (!isIndexedDBSupported()) return;
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyOfflineStorage()
      .then(() => undefined)
      .catch(() => undefined);
  }
  await legacyMigrationPromise;
}

/**
 * Exécute une promesse ou un builder Supabase avec un délai maximum strict
 * afin d'éviter tout blocage de l'interface sur connexion 3G/4G/Wi-Fi instable ("faux en-ligne").
 */
export function withNetworkTimeout<T>(
  promiseLike: PromiseLike<T>,
  timeoutMs = 6000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("NETWORK_TIMEOUT"));
      }
    }, timeoutMs);

    Promise.resolve(promiseLike)
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

/**
 * Détecte de façon exhaustive toutes les erreurs liées à une coupure ou instabilité réseau
 * sur Chrome, Android, Safari iOS ("Load failed") et Edge.
 */
export function isNetworkLikeError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!err) return false;
  const e = err as {
    name?: string;
    status?: number;
    code?: string | number;
    message?: string;
    details?: string;
    hint?: string;
  };
  if (e?.name === "AbortError") return true;
  if (e?.status === 0 || e?.status === 502 || e?.status === 503 || e?.status === 504) {
    return true;
  }
  const msg = String(
    e?.message || e?.details || e?.hint || err || ""
  ).toLowerCase();
  return (
    msg.includes("network_timeout") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("network") ||
    msg.includes("abort") ||
    msg.includes("offline") ||
    msg.includes("err_internet_disconnected") ||
    msg.includes("err_network_changed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

// ─── Miroirs LocalStorage (crash-resistant synchrone) ────────────────────────

function getLocalStorageQueue(): OfflineSaleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as OfflineSaleItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageQueue(items: OfflineSaleItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_FALLBACK_KEY,
      JSON.stringify(items)
    );
  } catch (e) {
    console.error("Quota localStorage dépassé:", e);
  }
}

async function removeFromV1PendingSales(saleId?: string): Promise<void> {
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openOfflineDB();
    if (!db.objectStoreNames.contains(STORE_PENDING_SALES_V1)) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_SALES_V1, "readwrite");
      const store = tx.objectStore(STORE_PENDING_SALES_V1);
      const req = saleId ? store.delete(saleId) : store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Best-effort cleanup
  }
}

function outboxSaleToLegacyItem(out: OutboxItem): OfflineSaleItem {
  return {
    id: out.entityId,
    storeId: out.storeId,
    sale: out.payload as Sale,
    createdAt: out.createdAt,
    retryCount: out.retryCount || 0,
    lastError: out.lastError,
    status:
      out.status === "failed" || out.status === "conflict"
        ? "failed"
        : "pending",
    lastAttemptAt: out.lastAttemptAt,
  };
}

function legacySaleToOutboxItem(
  item: OfflineSaleItem,
  existing?: OutboxItem | null
): OutboxItem<Sale> {
  const userId =
    existing?.userId || item.sale?.userId || "__legacy__";
  const nowIso = new Date().toISOString();
  const createdAt = existing?.createdAt || item.createdAt || nowIso;

  return {
    id: `sale:${item.id}`,
    idempotencyKey: existing?.idempotencyKey || item.id,
    scopeKey: makeScopeKey(userId, item.storeId),
    userId,
    storeId: item.storeId,
    opType: "COMPLETE_SALE",
    entityType: "sale",
    entityId: item.id,
    payload: item.sale,
    expectedUpdatedAt: existing?.expectedUpdatedAt ?? null,
    priority:
      existing?.priority ?? getDefaultPriorityForOp("COMPLETE_SALE"),
    sequence: existing?.sequence ?? Date.now() * 1000,
    status: item.status === "failed" ? "failed" : "pending",
    retryCount: item.retryCount || 0,
    nextRetryAt: existing?.nextRetryAt || createdAt,
    lastAttemptAt: item.lastAttemptAt,
    lastError: item.lastError,
    errorCode: existing?.errorCode,
    conflictData: existing?.conflictData,
    createdAt,
    updatedAt: nowIso,
  };
}

// ─── Ventes hors-ligne (Compatibilité v1 -> Outbox v2) ──────────────────────

export async function saveOfflineSale(
  storeId: string,
  sale: Sale
): Promise<void> {
  const item: OfflineSaleItem = {
    id: sale.id,
    storeId,
    sale,
    createdAt: sale.createdAt || new Date().toISOString(),
    retryCount: 0,
    status: "pending",
  };

  // Miroir localStorage synchrone immédiat (résistant aux fermetures brutales)
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue([item, ...lsList.filter((i) => i.id !== item.id)]);

  if (!isIndexedDBSupported()) return;

  try {
    await ensureLegacyMigrated();
    const existing = await getOutboxItem(`sale:${item.id}`);
    await upsertOutboxItem(legacySaleToOutboxItem(item, existing));
  } catch {
    // Déjà protégé dans localStorage
  }
}

export async function updateOfflineSale(item: OfflineSaleItem): Promise<void> {
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue([item, ...lsList.filter((i) => i.id !== item.id)]);

  if (!isIndexedDBSupported()) return;

  try {
    await ensureLegacyMigrated();
    const existing = await getOutboxItem(`sale:${item.id}`);
    await upsertOutboxItem(legacySaleToOutboxItem(item, existing));
  } catch {
    // Déjà mis à jour dans localStorage
  }
}

export async function getOfflineSales(
  storeId?: string
): Promise<OfflineSaleItem[]> {
  const lsAll = getLocalStorageQueue();

  if (!isIndexedDBSupported()) {
    const filtered = storeId
      ? lsAll.filter((i) => i.storeId === storeId)
      : lsAll;
    return [...filtered].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  try {
    await ensureLegacyMigrated();
    const outboxSales = await getOutboxItems({
      storeId,
      opType: "COMPLETE_SALE",
      statuses: ["pending", "syncing", "failed", "conflict", "auth_paused"],
    });

    const mergedMap = new Map<string, OfflineSaleItem>();
    for (const lsItem of lsAll) {
      if (lsItem?.id && (!storeId || lsItem.storeId === storeId)) {
        mergedMap.set(lsItem.id, lsItem);
      }
    }
    for (const obItem of outboxSales) {
      mergedMap.set(obItem.entityId, outboxSaleToLegacyItem(obItem));
    }

    return Array.from(mergedMap.values()).sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return storeId ? lsAll.filter((i) => i.storeId === storeId) : lsAll;
  }
}

export async function removeOfflineSale(saleId: string): Promise<void> {
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue(lsList.filter((i) => i.id !== saleId));

  if (!isIndexedDBSupported()) return;

  try {
    await Promise.all([
      removeOutboxItem(`sale:${saleId}`),
      removeFromV1PendingSales(saleId),
    ]);
  } catch {
    // Supprimé de localStorage
  }
}

// ─── File d'attente des remboursements de dettes hors-ligne ──────────────────

export function getPendingDebtPayments(
  storeId?: string
): PendingDebtPaymentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_DEBT_PAYMENTS_KEY);
    const list: PendingDebtPaymentItem[] = raw ? JSON.parse(raw) : [];
    return storeId ? list.filter((i) => i.storeId === storeId) : list;
  } catch {
    return [];
  }
}

export function savePendingDebtPayment(item: PendingDebtPaymentItem): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingDebtPayments();
    const updated = [...existing.filter((i) => i.id !== item.id), item];
    window.localStorage.setItem(
      PENDING_DEBT_PAYMENTS_KEY,
      JSON.stringify(updated)
    );
  } catch (e) {
    console.warn("Erreur stockage file dette hors-ligne:", e);
  }

  if (isIndexedDBSupported()) {
    const nowIso = new Date().toISOString();
    const createdAt = item.createdAt || nowIso;
    void upsertOutboxItem<PendingDebtPaymentItem>({
      id: `debt:${item.id}`,
      idempotencyKey: item.id,
      scopeKey: makeScopeKey("__legacy__", item.storeId),
      userId: "__legacy__",
      storeId: item.storeId,
      opType: "RECORD_DEBT_PAYMENT",
      entityType: "debt_payment",
      entityId: item.id,
      payload: item,
      expectedUpdatedAt: null,
      priority: getDefaultPriorityForOp("RECORD_DEBT_PAYMENT"),
      sequence: Date.now() * 1000,
      status: "pending",
      retryCount: 0,
      nextRetryAt: createdAt,
      createdAt,
      updatedAt: nowIso,
    }).catch(() => {});
  }
}

export function removePendingDebtPayment(id: string): void {
  if (typeof window !== "undefined") {
    try {
      const existing = getPendingDebtPayments();
      window.localStorage.setItem(
        PENDING_DEBT_PAYMENTS_KEY,
        JSON.stringify(existing.filter((i) => i.id !== id))
      );
    } catch {}
  }

  if (isIndexedDBSupported()) {
    void removeOutboxItem(`debt:${id}`).catch(() => {});
  }
}

// ─── File d'attente des ouvertures / clôtures de caisse hors-ligne ───────────

export function getPendingCashSessions(
  storeId?: string
): PendingCashSessionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_CASH_SESSIONS_KEY);
    const list: PendingCashSessionItem[] = raw ? JSON.parse(raw) : [];
    return storeId ? list.filter((i) => i.storeId === storeId) : list;
  } catch {
    return [];
  }
}

export function savePendingCashSession(
  storeId: string,
  session: CashSession
): void {
  const nowIso = new Date().toISOString();

  if (typeof window !== "undefined") {
    try {
      const existing = getPendingCashSessions();
      const item: PendingCashSessionItem = {
        id: session.id,
        storeId,
        session,
        createdAt: nowIso,
      };
      const updated = [...existing.filter((i) => i.id !== session.id), item];
      window.localStorage.setItem(
        PENDING_CASH_SESSIONS_KEY,
        JSON.stringify(updated)
      );
    } catch (e) {
      console.warn("Erreur stockage file session caisse hors-ligne:", e);
    }
  }

  if (isIndexedDBSupported()) {
    const isClosed = session.status === "closed";
    const opType = isClosed ? "CLOSE_CASH_SESSION" : "OPEN_CASH_SESSION";
    const outboxId = `${isClosed ? "cash_close" : "cash_open"}:${session.id}`;
    const userId = session.userId || "__legacy__";
    const createdAt =
      (isClosed ? session.closedAt : session.openedAt) || nowIso;

    void upsertOutboxItem<CashSession>({
      id: outboxId,
      idempotencyKey: outboxId,
      scopeKey: makeScopeKey(userId, storeId),
      userId,
      storeId,
      opType,
      entityType: "cash_session",
      entityId: session.id,
      payload: session,
      expectedUpdatedAt: null,
      priority: getDefaultPriorityForOp(opType),
      sequence: Date.now() * 1000,
      status: "pending",
      retryCount: 0,
      nextRetryAt: createdAt,
      createdAt,
      updatedAt: nowIso,
    }).catch(() => {});
  }
}

export function removePendingCashSession(sessionId: string): void {
  if (typeof window !== "undefined") {
    try {
      const existing = getPendingCashSessions();
      window.localStorage.setItem(
        PENDING_CASH_SESSIONS_KEY,
        JSON.stringify(existing.filter((i) => i.id !== sessionId))
      );
    } catch {}
  }

  if (isIndexedDBSupported()) {
    void Promise.all([
      removeOutboxItem(`cash_open:${sessionId}`),
      removeOutboxItem(`cash_close:${sessionId}`),
    ]).catch(() => {});
  }
}

// ─── Compteur global et utilitaires (sans double comptage) ──────────────────

export async function getOfflineSalesCount(storeId?: string): Promise<number> {
  const actionableIds = new Set<string>();
  const excludedFailedSaleIds = new Set<string>();

  if (isIndexedDBSupported()) {
    try {
      await ensureLegacyMigrated();
      const allOutbox = await getOutboxItems({ storeId });
      for (const item of allOutbox) {
        if (item.opType === "COMPLETE_SALE" && item.status === "failed") {
          excludedFailedSaleIds.add(item.entityId);
          continue;
        }
        if (
          item.status === "pending" ||
          item.status === "syncing" ||
          item.status === "auth_paused"
        ) {
          actionableIds.add(item.id);
        }
      }
    } catch {
      // Fallback localStorage ci-dessous
    }
  }

  // Compléter uniquement avec les entrées localStorage non déjà recensées dans outbox
  const lsSales = getLocalStorageQueue().filter(
    (s) => !storeId || s.storeId === storeId
  );
  for (const s of lsSales) {
    if (s.status === "failed" || excludedFailedSaleIds.has(s.id)) continue;
    actionableIds.add(`sale:${s.id}`);
  }

  const debtPayments = getPendingDebtPayments(storeId);
  for (const d of debtPayments) {
    actionableIds.add(`debt:${d.id}`);
  }

  const cashSessions = getPendingCashSessions(storeId);
  for (const c of cashSessions) {
    const outboxId = `${c.session?.status === "closed" ? "cash_close" : "cash_open"}:${c.id}`;
    actionableIds.add(outboxId);
  }

  return actionableIds.size;
}

export async function clearOfflineQueue(storeId?: string): Promise<void> {
  if (!storeId) {
    saveLocalStorageQueue([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(PENDING_DEBT_PAYMENTS_KEY);
        window.localStorage.removeItem(PENDING_CASH_SESSIONS_KEY);
      } catch {}
    }
  } else {
    const lsList = getLocalStorageQueue().filter((i) => i.storeId !== storeId);
    saveLocalStorageQueue(lsList);
    if (typeof window !== "undefined") {
      try {
        const remDebts = getPendingDebtPayments().filter(
          (i) => i.storeId !== storeId
        );
        window.localStorage.setItem(
          PENDING_DEBT_PAYMENTS_KEY,
          JSON.stringify(remDebts)
        );
        const remSessions = getPendingCashSessions().filter(
          (i) => i.storeId !== storeId
        );
        window.localStorage.setItem(
          PENDING_CASH_SESSIONS_KEY,
          JSON.stringify(remSessions)
        );
      } catch {}
    }
  }

  if (!isIndexedDBSupported()) return;

  try {
    if (!storeId) {
      const allOutbox = await getOutboxItems();
      const allIds = allOutbox.map((i) => i.id);
      if (allIds.length > 0) {
        await Promise.all(allIds.map((id) => removeOutboxItem(id)));
      }
      await removeFromV1PendingSales();
    } else {
      await clearOutboxForScope(storeId, {
        mode: "store",
        includeUnsynced: true,
      });
      const db = await openOfflineDB();
      if (db.objectStoreNames.contains(STORE_PENDING_SALES_V1)) {
        const v1Items = await new Promise<OfflineSaleItem[]>((resolve) => {
          const tx = db.transaction(STORE_PENDING_SALES_V1, "readonly");
          const req = tx.objectStore(STORE_PENDING_SALES_V1).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
        for (const v1 of v1Items) {
          if (v1.storeId === storeId) {
            await removeFromV1PendingSales(v1.id);
          }
        }
      }
    }
  } catch {
    // Ignoré
  }
}

export async function getFailedOfflineSales(
  storeId?: string
): Promise<OfflineSaleItem[]> {
  const all = await getOfflineSales(storeId);
  return all.filter((i) => i.status === "failed");
}

export async function retryOfflineSale(saleId: string): Promise<void> {
  const lsList = getLocalStorageQueue();
  const lsItem = lsList.find((i) => i.id === saleId);
  if (lsItem) {
    saveLocalStorageQueue([
      {
        ...lsItem,
        retryCount: 0,
        status: "pending",
        lastError: undefined,
      },
      ...lsList.filter((i) => i.id !== saleId),
    ]);
  }

  if (isIndexedDBSupported()) {
    await retryOutboxItem(`sale:${saleId}`);
  }
}
