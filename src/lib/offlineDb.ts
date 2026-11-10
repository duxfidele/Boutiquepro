import type {
  CashSession,
  DebtPayment,
  ProductUnit,
  Sale,
  StoreState,
} from "@/context/StoreContext";
import type {
  OfflineSaleItem,
  PendingCashSessionItem,
  PendingDebtPaymentItem,
} from "@/lib/offlineQueue";

// ─── Constantes IndexedDB v2 & Legacy Keys ──────────────────────────────────

export const OFFLINE_DB_NAME = "BoutiquePro_Offline";
export const OFFLINE_DB_VERSION = 2;
export const OFFLINE_SNAPSHOT_SCHEMA_VERSION = 2;
export const OFFLINE_BROADCAST_CHANNEL = "boutiquepro-offline-sync";

export const STORE_PENDING_SALES_V1 = "pending_sales";
export const STORE_SNAPSHOTS = "snapshots";
export const STORE_OUTBOX = "outbox";
export const STORE_SYNC_CURSORS = "sync_cursors";
export const STORE_SYNC_LOGS = "sync_logs";

export const LEGACY_LS_KEYS = {
  OFFLINE_SALES: "boutiquepro_offline_sales",
  PENDING_DEBT_PAYMENTS: "boutiquepro_pending_debt_payments",
  PENDING_CASH_SESSIONS: "boutiquepro_pending_cash_sessions",
  LEGACY_STATE_PREFIX: "boutiquepro-state-",
  LEGACY_DEBT_PREFIX: "boutiquepro_debt_payments_",
  LEGACY_CASH_PREFIX: "boutiquepro_cash_sessions_",
  LEGACY_GLOBAL_STATE: "boutiquepro-state",
  MIGRATION_DONE_PREFIX: "boutiquepro_idb_v2_migrated_",
} as const;

export const STORAGE_WARNING_THRESHOLD_PERCENT = 80;
const MAX_SYNC_LOGS_TOTAL = 800;

// ─── Types ──────────────────────────────────────────────────────────────────

export type OutboxOperationType =
  | "OPEN_CASH_SESSION"
  | "CLOSE_CASH_SESSION"
  | "COMPLETE_SALE"
  | "CONVERT_QUOTE_TO_SALE"
  | "RECORD_DEBT_PAYMENT"
  | "ADD_CUSTOMER"
  | "ADD_PRODUCT"
  | "UPDATE_PRODUCT"
  | "DELETE_PRODUCT"
  | "BATCH_ADD_PRODUCTS"
  | "ADD_BATCH"
  | "DELETE_BATCH"
  | "ADD_CATEGORY"
  | "DELETE_CATEGORY"
  | "ADD_EXPENSE"
  | "UPDATE_EXPENSE"
  | "DELETE_EXPENSE"
  | "ADD_ORDER"
  | "UPDATE_ORDER_STATUS"
  | "DELETE_ORDER"
  | "ADD_INVENTORY_SESSION"
  | "ADD_QUOTE"
  | "UPDATE_QUOTE"
  | "DELETE_QUOTE"
  | "ADD_PRICE_HISTORY_ENTRY"
  | "UPDATE_SETTINGS";

export type OutboxEntityType =
  | "cash_session"
  | "sale"
  | "debt_payment"
  | "customer"
  | "product"
  | "product_batch"
  | "category"
  | "expense"
  | "order"
  | "inventory_session"
  | "quote"
  | "price_history"
  | "settings";

export type OutboxStatus =
  | "pending"
  | "syncing"
  | "conflict"
  | "failed"
  | "auth_paused"
  | "done";

export interface OutboxConflictData {
  code: string;
  message: string;
  serverRecord?: Record<string, unknown> | null;
  localPayload?: unknown;
  detectedAt: string;
  resolutionOptions?: Array<"keep_server" | "force_local" | "dismiss">;
}

