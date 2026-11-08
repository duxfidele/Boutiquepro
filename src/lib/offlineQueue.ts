import type { Sale, CashSession } from "@/context/StoreContext";

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

const DB_NAME = "BoutiquePro_Offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_sales";
const LOCAL_STORAGE_FALLBACK_KEY = "boutiquepro_offline_sales";
const PENDING_DEBT_PAYMENTS_KEY = "boutiquepro_pending_debt_payments";
const PENDING_CASH_SESSIONS_KEY = "boutiquepro_pending_cash_sessions";

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
export function isNetworkLikeError(err: any): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!err) return false;
  const msg = String(
    err?.message || err?.details || err?.hint || err || ""
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
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB non disponible"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("storeId", "storeId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fallback & miroir LocalStorage pour résilience totale
function getLocalStorageQueue(): OfflineSaleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageQueue(items: OfflineSaleItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Quota localStorage dépassé:", e);
  }
}

export async function saveOfflineSale(storeId: string, sale: Sale): Promise<void> {
  const item: OfflineSaleItem = {
    id: sale.id,
    storeId,
    sale,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
  };

  // Toujours sauvegarder dans le miroir localStorage immédiatement (synchrone, résistant à la fermeture d'onglet)
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue([item, ...lsList.filter((i) => i.id !== item.id)]);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Déjà protégé dans localStorage
  }
}

export async function updateOfflineSale(item: OfflineSaleItem): Promise<void> {
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue([item, ...lsList.filter((i) => i.id !== item.id)]);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Déjà mis à jour dans localStorage
  }
}

export async function getOfflineSales(storeId?: string): Promise<OfflineSaleItem[]> {
  const lsAll = getLocalStorageQueue();

  if (!isIndexedDBAvailable()) {
    return storeId ? lsAll.filter((i) => i.storeId === storeId) : lsAll;
  }

  try {
    const db = await openDB();
    const idbResults = await new Promise<OfflineSaleItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Fusion sans perte entre IndexedDB et le miroir localStorage
    const mergedMap = new Map<string, OfflineSaleItem>();
    lsAll.forEach((item) => {
      if (item?.id) mergedMap.set(item.id, item);
    });
    idbResults.forEach((item) => {
      if (item?.id) mergedMap.set(item.id, item);
    });

    const combined = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return storeId ? combined.filter((i) => i.storeId === storeId) : combined;
  } catch {
    return storeId ? lsAll.filter((i) => i.storeId === storeId) : lsAll;
  }
}

export async function removeOfflineSale(saleId: string): Promise<void> {
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue(lsList.filter((i) => i.id !== saleId));

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(saleId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Supprimé de localStorage
  }
}

// ─── File d'attente des remboursements de dettes hors-ligne ──────────────────

export function getPendingDebtPayments(storeId?: string): PendingDebtPaymentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_DEBT_PAYMENTS_KEY);
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
    localStorage.setItem(PENDING_DEBT_PAYMENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Erreur stockage file dette hors-ligne:", e);
  }
}

export function removePendingDebtPayment(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingDebtPayments();
    localStorage.setItem(
      PENDING_DEBT_PAYMENTS_KEY,
      JSON.stringify(existing.filter((i) => i.id !== id))
    );
  } catch {}
}

// ─── File d'attente des ouvertures / clôtures de caisse hors-ligne ───────────

export function getPendingCashSessions(storeId?: string): PendingCashSessionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_CASH_SESSIONS_KEY);
    const list: PendingCashSessionItem[] = raw ? JSON.parse(raw) : [];
    return storeId ? list.filter((i) => i.storeId === storeId) : list;
  } catch {
    return [];
  }
}

export function savePendingCashSession(storeId: string, session: CashSession): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingCashSessions();
    const item: PendingCashSessionItem = {
      id: session.id,
      storeId,
      session,
      createdAt: new Date().toISOString(),
    };
    const updated = [...existing.filter((i) => i.id !== session.id), item];
    localStorage.setItem(PENDING_CASH_SESSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Erreur stockage file session caisse hors-ligne:", e);
  }
}

export function removePendingCashSession(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingCashSessions();
    localStorage.setItem(
      PENDING_CASH_SESSIONS_KEY,
      JSON.stringify(existing.filter((i) => i.id !== sessionId))
    );
  } catch {}
}

// ─── Compteur global et utilitaires ──────────────────────────────────────────

export async function getOfflineSalesCount(storeId?: string): Promise<number> {
  const sales = await getOfflineSales(storeId);
  const actionableSales = sales.filter((i) => i.status !== "failed");
  const debtPayments = getPendingDebtPayments(storeId);
  const cashSessions = getPendingCashSessions(storeId);
  return actionableSales.length + debtPayments.length + cashSessions.length;
}

export async function clearOfflineQueue(storeId?: string): Promise<void> {
  if (!storeId) {
    saveLocalStorageQueue([]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(PENDING_DEBT_PAYMENTS_KEY);
        localStorage.removeItem(PENDING_CASH_SESSIONS_KEY);
      } catch {}
    }
  } else {
    const lsList = getLocalStorageQueue().filter((i) => i.storeId !== storeId);
    saveLocalStorageQueue(lsList);
    if (typeof window !== "undefined") {
      try {
        const remDebts = getPendingDebtPayments().filter((i) => i.storeId !== storeId);
        localStorage.setItem(PENDING_DEBT_PAYMENTS_KEY, JSON.stringify(remDebts));
        const remSessions = getPendingCashSessions().filter((i) => i.storeId !== storeId);
        localStorage.setItem(PENDING_CASH_SESSIONS_KEY, JSON.stringify(remSessions));
      } catch {}
    }
  }

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    if (!storeId) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      const items = await getOfflineSales(storeId);
      for (const item of items) {
        await removeOfflineSale(item.id);
      }
    }
  } catch {
    // Ignoré
  }
}

export async function getFailedOfflineSales(storeId?: string): Promise<OfflineSaleItem[]> {
  const all = await getOfflineSales(storeId);
  return all.filter((i) => i.status === "failed");
}

export async function retryOfflineSale(saleId: string): Promise<void> {
  const all = await getOfflineSales();
  const item = all.find((i) => i.id === saleId);
  if (item) {
    await updateOfflineSale({
      ...item,
      retryCount: 0,
      status: "pending",
      lastError: undefined,
    });
  }
}
