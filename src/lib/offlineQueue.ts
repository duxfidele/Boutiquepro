import { Sale } from "@/context/StoreContext";

export interface OfflineSaleItem {
  id: string; // sale.id
  storeId: string;
  sale: Sale;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const DB_NAME = "BoutiquePro_Offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_sales";
const LOCAL_STORAGE_FALLBACK_KEY = "boutiquepro_offline_sales";

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

// Fallback LocalStorage si IndexedDB est restreint
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
  };

  if (!isIndexedDBAvailable()) {
    const list = getLocalStorageQueue();
    const updated = [item, ...list.filter((i) => i.id !== item.id)];
    saveLocalStorageQueue(updated);
    return;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = getLocalStorageQueue();
    const updated = [item, ...list.filter((i) => i.id !== item.id)];
    saveLocalStorageQueue(updated);
  }
}

export async function updateOfflineSale(item: OfflineSaleItem): Promise<void> {
  if (!isIndexedDBAvailable()) {
    const list = getLocalStorageQueue();
    const updated = [item, ...list.filter((i) => i.id !== item.id)];
    saveLocalStorageQueue(updated);
    return;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = getLocalStorageQueue();
    const updated = [item, ...list.filter((i) => i.id !== item.id)];
    saveLocalStorageQueue(updated);
  }
}

export async function getOfflineSales(storeId?: string): Promise<OfflineSaleItem[]> {
  if (!isIndexedDBAvailable()) {
    const all = getLocalStorageQueue();
    return storeId ? all.filter((i) => i.storeId === storeId) : all;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: OfflineSaleItem[] = req.result || [];
        const filtered = storeId ? results.filter((i) => i.storeId === storeId) : results;
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const all = getLocalStorageQueue();
    return storeId ? all.filter((i) => i.storeId === storeId) : all;
  }
}

export async function removeOfflineSale(saleId: string): Promise<void> {
  const lsList = getLocalStorageQueue();
  saveLocalStorageQueue(lsList.filter((i) => i.id !== saleId));

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
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

export async function getOfflineSalesCount(storeId?: string): Promise<number> {
  const items = await getOfflineSales(storeId);
  return items.length;
}

export async function clearOfflineQueue(storeId?: string): Promise<void> {
  if (!storeId) {
    saveLocalStorageQueue([]);
  } else {
    const lsList = getLocalStorageQueue().filter((i) => i.storeId !== storeId);
    saveLocalStorageQueue(lsList);
  }

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    if (!storeId) {
      return new Promise((resolve, reject) => {
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