export interface OutboxItem<TPayload = unknown> {
  id: string;
  idempotencyKey: string;
  scopeKey: string; // `${userId}:${storeId}`
  userId: string;
  storeId: string;
  opType: OutboxOperationType;
  entityType: OutboxEntityType;
  entityId: string;
  payload: TPayload;
  expectedUpdatedAt?: string | null;
  priority: number;
  sequence: number;
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt: string;
  lastAttemptAt?: string;
  lastError?: string;
  errorCode?: string;
  conflictData?: OutboxConflictData;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSnapshotExtra {
  debtPayments?: Record<string, DebtPayment[]>;
  productUnitsByProduct?: Record<string, ProductUnit[]>;
}

export interface StoreSnapshotRecord {
  scopeKey: string; // `${userId}:${storeId}`
  userId: string;
  storeId: string;
  role: string;
  schemaVersion: number;
  cachedAt: string;
  lastServerSyncAt?: string | null;
  state: StoreState;
  extra?: StoreSnapshotExtra;
}

export interface SyncCursorRecord {
  cursorKey: string; // `${userId}:${storeId}:${entityTable}`
  scopeKey: string;
  userId: string;
  storeId: string;
  entityTable: string;
  lastSyncedAt: string;
  lastRecordCount?: number;
  updatedAt: string;
}

export type SyncLogLevel = "info" | "warn" | "error" | "conflict";

export interface SyncLogEntry {
  id: string;
  scopeKey: string;
  userId: string;
  storeId: string;
  level: SyncLogLevel;
  opType?: string;
  entityId?: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface OutboxCounts {
  pending: number;
  syncing: number;
  failed: number;
  conflict: number;
  authPaused: number;
  done: number;
  actionableTotal: number;
  attentionTotal: number;
}

export interface StorageDiagnostics {
  indexedDBAvailable: boolean;
  quotaBytes: number | null;
  usageBytes: number | null;
  usagePercent: number | null;
  isNearLimit: boolean;
  persisted: boolean | null;
  outboxCount: number;
  snapshotCount: number;
  logCount: number;
  lastStorageError: string | null;
}

export interface OfflineBackupPayload {
  format: "boutiquepro-offline-backup";
  version: 2;
  exportedAt: string;
  storeId: string;
  userId: string;
  checksum: string;
  snapshot: StoreSnapshotRecord | null;
  outbox: OutboxItem[];
  cursors: SyncCursorRecord[];
  logs: SyncLogEntry[];
}

export interface BackupImportResult {
  success: boolean;
  importedOutboxCount: number;
  skippedDuplicateCount: number;
  restoredSnapshot: boolean;
  restoredCursorsCount: number;
  error?: string;
}

export type OfflineBroadcastEvent =
  | { type: "OUTBOX_UPDATED"; storeId: string; scopeKey?: string; at: string }
  | { type: "SNAPSHOT_UPDATED"; storeId: string; scopeKey: string; at: string }
  | { type: "SYNC_STATUS_CHANGED"; storeId: string; status: string; at: string }
  | { type: "CONFLICT_DETECTED"; storeId: string; itemId: string; at: string }
  | { type: "AUTH_PAUSED"; storeId: string; paused: boolean; at: string };

// ─── État interne singleton & compteurs ─────────────────────────────────────

let cachedDbPromise: Promise<IDBDatabase> | null = null;
let lastStorageError: string | null = null;
let monotonicCounter = 0;

function nextSequence(): number {
  monotonicCounter = (monotonicCounter + 1) % 1000;
  return Date.now() * 1000 + monotonicCounter;
}

export function getLastStorageError(): string | null {
  return lastStorageError;
}

export function clearLastStorageError(): void {
  lastStorageError = null;
}

// ─── Helpers d'identité & d'isolation ───────────────────────────────────────

export function makeScopeKey(userId: string, storeId: string): string {
  const safeUser = (userId || "__legacy__").trim() || "__legacy__";
  const safeStore = (storeId || "").trim();
  return `${safeUser}:${safeStore}`;
}

export function makeCursorKey(
  userId: string,
  storeId: string,
  entityTable: string
): string {
  return `${makeScopeKey(userId, storeId)}:${entityTable}`;
}

/**
 * Génère un UUID v4 RFC 4122 sans risque de collision (même en rafale hors-ligne).
 * Compatible à la fois avec les colonnes PostgreSQL UUID et TEXT.
 */
export function generateClientUUID(): string {
  const gCrypto =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (gCrypto && typeof gCrypto.randomUUID === "function") {
    return gCrypto.randomUUID();
  }

  if (gCrypto && typeof gCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    gCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Fallback ultra-dégradé si crypto absent (environnement très restreint)
  const randHex = (len: number) => {
    let out = "";
    for (let i = 0; i < len; i++) {
      out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
  };
  const timeHex = Date.now().toString(16).padStart(12, "0").slice(-12);
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-4${randHex(3)}-${((Math.floor(Math.random() * 4) + 8).toString(16))}${randHex(3)}-${randHex(12)}`;
}

// ─── Priorités par type d'opération ─────────────────────────────────────────

const OP_PRIORITY: Record<OutboxOperationType, number> = {
  OPEN_CASH_SESSION: 10,
  ADD_CATEGORY: 20,
  ADD_CUSTOMER: 20,
  ADD_PRODUCT: 20,
  BATCH_ADD_PRODUCTS: 20,
  UPDATE_PRODUCT: 20,
  ADD_BATCH: 20,
  ADD_QUOTE: 30,
  UPDATE_QUOTE: 30,
  ADD_ORDER: 30,
  UPDATE_ORDER_STATUS: 30,
  ADD_INVENTORY_SESSION: 30,
  COMPLETE_SALE: 40,
  CONVERT_QUOTE_TO_SALE: 40,
  RECORD_DEBT_PAYMENT: 50,
  CLOSE_CASH_SESSION: 60,
  ADD_EXPENSE: 70,
  UPDATE_EXPENSE: 70,
  DELETE_EXPENSE: 70,
  ADD_PRICE_HISTORY_ENTRY: 70,
  DELETE_QUOTE: 75,
  DELETE_ORDER: 75,
  DELETE_BATCH: 75,
  DELETE_PRODUCT: 75,
  DELETE_CATEGORY: 75,
  UPDATE_SETTINGS: 80,
};

export function getDefaultPriorityForOp(opType: OutboxOperationType): number {
  return OP_PRIORITY[opType] ?? 50;
}

const COALESCEABLE_UPDATE_OPS = new Set<OutboxOperationType>([
  "UPDATE_SETTINGS",
  "UPDATE_PRODUCT",
  "UPDATE_QUOTE",
  "UPDATE_EXPENSE",
]);

// ─── Sécurité & Nettoyage du snapshot selon le rôle ─────────────────────────

export function isAdminRole(role?: string | null): boolean {
  const norm = (role || "").toLowerCase().trim();
  return norm === "admin" || norm === "owner";
}

/**
 * Protège les données sensibles (coûts d'achat, marges, commandes fournisseurs,
 * dépenses) : un caissier/membre non-admin ne doit jamais persister ces champs en local.
 */
export function sanitizeSnapshotStateForRole(
  state: StoreState,
  role?: string | null
): StoreState {
  if (isAdminRole(role)) {
    return state;
  }

  return {
    ...state,
    products: (state.products || []).map((p) => ({
      ...p,
      cost: 0,
      units: p.units?.map((u) => ({ ...u, cost: null })),
    })),
    sales: (state.sales || []).map((s) => ({
      ...s,
      items: (s.items || []).map((it) => ({
        ...it,
        cost: undefined,
      })),
    })),
    orders: [],
    expenses: [],
    inventorySessions: (state.inventorySessions || []).map((inv) => ({
      ...inv,
      totalVarianceValue: 0,
      items: (inv.items || []).map((it) => ({
        ...it,
        costPrice: 0,
      })),
    })),
    priceHistory: (state.priceHistory || []).filter(
      (ph) => ph.priceType !== "cost"
    ),
  };
}

// ─── BroadcastChannel multi-onglets ─────────────────────────────────────────

const localListeners = new Set<(event: OfflineBroadcastEvent) => void>();
let sharedBroadcastChannel: BroadcastChannel | null = null;

function ensureSharedBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (sharedBroadcastChannel) return sharedBroadcastChannel;
  try {
    const ch = new BroadcastChannel(OFFLINE_BROADCAST_CHANNEL);
    ch.onmessage = (ev: MessageEvent<OfflineBroadcastEvent>) => {
      if (ev?.data?.type) {
        localListeners.forEach((cb) => {
          try {
            cb(ev.data);
          } catch {}
        });
      }
    };
    sharedBroadcastChannel = ch;
    return ch;
  } catch {
    sharedBroadcastChannel = null;
    return null;
  }
}

export function broadcastOfflineEvent(event: OfflineBroadcastEvent): void {
  localListeners.forEach((cb) => {
    try {
      cb(event);
    } catch {}
  });

  if (typeof BroadcastChannel !== "undefined") {
    try {
      // Réutiliser le canal partagé lorsqu'il est ouvert évite l'écho en double
      // dans le même onglet (BroadcastChannel n'auto-délivre jamais à lui-même).
      if (localListeners.size > 0) {
        const ch = ensureSharedBroadcastChannel();
        ch?.postMessage(event);
      } else {
        const ch = new BroadcastChannel(OFFLINE_BROADCAST_CHANNEL);
        ch.postMessage(event);
        ch.close();
      }
    } catch {}
  }
}

export function subscribeOfflineEvents(
  handler: (event: OfflineBroadcastEvent) => void
): () => void {
  localListeners.add(handler);
  ensureSharedBroadcastChannel();

  return () => {
    localListeners.delete(handler);
    if (localListeners.size === 0 && sharedBroadcastChannel) {
      try {
        sharedBroadcastChannel.close();
      } catch {}
      sharedBroadcastChannel = null;
    }
  };
}

// ─── Ouverture & Migration Schema IndexedDB v2 ──────────────────────────────

export function isIndexedDBSupported(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    "indexedDB" in globalThis &&
    Boolean(globalThis.indexedDB)
  );
}

export function resetCachedDBConnection(): void {
  cachedDbPromise = null;
  if (sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel.close();
    } catch {}
    sharedBroadcastChannel = null;
  }
}

function createSchemaV2Stores(
  db: IDBDatabase,
  tx: IDBTransaction | null
): void {
  // 1. Ancien store v1 conservé intact pour rétrocompatibilité & migration
  if (!db.objectStoreNames.contains(STORE_PENDING_SALES_V1)) {
    const v1Store = db.createObjectStore(STORE_PENDING_SALES_V1, {
      keyPath: "id",
    });
    v1Store.createIndex("storeId", "storeId", { unique: false });
    v1Store.createIndex("createdAt", "createdAt", { unique: false });
  }

  // 2. Snapshots isolés par `${userId}:${storeId}`
  if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
    const snapStore = db.createObjectStore(STORE_SNAPSHOTS, {
      keyPath: "scopeKey",
    });
    snapStore.createIndex("storeId", "storeId", { unique: false });
    snapStore.createIndex("userId", "userId", { unique: false });
    snapStore.createIndex("cachedAt", "cachedAt", { unique: false });
  } else if (tx) {
    const snapStore = tx.objectStore(STORE_SNAPSHOTS);
    if (!snapStore.indexNames.contains("storeId")) {
      snapStore.createIndex("storeId", "storeId", { unique: false });
    }
    if (!snapStore.indexNames.contains("userId")) {
      snapStore.createIndex("userId", "userId", { unique: false });
    }
    if (!snapStore.indexNames.contains("cachedAt")) {
      snapStore.createIndex("cachedAt", "cachedAt", { unique: false });
    }
  }

  // 3. Outbox unifiée persistante
  if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
    const outboxStore = db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
    outboxStore.createIndex("by_scope", "scopeKey", { unique: false });
    outboxStore.createIndex("by_store", "storeId", { unique: false });
    outboxStore.createIndex("by_store_status", ["storeId", "status"], {
      unique: false,
    });
    outboxStore.createIndex("by_scope_status", ["scopeKey", "status"], {
      unique: false,
    });
    outboxStore.createIndex("by_priority_created", ["priority", "createdAt"], {
      unique: false,
    });
    outboxStore.createIndex("by_entity", ["storeId", "entityType", "entityId"], {
      unique: false,
    });
  } else if (tx) {
    const outboxStore = tx.objectStore(STORE_OUTBOX);
    if (!outboxStore.indexNames.contains("by_scope")) {
      outboxStore.createIndex("by_scope", "scopeKey", { unique: false });
    }
    if (!outboxStore.indexNames.contains("by_store")) {
      outboxStore.createIndex("by_store", "storeId", { unique: false });
    }
    if (!outboxStore.indexNames.contains("by_store_status")) {
      outboxStore.createIndex("by_store_status", ["storeId", "status"], {
        unique: false,
      });
    }
    if (!outboxStore.indexNames.contains("by_scope_status")) {
      outboxStore.createIndex("by_scope_status", ["scopeKey", "status"], {
        unique: false,
      });
    }
    if (!outboxStore.indexNames.contains("by_priority_created")) {
      outboxStore.createIndex("by_priority_created", ["priority", "createdAt"], {
        unique: false,
      });
    }
    if (!outboxStore.indexNames.contains("by_entity")) {
      outboxStore.createIndex("by_entity", ["storeId", "entityType", "entityId"], {
        unique: false,
      });
    }
  }

  // 4. Curseurs de synchronisation incrémentale
  if (!db.objectStoreNames.contains(STORE_SYNC_CURSORS)) {
    const cursorStore = db.createObjectStore(STORE_SYNC_CURSORS, {
      keyPath: "cursorKey",
    });
    cursorStore.createIndex("by_scope", "scopeKey", { unique: false });
    cursorStore.createIndex("by_store", "storeId", { unique: false });
  }

  // 5. Journaux de traçabilité & erreurs de synchronisation
  if (!db.objectStoreNames.contains(STORE_SYNC_LOGS)) {
    const logStore = db.createObjectStore(STORE_SYNC_LOGS, { keyPath: "id" });
    logStore.createIndex("by_store_time", ["storeId", "timestamp"], {
      unique: false,
    });
    logStore.createIndex("by_scope_time", ["scopeKey", "timestamp"], {
      unique: false,
    });
    logStore.createIndex("by_level", "level", { unique: false });
  }
}

export async function openOfflineDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    throw new Error("IndexedDB non disponible dans cet environnement");
  }

  if (cachedDbPromise) {
    return cachedDbPromise;
  }

  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = globalThis.indexedDB.open(
        OFFLINE_DB_NAME,
        OFFLINE_DB_VERSION
      );

      request.onupgradeneeded = (event) => {
        const req = event.target as IDBOpenDBRequest;
        const db = req.result;
        createSchemaV2Stores(db, req.transaction);
      };

      request.onblocked = () => {
        console.warn(
          "[OfflineDB] Mise à niveau IndexedDB v2 bloquée par un autre onglet ouvert."
        );
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {}
          cachedDbPromise = null;
        };
        db.onclose = () => {
          cachedDbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        cachedDbPromise = null;
        reject(request.error || new Error("Erreur ouverture IndexedDB v2"));
      };
    } catch (err) {
      cachedDbPromise = null;
      reject(err);
    }
  });

  return cachedDbPromise;
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    String(e.message || "").toLowerCase().includes("quota")
  );
}

function isClosedConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return (
    e.name === "InvalidStateError" ||
    String(e.message || "").toLowerCase().includes("closing")
  );
}

async function withDbTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  executor: (tx: IDBTransaction) => Promise<T> | IDBRequest<T>
): Promise<T> {
  const runOnce = async (): Promise<T> => {
    const db = await openOfflineDB();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      let settled = false;
      let resultValue!: T;
      let hasResult = false;

      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(resultValue);
        }
      };
      tx.onerror = () => {
        if (!settled) {
          settled = true;
          reject(tx.error || new Error("Erreur transaction IndexedDB"));
        }
      };
      tx.onabort = () => {
        if (!settled) {
          settled = true;
          reject(tx.error || new Error("Transaction IndexedDB annulée"));
        }
      };

      try {
        const ret = executor(tx);
        if (ret && typeof (ret as IDBRequest<T>).onsuccess !== "undefined") {
          const req = ret as IDBRequest<T>;
          req.onsuccess = () => {
            resultValue = req.result;
            hasResult = true;
          };
          req.onerror = () => {
            if (!settled) {
              settled = true;
              reject(req.error || new Error("Erreur requête IndexedDB"));
            }
          };
        } else {
          Promise.resolve(ret as Promise<T> | T)
            .then((val) => {
              if (!hasResult) {
                resultValue = val;
                hasResult = true;
              }
            })
            .catch((err) => {
              if (!settled) {
                settled = true;
                try {
                  tx.abort();
                } catch {}
                reject(err);
              }
            });
        }
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  };

  try {
    return await runOnce();
  } catch (err) {
    if (isClosedConnectionError(err)) {
      cachedDbPromise = null;
      return runOnce();
    }
    if (isQuotaExceededError(err) && mode === "readwrite") {
      lastStorageError = "QUOTA_EXCEEDED";
      try {
        await pruneOldSyncLogs(50);
        return await runOnce();
      } catch (retryErr) {
        lastStorageError = "QUOTA_EXCEEDED";
        throw retryErr;
      }
    }
    throw err;
  }
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Outbox Operations ──────────────────────────────────────────────────────

export interface EnqueueOutboxInput<TPayload = unknown> {
  id?: string;
  idempotencyKey?: string;
  userId: string;
  storeId: string;
  opType: OutboxOperationType;
  entityType: OutboxEntityType;
  entityId: string;
  payload: TPayload;
  expectedUpdatedAt?: string | null;
  priority?: number;
  createdAt?: string;
  coalescePendingUpdates?: boolean;
}

/**
 * Trie les opérations en respectant strictement l'ordre chronologique d'origine,
 * puis par priorité métier en cas d'égalité de timestamp, puis par compteur monotone.
 */
export function sortOutboxItemsDeterministically(
  items: OutboxItem[]
): OutboxItem[] {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.createdAt || "") || 0;
    const timeB = Date.parse(b.createdAt || "") || 0;
    if (timeA !== timeB) return timeA - timeB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.sequence || 0) - (b.sequence || 0);
  });
}

export async function upsertOutboxItem<TPayload = unknown>(
  item: OutboxItem<TPayload>
): Promise<OutboxItem<TPayload>> {
  const normalized: OutboxItem<TPayload> = {
    ...item,
    scopeKey: item.scopeKey || makeScopeKey(item.userId, item.storeId),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };

  if (isIndexedDBSupported()) {
    await withDbTransaction(STORE_OUTBOX, "readwrite", (tx) => {
      const store = tx.objectStore(STORE_OUTBOX);
      return store.put(normalized);
    });
  }

  broadcastOfflineEvent({
    type: "OUTBOX_UPDATED",
    storeId: normalized.storeId,
    scopeKey: normalized.scopeKey,
    at: new Date().toISOString(),
  });

  return normalized;
}

export async function enqueueOutboxOperation<TPayload = unknown>(
  input: EnqueueOutboxInput<TPayload>
): Promise<OutboxItem<TPayload>> {
  const nowIso = new Date().toISOString();
  const createdIso = input.createdAt || nowIso;
  const scopeKey = makeScopeKey(input.userId, input.storeId);
  const allowCoalesce =
    input.coalescePendingUpdates ?? COALESCEABLE_UPDATE_OPS.has(input.opType);

  if (isIndexedDBSupported() && allowCoalesce) {
    const existingForEntity = await withDbTransaction<OutboxItem[]>(
      STORE_OUTBOX,
      "readonly",
      (tx) => {
        const index = tx.objectStore(STORE_OUTBOX).index("by_entity");
        return index.getAll([input.storeId, input.entityType, input.entityId]);
      }
    );

    const pendingMatch = existingForEntity.find(
      (it) =>
        it.scopeKey === scopeKey &&
        it.opType === input.opType &&
        it.status === "pending"
    );

    if (pendingMatch) {
      const merged: OutboxItem<TPayload> = {
        ...pendingMatch,
        payload:
          typeof pendingMatch.payload === "object" &&
          pendingMatch.payload !== null &&
          typeof input.payload === "object" &&
          input.payload !== null &&
          !Array.isArray(input.payload)
            ? ({
                ...(pendingMatch.payload as Record<string, unknown>),
                ...(input.payload as Record<string, unknown>),
              } as TPayload)
            : input.payload,
        // Préserver expectedUpdatedAt initial capturé avant les éditions hors ligne
        expectedUpdatedAt:
          pendingMatch.expectedUpdatedAt ?? input.expectedUpdatedAt ?? null,
        updatedAt: nowIso,
      };
      return upsertOutboxItem(merged);
    }
  }

  const item: OutboxItem<TPayload> = {
    id: input.id || generateClientUUID(),
    idempotencyKey: input.idempotencyKey || input.id || generateClientUUID(),
    scopeKey,
    userId: input.userId || "__legacy__",
    storeId: input.storeId,
    opType: input.opType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
    priority: input.priority ?? getDefaultPriorityForOp(input.opType),
    sequence: nextSequence(),
    status: "pending",
    retryCount: 0,
    nextRetryAt: createdIso,
    createdAt: createdIso,
    updatedAt: nowIso,
  };

  return upsertOutboxItem(item);
}

export async function getOutboxItem(id: string): Promise<OutboxItem | null> {
  if (!isIndexedDBSupported()) return null;
  const item = await withDbTransaction<OutboxItem | undefined>(
    STORE_OUTBOX,
    "readonly",
    (tx) => tx.objectStore(STORE_OUTBOX).get(id)
  );
  return item || null;
}

export async function getOutboxItems(filter?: {
  scopeKey?: string;
  storeId?: string;
  userId?: string;
  statuses?: OutboxStatus[];
  opType?: OutboxOperationType;
  includeLegacyUserForStore?: boolean;
}): Promise<OutboxItem[]> {
  if (!isIndexedDBSupported()) return [];

  let items: OutboxItem[];
  if (filter?.scopeKey && !filter.includeLegacyUserForStore) {
    items = await withDbTransaction<OutboxItem[]>(
      STORE_OUTBOX,
      "readonly",
      (tx) =>
        tx.objectStore(STORE_OUTBOX).index("by_scope").getAll(filter.scopeKey!)
    );
  } else if (filter?.storeId) {
    items = await withDbTransaction<OutboxItem[]>(
      STORE_OUTBOX,
      "readonly",
      (tx) =>
        tx.objectStore(STORE_OUTBOX).index("by_store").getAll(filter.storeId!)
    );
  } else {
    items = await withDbTransaction<OutboxItem[]>(
      STORE_OUTBOX,
      "readonly",
      (tx) => tx.objectStore(STORE_OUTBOX).getAll()
    );
  }

  const filtered = items.filter((item) => {
    if (filter?.storeId && item.storeId !== filter.storeId) return false;
    if (filter?.scopeKey) {
      if (filter.includeLegacyUserForStore && filter.storeId) {
        const legacyScope = makeScopeKey("__legacy__", filter.storeId);
        if (item.scopeKey !== filter.scopeKey && item.scopeKey !== legacyScope) {
          return false;
        }
      } else if (item.scopeKey !== filter.scopeKey) {
        return false;
      }
    }
    if (filter?.userId) {
      if (filter.includeLegacyUserForStore) {
        if (item.userId !== filter.userId && item.userId !== "__legacy__") {
          return false;
        }
      } else if (item.userId !== filter.userId) {
        return false;
      }
    }
    if (filter?.statuses && !filter.statuses.includes(item.status)) return false;
    if (filter?.opType && item.opType !== filter.opType) return false;
    return true;
  });

  return sortOutboxItemsDeterministically(filtered);
}

export async function updateOutboxItem(
  id: string,
  patch: Partial<Omit<OutboxItem, "id">>
): Promise<OutboxItem | null> {
  const existing = await getOutboxItem(id);
  if (!existing) return null;

  const updated: OutboxItem = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  await upsertOutboxItem(updated);
  return updated;
}

export async function removeOutboxItem(id: string): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const existing = await getOutboxItem(id);
  await withDbTransaction(STORE_OUTBOX, "readwrite", (tx) =>
    tx.objectStore(STORE_OUTBOX).delete(id)
  );
  if (existing) {
    broadcastOfflineEvent({
      type: "OUTBOX_UPDATED",
      storeId: existing.storeId,
      scopeKey: existing.scopeKey,
      at: new Date().toISOString(),
    });
  }
}

export async function removeOutboxItemsByIds(ids: string[]): Promise<void> {
  if (!isIndexedDBSupported() || ids.length === 0) return;
  await withDbTransaction(STORE_OUTBOX, "readwrite", async (tx) => {
    const store = tx.objectStore(STORE_OUTBOX);
    await Promise.all(ids.map((id) => reqToPromise(store.delete(id))));
  });
}

export async function retryOutboxItem(id: string): Promise<OutboxItem | null> {
  return updateOutboxItem(id, {
    status: "pending",
    retryCount: 0,
    nextRetryAt: new Date(0).toISOString(),
    lastError: undefined,
    errorCode: undefined,
    conflictData: undefined,
  });
}

export async function markOutboxAuthPaused(
  userId: string,
  storeId: string,
  paused: boolean
): Promise<number> {
  if (!isIndexedDBSupported()) return 0;
  const scopeKey = makeScopeKey(userId, storeId);
  const targetStatus: OutboxStatus = paused ? "pending" : "auth_paused";
  const nextStatus: OutboxStatus = paused ? "auth_paused" : "pending";
  const items = await getOutboxItems({
    scopeKey,
    storeId,
    statuses: [targetStatus],
    includeLegacyUserForStore: true,
  });

  if (items.length === 0) return 0;
  const nowIso = new Date().toISOString();

  await withDbTransaction(STORE_OUTBOX, "readwrite", async (tx) => {
    const store = tx.objectStore(STORE_OUTBOX);
    await Promise.all(
      items.map((item) =>
        reqToPromise(
          store.put({
            ...item,
            status: nextStatus,
            nextRetryAt: paused ? item.nextRetryAt : nowIso,
            updatedAt: nowIso,
          } satisfies OutboxItem)
        )
      )
    );
  });

  broadcastOfflineEvent({
    type: "AUTH_PAUSED",
    storeId,
    paused,
    at: nowIso,
  });

  return items.length;
}

/**
 * Supprime sélectivement des éléments de l'outbox.
 * Par sécurité, ne supprime JAMAIS les opérations non synchronisées sauf demande explicite (`includeUnsynced: true`).
 */
export async function clearOutboxForScope(
  scopeKeyOrStoreId: string,
  opts?: {
    mode?: "scope" | "store";
    includeUnsynced?: boolean;
    statuses?: OutboxStatus[];
  }
): Promise<number> {
  if (!isIndexedDBSupported()) return 0;
  const mode = opts?.mode || "scope";
  const allowedStatuses: OutboxStatus[] =
    opts?.statuses ||
    (opts?.includeUnsynced
      ? ["pending", "syncing", "failed", "conflict", "auth_paused", "done"]
      : ["done"]);

  const items = await getOutboxItems(
    mode === "scope"
      ? { scopeKey: scopeKeyOrStoreId, statuses: allowedStatuses }
      : { storeId: scopeKeyOrStoreId, statuses: allowedStatuses }
  );

  if (items.length === 0) return 0;

  await removeOutboxItemsByIds(items.map((i) => i.id));
  broadcastOfflineEvent({
    type: "OUTBOX_UPDATED",
    storeId: items[0].storeId,
    scopeKey: items[0].scopeKey,
    at: new Date().toISOString(),
  });
  return items.length;
}

export async function getOutboxCounts(filter: {
  scopeKey?: string;
  storeId?: string;
  includeLegacyUserForStore?: boolean;
}): Promise<OutboxCounts> {
  const items = await getOutboxItems(filter);
  const counts: OutboxCounts = {
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
    authPaused: 0,
    done: 0,
    actionableTotal: 0,
    attentionTotal: 0,
  };

  for (const item of items) {
    switch (item.status) {
      case "pending":
        counts.pending += 1;
        break;
      case "syncing":
        counts.syncing += 1;
        break;
      case "failed":
        counts.failed += 1;
        break;
      case "conflict":
        counts.conflict += 1;
        break;
      case "auth_paused":
        counts.authPaused += 1;
        break;
      case "done":
        counts.done += 1;
        break;
    }
  }

  counts.actionableTotal = counts.pending + counts.syncing + counts.authPaused;
  counts.attentionTotal = counts.failed + counts.conflict + counts.authPaused;
  return counts;
}

// ─── Store Snapshots (`userId:storeId`) ─────────────────────────────────────

export async function saveStoreSnapshot(params: {
  userId: string;
  storeId: string;
  role: string;
  state: StoreState;
  lastServerSyncAt?: string | null;
  extra?: StoreSnapshotExtra;
}): Promise<StoreSnapshotRecord> {
  const scopeKey = makeScopeKey(params.userId, params.storeId);
  const sanitizedState = sanitizeSnapshotStateForRole(params.state, params.role);

  const record: StoreSnapshotRecord = {
    scopeKey,
    userId: params.userId,
    storeId: params.storeId,
    role: params.role,
    schemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION,
    cachedAt: new Date().toISOString(),
    lastServerSyncAt: params.lastServerSyncAt ?? null,
    state: sanitizedState,
    extra: isAdminRole(params.role)
      ? params.extra
      : params.extra
        ? {
            debtPayments: params.extra.debtPayments,
            productUnitsByProduct: params.extra.productUnitsByProduct
              ? Object.fromEntries(
                  Object.entries(params.extra.productUnitsByProduct).map(
                    ([pid, units]) => [
                      pid,
                      (units || []).map((u) => ({ ...u, cost: null })),
                    ]
                  )
                )
              : undefined,
          }
        : undefined,
  };

  if (isIndexedDBSupported()) {
    await withDbTransaction(STORE_SNAPSHOTS, "readwrite", (tx) =>
      tx.objectStore(STORE_SNAPSHOTS).put(record)
    );
  }

  broadcastOfflineEvent({
    type: "SNAPSHOT_UPDATED",
    storeId: params.storeId,
    scopeKey,
    at: record.cachedAt,
  });

  return record;
}

export async function getStoreSnapshot(
  userId: string,
  storeId: string
): Promise<StoreSnapshotRecord | null> {
  if (!isIndexedDBSupported() || !userId || !storeId) return null;
  const scopeKey = makeScopeKey(userId, storeId);
  const snap = await withDbTransaction<StoreSnapshotRecord | undefined>(
    STORE_SNAPSHOTS,
    "readonly",
    (tx) => tx.objectStore(STORE_SNAPSHOTS).get(scopeKey)
  );
  return snap || null;
}

export async function deleteStoreSnapshot(
  userId: string,
  storeId: string
): Promise<void> {
  if (!isIndexedDBSupported() || !userId || !storeId) return;
  const scopeKey = makeScopeKey(userId, storeId);
  await withDbTransaction(STORE_SNAPSHOTS, "readwrite", (tx) =>
    tx.objectStore(STORE_SNAPSHOTS).delete(scopeKey)
  );
}

/**
 * À la déconnexion explicite, purge uniquement les snapshots cachés de cet utilisateur
 * (ex: données sensibles admin), sans JAMAIS supprimer les opérations non synchronisées de l'outbox.
 */
export async function clearSensitiveSnapshotsForUser(
  userId: string
): Promise<number> {
  if (!isIndexedDBSupported() || !userId) return 0;
  const snaps = await withDbTransaction<StoreSnapshotRecord[]>(
    STORE_SNAPSHOTS,
    "readonly",
    (tx) => tx.objectStore(STORE_SNAPSHOTS).index("userId").getAll(userId)
  );
  if (snaps.length === 0) return 0;

  await withDbTransaction(STORE_SNAPSHOTS, "readwrite", async (tx) => {
    const store = tx.objectStore(STORE_SNAPSHOTS);
    await Promise.all(snaps.map((s) => reqToPromise(store.delete(s.scopeKey))));
  });

  return snaps.length;
}

// ─── Sync Cursors (Synchronisation Incrémentale) ────────────────────────────

export async function getSyncCursor(
  userId: string,
  storeId: string,
  entityTable: string
): Promise<SyncCursorRecord | null> {
  if (!isIndexedDBSupported() || !userId || !storeId) return null;
  const key = makeCursorKey(userId, storeId, entityTable);
  const cursor = await withDbTransaction<SyncCursorRecord | undefined>(
    STORE_SYNC_CURSORS,
    "readonly",
    (tx) => tx.objectStore(STORE_SYNC_CURSORS).get(key)
  );
  return cursor || null;
}

export async function getAllSyncCursorsForScope(
  userId: string,
  storeId: string
): Promise<SyncCursorRecord[]> {
  if (!isIndexedDBSupported() || !userId || !storeId) return [];
  const scopeKey = makeScopeKey(userId, storeId);
  return withDbTransaction<SyncCursorRecord[]>(
    STORE_SYNC_CURSORS,
    "readonly",
    (tx) => tx.objectStore(STORE_SYNC_CURSORS).index("by_scope").getAll(scopeKey)
  );
}

export async function saveSyncCursor(params: {
  userId: string;
  storeId: string;
  entityTable: string;
  lastSyncedAt: string;
  lastRecordCount?: number;
}): Promise<SyncCursorRecord> {
  const scopeKey = makeScopeKey(params.userId, params.storeId);
  const record: SyncCursorRecord = {
    cursorKey: makeCursorKey(params.userId, params.storeId, params.entityTable),
    scopeKey,
    userId: params.userId,
    storeId: params.storeId,
    entityTable: params.entityTable,
    lastSyncedAt: params.lastSyncedAt,
    lastRecordCount: params.lastRecordCount,
    updatedAt: new Date().toISOString(),
  };

  if (isIndexedDBSupported()) {
    await withDbTransaction(STORE_SYNC_CURSORS, "readwrite", (tx) =>
      tx.objectStore(STORE_SYNC_CURSORS).put(record)
    );
  }

  return record;
}

export async function clearSyncCursorsForScope(
  userId: string,
  storeId: string
): Promise<void> {
  if (!isIndexedDBSupported() || !userId || !storeId) return;
  const cursors = await getAllSyncCursorsForScope(userId, storeId);
  if (cursors.length === 0) return;

  await withDbTransaction(STORE_SYNC_CURSORS, "readwrite", async (tx) => {
    const store = tx.objectStore(STORE_SYNC_CURSORS);
    await Promise.all(
      cursors.map((c) => reqToPromise(store.delete(c.cursorKey)))
    );
  });
}

// ─── Sync Logs (Traçabilité & Audit) ─────────────────────────────────────────

export async function appendSyncLog(params: {
  userId: string;
  storeId: string;
  level: SyncLogLevel;
  message: string;
  opType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<SyncLogEntry> {
  const entry: SyncLogEntry = {
    id: generateClientUUID(),
    scopeKey: makeScopeKey(params.userId, params.storeId),
    userId: params.userId || "__legacy__",
    storeId: params.storeId,
    level: params.level,
    opType: params.opType,
    entityId: params.entityId,
    message: params.message,
    details: params.details,
    timestamp: new Date().toISOString(),
  };

  if (!isIndexedDBSupported()) return entry;

  try {
    await withDbTransaction(STORE_SYNC_LOGS, "readwrite", (tx) =>
      tx.objectStore(STORE_SYNC_LOGS).put(entry)
    );
    // Rotation légère non bloquante si dépassement
    void pruneOldSyncLogs(MAX_SYNC_LOGS_TOTAL).catch(() => {});
  } catch (err) {
    console.warn("[OfflineDB] Impossible d'écrire le log de synchro:", err);
  }

  return entry;
}

export async function getSyncLogs(filter?: {
  storeId?: string;
  scopeKey?: string;
  level?: SyncLogLevel;
  limit?: number;
}): Promise<SyncLogEntry[]> {
  if (!isIndexedDBSupported()) return [];

  let entries: SyncLogEntry[];
  if (filter?.storeId && typeof IDBKeyRange !== "undefined") {
    entries = await withDbTransaction<SyncLogEntry[]>(
      STORE_SYNC_LOGS,
      "readonly",
      (tx) => {
        const range = IDBKeyRange.bound(
          [filter.storeId!, ""],
          [filter.storeId!, "\uffff"]
        );
        return tx.objectStore(STORE_SYNC_LOGS).index("by_store_time").getAll(range);
      }
    );
  } else {
    entries = await withDbTransaction<SyncLogEntry[]>(
      STORE_SYNC_LOGS,
      "readonly",
      (tx) => tx.objectStore(STORE_SYNC_LOGS).getAll()
    );
  }

  const filtered = entries
    .filter((e) => {
      if (filter?.storeId && e.storeId !== filter.storeId) return false;
      if (filter?.scopeKey && e.scopeKey !== filter.scopeKey) return false;
      if (filter?.level && e.level !== filter.level) return false;
      return true;
    })
    .sort(
      (a, b) =>
        (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
    );

  return filter?.limit ? filtered.slice(0, filter.limit) : filtered;
}

/**
 * Purge uniquement les anciens journaux (en gardant prioritairement les erreurs/conflits récents).
 * Ne touche JAMAIS aux stores `outbox`, `snapshots` ou `sync_cursors`.
 */
export async function pruneOldSyncLogs(maxKeepTotal = 400): Promise<number> {
  if (!isIndexedDBSupported()) return 0;
  const allLogs = await withDbTransaction<SyncLogEntry[]>(
    STORE_SYNC_LOGS,
    "readonly",
    (tx) => tx.objectStore(STORE_SYNC_LOGS).getAll()
  );

  if (allLogs.length <= maxKeepTotal) return 0;

  // On purge en premier les logs `info`, puis les plus anciens au-delà de la limite
  const sortedForDeletion = [...allLogs].sort((a, b) => {
    const aIsInfo = a.level === "info" ? 0 : 1;
    const bIsInfo = b.level === "info" ? 0 : 1;
    if (aIsInfo !== bIsInfo) return aIsInfo - bIsInfo;
    return (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0);
  });

  const toDeleteCount = allLogs.length - maxKeepTotal;
  const idsToDelete = sortedForDeletion
    .slice(0, toDeleteCount)
    .map((e) => e.id);

  await withDbTransaction(STORE_SYNC_LOGS, "readwrite", async (tx) => {
    const store = tx.objectStore(STORE_SYNC_LOGS);
    await Promise.all(idsToDelete.map((id) => reqToPromise(store.delete(id))));
  });

  return idsToDelete.length;
}

// ─── Diagnostics de Quota & Stockage Persistant ─────────────────────────────

export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function"
  ) {
    return false;
  }
  try {
    if (typeof navigator.storage.persisted === "function") {
      const already = await navigator.storage.persisted();
      if (already) return true;
    }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageDiagnostics(
  storeId?: string
): Promise<StorageDiagnostics> {
  const idbSupported = isIndexedDBSupported();
  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  let usagePercent: number | null = null;
  let persisted: boolean | null = null;

  if (typeof navigator !== "undefined" && navigator.storage) {
    try {
      if (typeof navigator.storage.estimate === "function") {
        const est = await navigator.storage.estimate();
        quotaBytes = typeof est.quota === "number" ? est.quota : null;
        usageBytes = typeof est.usage === "number" ? est.usage : null;
        if (quotaBytes && quotaBytes > 0 && usageBytes !== null) {
          usagePercent = Math.round((usageBytes / quotaBytes) * 1000) / 10;
        }
      }
      if (typeof navigator.storage.persisted === "function") {
        persisted = await navigator.storage.persisted();
      }
    } catch {}
  }

  let outboxCount = 0;
  let snapshotCount = 0;
  let logCount = 0;

  if (idbSupported) {
    try {
      const db = await openOfflineDB();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(
          [STORE_OUTBOX, STORE_SNAPSHOTS, STORE_SYNC_LOGS],
          "readonly"
        );
        const outReq = storeId
          ? tx.objectStore(STORE_OUTBOX).index("by_store").count(storeId)
          : tx.objectStore(STORE_OUTBOX).count();
        const snapReq = storeId
          ? tx.objectStore(STORE_SNAPSHOTS).index("storeId").count(storeId)
          : tx.objectStore(STORE_SNAPSHOTS).count();
        const logReq = tx.objectStore(STORE_SYNC_LOGS).count();

        outReq.onsuccess = () => {
          outboxCount = outReq.result || 0;
        };
        snapReq.onsuccess = () => {
          snapshotCount = snapReq.result || 0;
        };
        logReq.onsuccess = () => {
          logCount = logReq.result || 0;
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  return {
    indexedDBAvailable: idbSupported,
    quotaBytes,
    usageBytes,
    usagePercent,
    isNearLimit:
      (usagePercent !== null &&
        usagePercent >= STORAGE_WARNING_THRESHOLD_PERCENT) ||
      lastStorageError === "QUOTA_EXCEEDED",
    persisted,
    outboxCount,
    snapshotCount,
    logCount,
    lastStorageError,
  };
}

// ─── Migration sans perte depuis v1 (`pending_sales` + `localStorage`) ───────

function readJsonFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export interface MigrationSummary {
  migratedSales: number;
  migratedDebtPayments: number;
  migratedCashSessions: number;
  migratedSnapshot: boolean;
}

/**
 * Migre de façon idempotente et sans perte toutes les opérations et caches v1
 * (`pending_sales` IndexedDB + clés `localStorage`) vers les stores structurés v2.
 */
export async function migrateLegacyOfflineStorage(options?: {
  userId?: string;
  storeId?: string;
  role?: string;
}): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    migratedSales: 0,
    migratedDebtPayments: 0,
    migratedCashSessions: 0,
    migratedSnapshot: false,
  };

  if (!isIndexedDBSupported()) return summary;

  const targetUserId = options?.userId || "__legacy__";
  const lsSales = readJsonFromLocalStorage<OfflineSaleItem[]>(
    LEGACY_LS_KEYS.OFFLINE_SALES,
    []
  );
  const lsDebts = readJsonFromLocalStorage<PendingDebtPaymentItem[]>(
    LEGACY_LS_KEYS.PENDING_DEBT_PAYMENTS,
    []
  );
  const lsCash = readJsonFromLocalStorage<PendingCashSessionItem[]>(
    LEGACY_LS_KEYS.PENDING_CASH_SESSIONS,
    []
  );

  let idbV1Sales: OfflineSaleItem[] = [];
  try {
    idbV1Sales = await withDbTransaction<OfflineSaleItem[]>(
      STORE_PENDING_SALES_V1,
      "readonly",
      (tx) => tx.objectStore(STORE_PENDING_SALES_V1).getAll()
    );
  } catch {
    idbV1Sales = [];
  }

  // Fusion sans perte entre IDB v1 et le miroir localStorage
  const mergedSales = new Map<string, OfflineSaleItem>();
  for (const item of lsSales) {
    if (item?.id && item?.storeId && item?.sale) mergedSales.set(item.id, item);
  }
  for (const item of idbV1Sales) {
    if (item?.id && item?.storeId && item?.sale) mergedSales.set(item.id, item);
  }

  await withDbTransaction(STORE_OUTBOX, "readwrite", async (tx) => {
    const outboxStore = tx.objectStore(STORE_OUTBOX);
    const existingKeysRaw = await reqToPromise<IDBValidKey[]>(
      outboxStore.getAllKeys()
    );
    const existingKeys = new Set(existingKeysRaw.map((k) => String(k)));
    const puts: Promise<IDBValidKey>[] = [];

    // 1. Ventes hors-ligne
    for (const saleItem of Array.from(mergedSales.values())) {
      const outboxId = `sale:${saleItem.id}`;
      if (existingKeys.has(outboxId)) continue;
      existingKeys.add(outboxId);

      const effectiveUser =
        saleItem.sale?.userId || targetUserId || "__legacy__";
      const createdAt =
        saleItem.createdAt ||
        saleItem.sale?.createdAt ||
        new Date().toISOString();
      const record: OutboxItem<Sale> = {
        id: outboxId,
        idempotencyKey: saleItem.id,
        scopeKey: makeScopeKey(effectiveUser, saleItem.storeId),
        userId: effectiveUser,
        storeId: saleItem.storeId,
        opType: "COMPLETE_SALE",
        entityType: "sale",
        entityId: saleItem.id,
        payload: saleItem.sale,
        expectedUpdatedAt: null,
        priority: getDefaultPriorityForOp("COMPLETE_SALE"),
        sequence: nextSequence(),
        status: saleItem.status === "failed" ? "failed" : "pending",
        retryCount: saleItem.retryCount || 0,
        nextRetryAt: createdAt,
        lastAttemptAt: saleItem.lastAttemptAt,
        lastError: saleItem.lastError,
        createdAt,
        updatedAt: new Date().toISOString(),
      };
      puts.push(reqToPromise(outboxStore.put(record)));
      summary.migratedSales += 1;
    }

    // 2. Remboursements de dettes en attente
    for (const debtItem of lsDebts) {
      if (!debtItem?.id || !debtItem?.storeId) continue;
      const outboxId = `debt:${debtItem.id}`;
      if (existingKeys.has(outboxId)) continue;
      existingKeys.add(outboxId);

      const createdAt = debtItem.createdAt || new Date().toISOString();
      const record: OutboxItem<PendingDebtPaymentItem> = {
        id: outboxId,
        idempotencyKey: debtItem.id,
        scopeKey: makeScopeKey(targetUserId, debtItem.storeId),
        userId: targetUserId,
        storeId: debtItem.storeId,
        opType: "RECORD_DEBT_PAYMENT",
        entityType: "debt_payment",
        entityId: debtItem.id,
        payload: debtItem,
        expectedUpdatedAt: null,
        priority: getDefaultPriorityForOp("RECORD_DEBT_PAYMENT"),
        sequence: nextSequence(),
        status: "pending",
        retryCount: 0,
        nextRetryAt: createdAt,
        createdAt,
        updatedAt: new Date().toISOString(),
      };
      puts.push(reqToPromise(outboxStore.put(record)));
      summary.migratedDebtPayments += 1;
    }

    // 3. Sessions de caisse en attente
    for (const cashItem of lsCash) {
      if (!cashItem?.id || !cashItem?.storeId || !cashItem?.session) continue;
      const isClosed = cashItem.session.status === "closed";
      const opType: OutboxOperationType = isClosed
        ? "CLOSE_CASH_SESSION"
        : "OPEN_CASH_SESSION";
      const outboxId = `${isClosed ? "cash_close" : "cash_open"}:${cashItem.session.id}`;
      if (existingKeys.has(outboxId)) continue;
      existingKeys.add(outboxId);

      const effectiveUser =
        cashItem.session.userId || targetUserId || "__legacy__";
      const createdAt =
        cashItem.createdAt ||
        (isClosed ? cashItem.session.closedAt : cashItem.session.openedAt) ||
        new Date().toISOString();
      const record: OutboxItem<CashSession> = {
        id: outboxId,
        idempotencyKey: outboxId,
        scopeKey: makeScopeKey(effectiveUser, cashItem.storeId),
        userId: effectiveUser,
        storeId: cashItem.storeId,
        opType,
        entityType: "cash_session",
        entityId: cashItem.session.id,
        payload: cashItem.session,
        expectedUpdatedAt: null,
        priority: getDefaultPriorityForOp(opType),
        sequence: nextSequence(),
        status: "pending",
        retryCount: 0,
        nextRetryAt: createdAt,
        createdAt,
        updatedAt: new Date().toISOString(),
      };
      puts.push(reqToPromise(outboxStore.put(record)));
      summary.migratedCashSessions += 1;
    }

    if (puts.length > 0) {
      await Promise.all(puts);
    }
  });

  // 4. Migration optionnelle du cache snapshot localStorage vers `snapshots` scoped `userId:storeId`
  if (
    options?.userId &&
    options?.storeId &&
    typeof window !== "undefined"
  ) {
    const markerKey = `${LEGACY_LS_KEYS.MIGRATION_DONE_PREFIX}${makeScopeKey(options.userId, options.storeId)}`;
    const alreadyMigratedSnap =
      window.localStorage.getItem(markerKey) === "1";

    if (!alreadyMigratedSnap) {
      const existingSnap = await getStoreSnapshot(
        options.userId,
        options.storeId
      );
      if (!existingSnap) {
        const legacyState = readJsonFromLocalStorage<StoreState | null>(
          `${LEGACY_LS_KEYS.LEGACY_STATE_PREFIX}${options.storeId}`,
          null
        );
        if (legacyState && Array.isArray(legacyState.products)) {
          const legacyDebts = readJsonFromLocalStorage<
            Record<string, DebtPayment[]> | undefined
          >(
            `${LEGACY_LS_KEYS.LEGACY_DEBT_PREFIX}${options.storeId}`,
            undefined
          );
          const legacyCashSessions = readJsonFromLocalStorage<
            CashSession[] | undefined
          >(
            `${LEGACY_LS_KEYS.LEGACY_CASH_PREFIX}${options.storeId}`,
            undefined
          );
          const stateWithCash: StoreState = legacyCashSessions
            ? {
                ...legacyState,
                cashSessions:
                  legacyState.cashSessions?.length > 0
                    ? legacyState.cashSessions
                    : legacyCashSessions,
              }
            : legacyState;

          await saveStoreSnapshot({
            userId: options.userId,
            storeId: options.storeId,
            role: options.role || "cashier",
            state: stateWithCash,
            extra: legacyDebts ? { debtPayments: legacyDebts } : undefined,
          });
          summary.migratedSnapshot = true;
        }
      }
      try {
        window.localStorage.setItem(markerKey, "1");
      } catch {}
    }
  }

  return summary;
}

/**
 * Rattache proprement d'éventuelles anciennes opérations `__legacy__` d'une boutique
 * à l'utilisateur authentifié courant lors de sa reconnexion.
 */
export async function adoptLegacyOutboxForScope(
  userId: string,
  storeId: string
): Promise<number> {
  if (!isIndexedDBSupported() || !userId || !storeId) return 0;
  const legacyScope = makeScopeKey("__legacy__", storeId);
  const legacyItems = await getOutboxItems({
    scopeKey: legacyScope,
    storeId,
  });

  if (legacyItems.length === 0) return 0;

  const targetScope = makeScopeKey(userId, storeId);
  const nowIso = new Date().toISOString();

  await withDbTransaction(STORE_OUTBOX, "readwrite", async (tx) => {
    const store = tx.objectStore(STORE_OUTBOX);
    await Promise.all(
      legacyItems.map((item) =>
        reqToPromise(
          store.put({
            ...item,
            userId,
            scopeKey: targetScope,
            updatedAt: nowIso,
          } satisfies OutboxItem)
        )
      )
    );
  });

  return legacyItems.length;
}

// ─── Sauvegarde / Restauration JSON avec Vérification d'Intégrité ───────────

/**
 * Hash déterministe synchrone FNV-1a double (64-bit hex sur 16 caractères)
 * fonctionnel aussi bien en HTTP, HTTPS, navigateur qu'en tests Node/Vitest.
 */
export function computeDeterministicChecksum(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i & 0xff) << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `fnv64:${part1}${part2}`;
}

export async function exportStoreOfflineBackup(
  userId: string,
  storeId: string
): Promise<OfflineBackupPayload> {
  const scopeKey = makeScopeKey(userId, storeId);
  const [snapshot, outbox, cursors, logs] = await Promise.all([
    getStoreSnapshot(userId, storeId),
    getOutboxItems({ scopeKey, storeId, includeLegacyUserForStore: true }),
    getAllSyncCursorsForScope(userId, storeId),
    getSyncLogs({ storeId, scopeKey, limit: 200 }),
  ]);

  const body = {
    format: "boutiquepro-offline-backup" as const,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    storeId,
    userId,
    snapshot,
    outbox,
    cursors,
    logs,
  };

  const checksum = computeDeterministicChecksum(
    JSON.stringify({
      storeId: body.storeId,
      userId: body.userId,
      snapshot: body.snapshot,
      outbox: body.outbox,
      cursors: body.cursors,
    })
  );

  return {
    ...body,
    checksum,
  };
}

export async function importStoreOfflineBackup(
  rawInput: string | OfflineBackupPayload,
  targetUserId: string,
  targetStoreId: string
): Promise<BackupImportResult> {
  let parsed: OfflineBackupPayload;
  try {
    parsed =
      typeof rawInput === "string"
        ? (JSON.parse(rawInput) as OfflineBackupPayload)
        : rawInput;
  } catch {
    return {
      success: false,
      importedOutboxCount: 0,
      skippedDuplicateCount: 0,
      restoredSnapshot: false,
      restoredCursorsCount: 0,
      error: "Fichier de sauvegarde JSON invalide ou corrompu.",
    };
  }

  if (
    !parsed ||
    parsed.format !== "boutiquepro-offline-backup" ||
    parsed.version !== 2
  ) {
    return {
      success: false,
      importedOutboxCount: 0,
      skippedDuplicateCount: 0,
      restoredSnapshot: false,
      restoredCursorsCount: 0,
      error: "Format de sauvegarde incompatible.",
    };
  }

  if (parsed.storeId !== targetStoreId) {
    return {
      success: false,
      importedOutboxCount: 0,
      skippedDuplicateCount: 0,
      restoredSnapshot: false,
      restoredCursorsCount: 0,
      error:
        "Cette sauvegarde appartient à une autre boutique et ne peut pas être importée ici.",
    };
  }

  const expectedChecksum = computeDeterministicChecksum(
    JSON.stringify({
      storeId: parsed.storeId,
      userId: parsed.userId,
      snapshot: parsed.snapshot,
      outbox: parsed.outbox,
      cursors: parsed.cursors,
    })
  );

  if (parsed.checksum !== expectedChecksum) {
    return {
      success: false,
      importedOutboxCount: 0,
      skippedDuplicateCount: 0,
      restoredSnapshot: false,
      restoredCursorsCount: 0,
      error:
        "Vérification d'intégrité échouée (checksum différent : fichier altéré).",
    };
  }

  const targetScope = makeScopeKey(targetUserId, targetStoreId);
  let importedOutboxCount = 0;
  let skippedDuplicateCount = 0;
  let restoredSnapshot = false;
  let restoredCursorsCount = 0;

  if (isIndexedDBSupported()) {
    // Fusion non destructive des opérations outbox
    await withDbTransaction(STORE_OUTBOX, "readwrite", async (tx) => {
      const store = tx.objectStore(STORE_OUTBOX);
      const existingKeysRaw = await reqToPromise<IDBValidKey[]>(
        store.getAllKeys()
      );
      const existingKeys = new Set(existingKeysRaw.map((k) => String(k)));
      const puts: Promise<IDBValidKey>[] = [];

      for (const item of parsed.outbox || []) {
        if (!item?.id || item.storeId !== targetStoreId) continue;
        if (existingKeys.has(item.id)) {
          skippedDuplicateCount += 1;
          continue;
        }
        existingKeys.add(item.id);
        puts.push(
          reqToPromise(
            store.put({
              ...item,
              userId: targetUserId,
              scopeKey: targetScope,
            } satisfies OutboxItem)
          )
        );
        importedOutboxCount += 1;
      }

      if (puts.length > 0) {
        await Promise.all(puts);
      }
    });

    // Restaure snapshot seulement s'il est plus récent ou si aucun snapshot local n'existe
    if (parsed.snapshot && parsed.snapshot.storeId === targetStoreId) {
      const currentSnap = await getStoreSnapshot(targetUserId, targetStoreId);
      const importTime = Date.parse(parsed.snapshot.cachedAt || "") || 0;
      const currentTime = Date.parse(currentSnap?.cachedAt || "") || 0;
      if (!currentSnap || importTime > currentTime) {
        await saveStoreSnapshot({
          userId: targetUserId,
          storeId: targetStoreId,
          role: parsed.snapshot.role || "cashier",
          state: parsed.snapshot.state,
          lastServerSyncAt: parsed.snapshot.lastServerSyncAt,
          extra: parsed.snapshot.extra,
        });
        restoredSnapshot = true;
      }
    }

    // Restaure curseurs manquants ou plus anciens
    for (const cursor of parsed.cursors || []) {
      if (!cursor?.entityTable || cursor.storeId !== targetStoreId) continue;
      const current = await getSyncCursor(
        targetUserId,
        targetStoreId,
        cursor.entityTable
      );
      if (!current) {
        await saveSyncCursor({
          userId: targetUserId,
          storeId: targetStoreId,
          entityTable: cursor.entityTable,
          lastSyncedAt: cursor.lastSyncedAt,
          lastRecordCount: cursor.lastRecordCount,
        });
        restoredCursorsCount += 1;
      }
    }
  }

  broadcastOfflineEvent({
    type: "OUTBOX_UPDATED",
    storeId: targetStoreId,
    scopeKey: targetScope,
    at: new Date().toISOString(),
  });

  return {
    success: true,
    importedOutboxCount,
    skippedDuplicateCount,
    restoredSnapshot,
    restoredCursorsCount,
  };
}
