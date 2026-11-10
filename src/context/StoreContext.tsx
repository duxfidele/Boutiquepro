"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getNetworkHealthSnapshot,
  isAuthInvalidError,
  probeServerHealth,
  startNetworkMonitor,
  subscribeNetworkHealth,
  type NetworkHealthSnapshot,
  type NetworkHealthStatus,
} from "@/lib/networkMonitor";
import {
  adoptLegacyOutboxForScope,
  clearOutboxForScope,
  enqueueOutboxOperation,
  exportStoreOfflineBackup,
  generateClientUUID,
  getOutboxCounts,
  getOutboxItems,
  getStorageDiagnostics,
  getStoreSnapshot,
  getSyncLogs,
  importStoreOfflineBackup,
  makeScopeKey,
  migrateLegacyOfflineStorage,
  removeOutboxItem,
  requestPersistentStorage,
  retryOutboxItem,
  saveStoreSnapshot,
  subscribeOfflineEvents,
  type BackupImportResult,
  type OfflineBackupPayload,
  type OutboxCounts,
  type OutboxItem,
  type StorageDiagnostics,
  type SyncLogEntry,
} from "@/lib/offlineDb";
import { isNetworkLikeError, type OfflineSaleItem } from "@/lib/offlineQueue";
import {
  processOutboxForScope,
  pullStoreIncrementalDelta,
  resolveOutboxConflict,
  type SyncRunResult,
} from "@/lib/syncEngine";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────
export interface ProductUnit {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  multiplier: number;
  price?: number | null;
  cost?: number | null;
  barcode?: string | null;
  isReference: boolean;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  image: string;
  createdAt: string;
  updatedAt?: string;
  unit?: string;
  units?: ProductUnit[];
  storeId?: string;
  userId?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedUnit?: ProductUnit;
  unitPrice?: number;
  customTotal?: number;
  isAmountMode?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductBatch {
  id: string;
  storeId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  initialQuantity: number;
  currentQuantity: number;
  orderId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PriceHistoryEntry {
  id: string;
  storeId: string;
  productId: string;
  priceType: "selling" | "cost" | "unit_selling";
  unitName?: string | null;
  oldPrice: number;
  newPrice: number;
  changeReason?: string | null;
  userId?: string | null;
  userName?: string | null;
  createdAt: string;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitName?: string;
  unitMultiplier?: number;
}

export interface Quote {
  id: string;
  storeId: string;
  userId?: string | null;
  quoteNumber: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: "draft" | "sent" | "accepted" | "converted" | "rejected" | "expired";
  validityDate?: string | null;
  notes?: string | null;
  saleId?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: QuoteItem[];
}

export interface Order {
  id: string;
  supplierName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    costPrice: number;
    total: number;
    unitName?: string;
    unitMultiplier?: number;
    quantityReference?: number;
    batchNumber?: string;
    expiryDate?: string;
  }[];
  totalCost: number;
  status: "pending" | "received";
  createdAt: string;
  expectedAt?: string;
}

export interface DebtPayment {
  id: string;
  saleId: string;
  amount: number;
  paymentMethod: "cash" | "mobile_money" | "card";
  paidAt: string;
  cashierName?: string;
  note?: string;
}

export interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cost?: number;
  isEstimated?: boolean;
  unitName?: string;
  unitMultiplier?: number;
  quantityReference?: number;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: "cash" | "mobile_money" | "card" | "credit";
  amountGiven?: number;
  change?: number;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  userId?: string;
  storeId?: string;
  sessionId?: string | null;
  paymentStatus?: "paid" | "partial" | "unpaid";
  amountPaid?: number;
  remainingAmount?: number;
  dueDate?: string;
  notes?: string;
  payments?: DebtPayment[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalPurchases: number;
  lastVisit: string;
}

export interface StoreSettings {
  name: string;
  currency: string;
  taxRate: number;
  logo?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  managerName?: string;
  allowNegativeStock?: boolean;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  expectedStock: number;
  actualStock: number;
  variance: number;
  costPrice: number;
}

export interface InventorySession {
  id: string;
  date: string;
  items: InventoryItem[];
  totalVarianceValue: number;
  notes?: string;
}

export interface CashSession {
  id: string;
  storeId: string;
  userId: string;
  cashierName?: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  totalCashSales: number;
  totalMobileMoneySales: number;
  totalCardSales: number;
  totalSalesCount: number;
  totalSalesAmount: number;
  openedAt: string;
  closedAt?: string;
  status: "open" | "closed";
  notes?: string;
}

export interface StoreState {
  products: Product[];
  sales: Sale[];
  orders: Order[];
  expenses: Expense[];
  customers: Customer[];
  cart: CartItem[];
  categories: Category[];
  inventorySessions: InventorySession[];
  cashSessions: CashSession[];
  activeCashSession: CashSession | null;
  settings: StoreSettings;
  batches: ProductBatch[];
  priceHistory: PriceHistoryEntry[];
  quotes: Quote[];
}

// ─── Actions ─────────────────────────────────────────────────
export type Action =
  | { type: "ADD_PRODUCT"; payload: Product }
  | { type: "BATCH_ADD_PRODUCTS"; payload: Product[] }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | {
      type: "ADD_TO_CART";
      payload: Product | { product: Product; selectedUnit?: ProductUnit };
    }
  | {
      type: "REMOVE_FROM_CART";
      payload: string | { productId: string; unitId?: string };
    }
  | {
      type: "UPDATE_CART_QTY";
      payload: {
        productId: string;
        quantity: number;
        unitId?: string;
        customTotal?: number;
        isAmountMode?: boolean;
      };
    }
  | {
      type: "UPDATE_CART_UNIT";
      payload: {
        productId: string;
        oldUnitId?: string;
        selectedUnit?: ProductUnit;
      };
    }
  | { type: "CLEAR_CART" }
  | { type: "COMPLETE_SALE"; payload: Sale }
  | {
      type: "RECORD_DEBT_PAYMENT";
      payload: {
        saleId: string;
        paymentAmount: number;
        newPaid: number;
        newRemaining: number;
        newStatus: "paid" | "partial";
        method: "cash" | "mobile_money" | "card";
        payment?: DebtPayment;
      };
    }
  | { type: "ADD_CUSTOMER"; payload: Customer }
  | { type: "ADD_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "UPDATE_SETTINGS"; payload: Partial<StoreSettings> }
  | { type: "ADD_ORDER"; payload: Order }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "UPDATE_EXPENSE"; payload: Expense }
  | { type: "DELETE_EXPENSE"; payload: string }
  | {
      type: "UPDATE_ORDER_STATUS";
      payload: { orderId: string; status: "received" };
    }
  | { type: "DELETE_ORDER"; payload: string }
  | { type: "ADD_BATCH"; payload: ProductBatch }
  | { type: "DELETE_BATCH"; payload: string }
  | { type: "SET_PRICE_HISTORY"; payload: PriceHistoryEntry[] }
  | { type: "ADD_PRICE_HISTORY_ENTRY"; payload: PriceHistoryEntry }
  | { type: "ADD_QUOTE"; payload: Quote }
  | { type: "UPDATE_QUOTE"; payload: Quote }
  | { type: "DELETE_QUOTE"; payload: string }
  | {
      type: "CONVERT_QUOTE_TO_SALE";
      payload: { quoteId: string; sale: Sale };
    }
  | { type: "ADD_INVENTORY_SESSION"; payload: InventorySession }
  | { type: "OPEN_CASH_SESSION"; payload: CashSession }
  | { type: "CLOSE_CASH_SESSION"; payload: CashSession }
  | { type: "REALTIME_PRODUCT_UPDATE"; payload: Product }
  | { type: "REALTIME_PRODUCT_INSERT"; payload: Product }
  | { type: "REALTIME_PRODUCT_DELETE"; payload: string }
  | {
      type: "REALTIME_PRODUCT_COST_UPDATE";
      payload: { productId: string; cost: number };
    }
  | { type: "REALTIME_SALE_INSERT"; payload: Sale }
  | {
      type: "REALTIME_SALE_UPDATE";
      payload: Partial<Sale> & { id: string };
    }
  | { type: "LOAD_STATE"; payload: StoreState };

// ─── Catégories par défaut & État vierge strictement isolé ──
const defaultCategories: Category[] = [
  { id: "cat1", name: "Vêtements", icon: "👕", color: "#6343EA" },
  { id: "cat2", name: "Chaussures", icon: "👟", color: "#22C580" },
  { id: "cat3", name: "Accessoires", icon: "👜", color: "#F59E0B" },
  { id: "cat4", name: "Beauté", icon: "🧴", color: "#EC4899" },
];

const DEFAULT_SETTINGS: StoreSettings = {
  name: "MaBoutiquePro",
  logo: "/logo.png",
  currency: "FCFA",
  taxRate: 0,
  city: "Lomé",
  country: "Togo",
  email: "contact@maboutiquepro.app",
  phone: "+228 98 37 61 01",
  allowNegativeStock: false,
};

export function createCleanEmptyState(storeName?: string): StoreState {
  return {
    products: [],
    sales: [],
    orders: [],
    expenses: [],
    customers: [],
    cart: [],
    categories: defaultCategories,
    inventorySessions: [],
    cashSessions: [],
    activeCashSession: null,
    batches: [],
    priceHistory: [],
    quotes: [],
    settings: {
      ...DEFAULT_SETTINGS,
      name: storeName || DEFAULT_SETTINGS.name,
    },
  };
}

const EMPTY_OUTBOX_COUNTS: OutboxCounts = {
  pending: 0,
  syncing: 0,
  failed: 0,
  conflict: 0,
  authPaused: 0,
  done: 0,
  actionableTotal: 0,
  attentionTotal: 0,
};

// ─── Helpers Panier isolé par user + store ────────────────────
export function scopedCartKey(userId: string, storeId: string): string {
  return `bp_cart_${userId}_${storeId}`;
}

export function readScopedCart(userId: string, storeId: string): CartItem[] {
  if (typeof window === "undefined" || !userId || !storeId) return [];
  try {
    const raw = window.localStorage.getItem(scopedCartKey(userId, storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (c) => c && c.product && typeof c.product.price === "number"
        );
      }
    }
    // Repli unique depuis l'ancien cache par boutique uniquement si bp_last_auth_uid concorde
    const lastUid = window.localStorage.getItem("bp_last_auth_uid");
    if (!lastUid || lastUid === userId) {
      const legacyRaw = window.localStorage.getItem(
        `boutiquepro-state-${storeId}`
      );
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed?.cart)) {
          return parsed.cart.filter(
            (c: any) => c && c.product && typeof c.product.price === "number"
          );
        }
      }
    }
  } catch {}
  return [];
}

export function writeScopedCart(
  userId: string,
  storeId: string,
  cart: CartItem[]
): void {
  if (typeof window === "undefined" || !userId || !storeId) return;
  try {
    window.localStorage.setItem(
      scopedCartKey(userId, storeId),
      JSON.stringify(cart || [])
    );
  } catch {}
}

// ─── Fonctions pures d'agrégation des ventes & sessions ──────

export function isSameCalendarDay(
  d1: string | Date,
  d2: string | Date = new Date()
): boolean {
  try {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  } catch {
    return false;
  }
}

export function getSalesForSession(
  session: CashSession | null,
  allSales: Sale[],
  _allSessions: CashSession[] = []
): Sale[] {
  if (!session || !session.openedAt) return [];
  const sessionOpenedTime = new Date(session.openedAt).getTime();
  if (isNaN(sessionOpenedTime)) return [];
  const sessionClosedTime = session.closedAt
    ? new Date(session.closedAt).getTime()
    : Infinity;

  return (allSales || []).filter((s) => {
    if (!s || !s.createdAt) return false;
    const saleTime = new Date(s.createdAt).getTime();
    if (isNaN(saleTime)) return false;
    return saleTime >= sessionOpenedTime && saleTime <= sessionClosedTime;
  });
}

export interface SessionStats {
  opening: number;
  cashSalesOnly: number;
  creditDeposits: number;
  debtRecoveries: number;
  cash: number;
  mm: number;
  card: number;
  creditTotal: number;
  creditRemaining: number;
  total: number;
  totalCollected: number;
  count: number;
  expectedCashInDrawer: number;
}

export function getInitialCreditDeposit(s: Sale): {
  amount: number;
  method: "cash" | "mobile_money" | "card";
} {
  if (s.paymentMethod !== "credit") return { amount: 0, method: "cash" };

  if (Array.isArray(s.payments) && s.payments.length > 0) {
    const initPayment = s.payments.find(
      (p) =>
        p &&
        (p.note?.toLowerCase().includes("initial") ||
          p.id?.startsWith("init-") ||
          p.id?.startsWith("legacy-"))
    );
    if (initPayment && Number.isFinite(Number(initPayment.amount))) {
      const m =
        initPayment.paymentMethod === "mobile_money" ||
        initPayment.paymentMethod === "card"
          ? initPayment.paymentMethod
          : "cash";
      return { amount: Math.max(0, Number(initPayment.amount)), method: m };
    }
    const subsequentSum = s.payments
      .filter(
        (p) =>
          p &&
          !p.note?.toLowerCase().includes("initial") &&
          !p.id?.startsWith("init-") &&
          !p.id?.startsWith("legacy-")
      )
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const calculated = (Number(s.amountPaid) || 0) - subsequentSum;
    return { amount: Math.max(0, calculated), method: "cash" };
  }

  return { amount: Math.max(0, Number(s.amountPaid) || 0), method: "cash" };
}

export function getSessionStats(
  session: CashSession | null,
  allSales: Sale[],
  allSessions: CashSession[] = []
): SessionStats {
  const empty: SessionStats = {
    opening: 0,
    cashSalesOnly: 0,
    creditDeposits: 0,
    debtRecoveries: 0,
    cash: 0,
    mm: 0,
    card: 0,
    creditTotal: 0,
    creditRemaining: 0,
    total: 0,
    totalCollected: 0,
    count: 0,
    expectedCashInDrawer: 0,
  };
  if (!session || !session.openedAt) return empty;

  const sessionOpenedTime = new Date(session.openedAt).getTime();
  if (isNaN(sessionOpenedTime)) return empty;
  const sessionClosedTime = session.closedAt
    ? new Date(session.closedAt).getTime()
    : Infinity;

  const sessionSales = getSalesForSession(session, allSales, allSessions);

  let cashSalesOnly = 0;
  let creditDeposits = 0;
  let mmSales = 0;
  let cardSales = 0;
  let creditTotal = 0;
  let creditRemaining = 0;
  let totalSales = 0;

  sessionSales.forEach((s) => {
    if (!s) return;
    const saleTotal = Number(s.total) || 0;
    totalSales += saleTotal;

    if (s.paymentMethod === "cash") {
      cashSalesOnly += saleTotal;
    } else if (s.paymentMethod === "mobile_money") {
      mmSales += saleTotal;
    } else if (s.paymentMethod === "card") {
      cardSales += saleTotal;
    } else if (s.paymentMethod === "credit") {
      const initDeposit = getInitialCreditDeposit(s);
      if (initDeposit.method === "mobile_money") {
        mmSales += initDeposit.amount;
      } else if (initDeposit.method === "card") {
        cardSales += initDeposit.amount;
      } else {
        creditDeposits += initDeposit.amount;
      }
      creditTotal += saleTotal;
      const rem = Number.isFinite(Number(s.remainingAmount))
        ? Math.max(0, Number(s.remainingAmount))
        : Math.max(
            0,
            saleTotal - (Number(s.amountPaid) || initDeposit.amount)
          );
      creditRemaining += rem;
    }
  });

  let debtRecoveriesCash = 0;
  let debtRecoveriesMM = 0;
  let debtRecoveriesCard = 0;

  (allSales || []).forEach((sale) => {
    if (!sale || !sale.payments || !Array.isArray(sale.payments)) return;
    sale.payments.forEach((p) => {
      if (!p || !p.paidAt || !p.amount) return;
      const pTime = new Date(p.paidAt).getTime();
      if (isNaN(pTime)) return;
      if (pTime >= sessionOpenedTime && pTime <= sessionClosedTime) {
        const isSessionSale = sessionSales.some((ss) => ss.id === sale.id);
        const isInitialPayment =
          p.note?.toLowerCase().includes("initial") ||
          p.id?.startsWith("init-") ||
          p.id?.startsWith("legacy-");

        if (isSessionSale && isInitialPayment) {
          return;
        }

        const amt = Number(p.amount) || 0;
        if (p.paymentMethod === "mobile_money") {
          debtRecoveriesMM += amt;
        } else if (p.paymentMethod === "card") {
          debtRecoveriesCard += amt;
        } else {
          debtRecoveriesCash += amt;
        }
      }
    });
  });

  const totalCash = cashSalesOnly + creditDeposits + debtRecoveriesCash;
  const totalMM = mmSales + debtRecoveriesMM;
  const totalCard = cardSales + debtRecoveriesCard;
  const opening = Number(session.openingAmount) || 0;
  const expectedCashInDrawer = opening + totalCash;
  const totalCollected = totalCash + totalMM + totalCard;

  return {
    opening,
    cashSalesOnly,
    creditDeposits,
    debtRecoveries: debtRecoveriesCash,
    cash: totalCash,
    mm: totalMM,
    card: totalCard,
    creditTotal,
    creditRemaining,
    total: totalSales,
    totalCollected,
    count: sessionSales.length,
    expectedCashInDrawer,
  };
}

function getSaleItemRefQty(item: SaleItem): number {
  if (
    item.quantityReference !== undefined &&
    item.quantityReference !== null &&
    Number(item.quantityReference) > 0
  ) {
    return Number(item.quantityReference);
  }
  return Number(item.quantity) * (Number(item.unitMultiplier) || 1);
}

export function applySaleStockAndBatchesFEFO(
  products: Product[],
  batches: ProductBatch[],
  saleItems: SaleItem[],
  allowNegative: boolean
): { products: Product[]; batches: ProductBatch[] } {
  // 1. Agréger les quantités vendues par productId (corrige le bug multi-unités sur un même produit)
  const qtyByProduct = new Map<string, number>();
  for (const it of saleItems) {
    if (!it?.productId) continue;
    qtyByProduct.set(
      it.productId,
      (qtyByProduct.get(it.productId) || 0) + getSaleItemRefQty(it)
    );
  }

  const updatedProducts = products.map((p) => {
    const qtyToDeduct = qtyByProduct.get(p.id) || 0;
    if (!qtyToDeduct) return p;
    const rawNext = Math.round((p.stock - qtyToDeduct) * 1000) / 1000;
    return {
      ...p,
      stock: allowNegative ? rawNext : Math.max(0, rawNext),
    };
  });

  // 2. Décompte FEFO sur les lots (triés par date d'expiration croissante)
  const updatedBatches = [...batches];
  for (const soldItem of saleItems) {
    let remDeduct = getSaleItemRefQty(soldItem);
    if (remDeduct <= 0) continue;

    const prodBatches = updatedBatches
      .map((b, idx) => ({ ...b, idx }))
      .filter(
        (b) => b.productId === soldItem.productId && b.currentQuantity > 0
      )
      .sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      );

    for (const pb of prodBatches) {
      if (remDeduct <= 0) break;
      const ded = Math.min(pb.currentQuantity, remDeduct);
      updatedBatches[pb.idx] = {
        ...updatedBatches[pb.idx],
        currentQuantity: Math.round((pb.currentQuantity - ded) * 1000) / 1000,
      };
      remDeduct -= ded;
    }
  }

  return { products: updatedProducts, batches: updatedBatches };
}

export function refreshSessionStatsInList(
  activeSession: CashSession | null,
  cashSessions: CashSession[],
  sales: Sale[]
): {
  activeCashSession: CashSession | null;
  cashSessions: CashSession[];
} {
  if (!activeSession) {
    return { activeCashSession: null, cashSessions };
  }
  const stats = getSessionStats(activeSession, sales, cashSessions);
  const updatedActive: CashSession = {
    ...activeSession,
    totalCashSales: stats.cash,
    totalMobileMoneySales: stats.mm,
    totalCardSales: stats.card,
    totalSalesCount: stats.count,
    totalSalesAmount: stats.total,
    expectedAmount: stats.expectedCashInDrawer,
  };
  const updatedList = cashSessions.map((cs) =>
    cs.id === updatedActive.id ? updatedActive : cs
  );
  return { activeCashSession: updatedActive, cashSessions: updatedList };
}

// ─── Reducer ─────────────────────────────────────────────────
export function storeReducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "ADD_PRODUCT": {
      const exists = state.products.some((p) => p.id === action.payload.id);
      const nextProducts = exists
        ? state.products.map((p) =>
            p.id === action.payload.id ? action.payload : p
          )
        : [...state.products, action.payload];
      return {
        ...state,
        products: nextProducts.sort((a, b) => a.name.localeCompare(b.name)),
      };
    }

    case "BATCH_ADD_PRODUCTS": {
      const incomingMap = new Map<string, Product>();
      state.products.forEach((p) => incomingMap.set(p.id, p));
      action.payload.forEach((p) => incomingMap.set(p.id, p));
      return {
        ...state,
        products: Array.from(incomingMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      };
    }

    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products
          .map((p) => (p.id === action.payload.id ? action.payload : p))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };

    case "DELETE_PRODUCT":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.payload),
      };

    case "ADD_TO_CART": {
      const prod =
        "product" in action.payload
          ? (action.payload as { product: Product }).product
          : (action.payload as Product);
      const unit =
        "selectedUnit" in action.payload
          ? (action.payload as { selectedUnit?: ProductUnit }).selectedUnit
          : undefined;
      const unitId = unit ? unit.id : "ref";

      const existingIndex = state.cart.findIndex(
        (c) =>
          c.product.id === prod.id && (c.selectedUnit?.id || "ref") === unitId
      );
      if (existingIndex >= 0) {
        return {
          ...state,
          cart: state.cart.map((c, i) =>
            i === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      const unitPrice = unit
        ? unit.price ?? prod.price * unit.multiplier
        : prod.price;
      return {
        ...state,
        cart: [
          ...state.cart,
          { product: prod, quantity: 1, selectedUnit: unit, unitPrice },
        ],
      };
    }

    case "REMOVE_FROM_CART": {
      if (typeof action.payload === "string") {
        return {
          ...state,
          cart: state.cart.filter((c) => c.product.id !== action.payload),
        };
      }
      const { productId, unitId } = action.payload;
      return {
        ...state,
        cart: state.cart.filter(
          (c) =>
            !(
              c.product.id === productId &&
              (c.selectedUnit?.id || "ref") === (unitId || "ref")
            )
        ),
      };
    }

    case "UPDATE_CART_QTY": {
      const { productId, quantity, unitId, customTotal, isAmountMode } =
        action.payload;
      if (quantity <= 0 && (!customTotal || customTotal <= 0)) {
        return {
          ...state,
          cart: state.cart.filter(
            (c) =>
              !(
                c.product.id === productId &&
                (unitId ? (c.selectedUnit?.id || "ref") === unitId : true)
              )
          ),
        };
      }
      return {
        ...state,
        cart: state.cart.map((c) => {
          if (
            c.product.id === productId &&
            (!unitId || (c.selectedUnit?.id || "ref") === unitId)
          ) {
            return {
              ...c,
              quantity: Math.max(0, quantity),
              customTotal:
                customTotal !== undefined
                  ? customTotal
                  : isAmountMode === false
                    ? undefined
                    : c.customTotal,
              isAmountMode:
                isAmountMode !== undefined ? isAmountMode : c.isAmountMode,
            };
          }
          return c;
        }),
      };
    }

    case "UPDATE_CART_UNIT": {
      const { productId, oldUnitId, selectedUnit } = action.payload;
      return {
        ...state,
        cart: state.cart.map((c) => {
          if (
            c.product.id === productId &&
            (c.selectedUnit?.id || "ref") === (oldUnitId || "ref")
          ) {
            const unitPrice = selectedUnit
              ? selectedUnit.price ?? c.product.price * selectedUnit.multiplier
              : c.product.price;
            return { ...c, selectedUnit, unitPrice };
          }
          return c;
        }),
      };
    }

    case "CLEAR_CART":
      return { ...state, cart: [] };

    case "COMPLETE_SALE": {
      const saleExists = state.sales.some((s) => s.id === action.payload.id);
      const updatedSales = saleExists
        ? state.sales.map((s) =>
            s.id === action.payload.id ? { ...s, ...action.payload } : s
          )
        : [action.payload, ...state.sales];

      const allowNegative = Boolean(state.settings?.allowNegativeStock);
      const { products: updatedProducts, batches: updatedBatches } = saleExists
        ? { products: state.products, batches: state.batches }
        : applySaleStockAndBatchesFEFO(
            state.products,
            state.batches,
            action.payload.items || [],
            allowNegative
          );

      const { activeCashSession: nextActive, cashSessions: nextSessions } =
        refreshSessionStatsInList(
          state.activeCashSession,
          state.cashSessions,
          updatedSales
        );

      return {
        ...state,
        sales: updatedSales,
        products: updatedProducts,
        batches: updatedBatches,
        cart: [],
        activeCashSession: nextActive,
        cashSessions: nextSessions,
      };
    }

    case "RECORD_DEBT_PAYMENT": {
      const { saleId, newPaid, newRemaining, newStatus, payment } =
        action.payload;
      const updatedSales = state.sales.map((s) => {
        if (s.id !== saleId) return s;
        const prevPayments = s.payments || [];
        const hasPay = payment && prevPayments.some((p) => p.id === payment.id);
        return {
          ...s,
          amountPaid: newPaid,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
          payments:
            payment && !hasPay ? [payment, ...prevPayments] : prevPayments,
        };
      });

      const { activeCashSession: nextActive, cashSessions: nextSessions } =
        refreshSessionStatsInList(
          state.activeCashSession,
          state.cashSessions,
          updatedSales
        );

      return {
        ...state,
        sales: updatedSales,
        activeCashSession: nextActive,
        cashSessions: nextSessions,
      };
    }

    case "ADD_EXPENSE":
      return {
        ...state,
        expenses: [
          action.payload,
          ...state.expenses.filter((e) => e.id !== action.payload.id),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };

    case "UPDATE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses
          .map((e) => (e.id === action.payload.id ? action.payload : e))
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
      };

    case "DELETE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      };

    case "ADD_ORDER":
      return {
        ...state,
        orders: [
          action.payload,
          ...state.orders.filter((o) => o.id !== action.payload.id),
        ],
      };

    case "ADD_BATCH":
      return {
        ...state,
        batches: [
          action.payload,
          ...state.batches.filter((b) => b.id !== action.payload.id),
        ],
      };

    case "DELETE_BATCH":
      return {
        ...state,
        batches: state.batches.filter((b) => b.id !== action.payload),
      };

    case "SET_PRICE_HISTORY":
      return { ...state, priceHistory: action.payload };

    case "ADD_PRICE_HISTORY_ENTRY":
      return {
        ...state,
        priceHistory: [
          action.payload,
          ...(state.priceHistory || []).filter(
            (h) => h.id !== action.payload.id
          ),
        ],
      };

    case "ADD_QUOTE":
      return {
        ...state,
        quotes: [
          action.payload,
          ...(state.quotes || []).filter((q) => q.id !== action.payload.id),
        ],
      };

    case "UPDATE_QUOTE":
      return {
        ...state,
        quotes: (state.quotes || []).map((q) =>
          q.id === action.payload.id ? action.payload : q
        ),
      };

    case "DELETE_QUOTE":
      return {
        ...state,
        quotes: (state.quotes || []).filter((q) => q.id !== action.payload),
      };

    case "CONVERT_QUOTE_TO_SALE": {
      const { quoteId, sale } = action.payload;
      const updatedQuotes = (state.quotes || []).map((q) =>
        q.id === quoteId
          ? { ...q, status: "converted" as const, saleId: sale.id }
          : q
      );

      const saleExists = state.sales.some((s) => s.id === sale.id);
      const updatedSales = saleExists ? state.sales : [sale, ...state.sales];

      const allowNegative = Boolean(state.settings?.allowNegativeStock);
      const { products: updatedProducts, batches: updatedBatches } = saleExists
        ? { products: state.products, batches: state.batches || [] }
        : applySaleStockAndBatchesFEFO(
            state.products,
            state.batches || [],
            sale.items || [],
            allowNegative
          );

      const { activeCashSession: nextActive, cashSessions: nextSessions } =
        refreshSessionStatsInList(
          state.activeCashSession,
          state.cashSessions,
          updatedSales
        );

      return {
        ...state,
        sales: updatedSales,
        products: updatedProducts,
        batches: updatedBatches,
        quotes: updatedQuotes,
        activeCashSession: nextActive,
        cashSessions: nextSessions,
      };
    }

    case "DELETE_ORDER":
      return {
        ...state,
        orders: state.orders.filter((o) => o.id !== action.payload),
      };

    case "UPDATE_ORDER_STATUS": {
      const order = state.orders.find((o) => o.id === action.payload.orderId);
      if (!order || order.status === "received") return state;

      const updatedOrders = state.orders.map((o) =>
        o.id === action.payload.orderId
          ? { ...o, status: "received" as const }
          : o
      );

      // Agrégation multi-lignes par productId
      const qtyByProd = new Map<string, number>();
      const costByProd = new Map<string, number>();
      for (const it of order.items) {
        const mult = Number(it.unitMultiplier) || 1;
        const refQty =
          it.quantityReference !== undefined &&
          it.quantityReference !== null &&
          Number(it.quantityReference) > 0
            ? Number(it.quantityReference)
            : Number(it.quantity) * mult;
        qtyByProd.set(it.productId, (qtyByProd.get(it.productId) || 0) + refQty);
        const newRefCost =
          mult > 0 ? Number(it.costPrice) / mult : Number(it.costPrice);
        if (newRefCost > 0) {
          costByProd.set(it.productId, Number(newRefCost.toFixed(4)));
        }
      }

      const updatedProducts = state.products.map((p) => {
        const addQty = qtyByProd.get(p.id) || 0;
        const newCost = costByProd.get(p.id);
        if (!addQty && !newCost) return p;
        return {
          ...p,
          stock: Math.round((p.stock + addQty) * 1000) / 1000,
          cost: newCost && newCost > 0 ? newCost : p.cost,
        };
      });

      const nowIso = new Date().toISOString();
      const createdBatches: ProductBatch[] = [];
      order.items.forEach((it) => {
        if (it.batchNumber && it.expiryDate) {
          const mult = Number(it.unitMultiplier) || 1;
          const refQty =
            it.quantityReference !== undefined &&
            it.quantityReference !== null &&
            Number(it.quantityReference) > 0
              ? Number(it.quantityReference)
              : Number(it.quantity) * mult;
          createdBatches.push({
            id: generateClientUUID(),
            storeId:
              state.products.find((p) => p.id === it.productId)?.storeId || "",
            productId: it.productId,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate,
            initialQuantity: refQty,
            currentQuantity: refQty,
            orderId: order.id,
            createdAt: nowIso,
          });
        }
      });

      const orderPriceHistoryEntries: PriceHistoryEntry[] = [];
      order.items.forEach((it) => {
        const prod = state.products.find((p) => p.id === it.productId);
        if (prod) {
          const mult = Number(it.unitMultiplier) || 1;
          const newRefCost =
            mult > 0 ? Number(it.costPrice) / mult : Number(it.costPrice);
          if (newRefCost > 0 && Number(newRefCost.toFixed(4)) !== Number(prod.cost)) {
            orderPriceHistoryEntries.push({
              id: generateClientUUID(),
              storeId: prod.storeId || "",
              productId: it.productId,
              priceType: "cost",
              oldPrice: Number(prod.cost) || 0,
              newPrice: Number(newRefCost.toFixed(4)),
              changeReason: `Réception commande #${order.id.slice(-6)}`,
              userName: "Admin",
              createdAt: nowIso,
            });
          }
        }
      });

      return {
        ...state,
        orders: updatedOrders,
        products: updatedProducts,
        batches: [...createdBatches, ...state.batches],
        priceHistory:
          orderPriceHistoryEntries.length > 0
            ? [...orderPriceHistoryEntries, ...(state.priceHistory || [])]
            : state.priceHistory || [],
      };
    }

    case "ADD_CUSTOMER":
      return {
        ...state,
        customers: [
          ...state.customers.filter((c) => c.id !== action.payload.id),
          action.payload,
        ],
      };

    case "ADD_CATEGORY":
      return {
        ...state,
        categories: [
          ...state.categories.filter((c) => c.id !== action.payload.id),
          action.payload,
        ],
      };

    case "DELETE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
      };

    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case "ADD_INVENTORY_SESSION": {
      const exists = state.inventorySessions.some(
        (s) => s.id === action.payload.id
      );
      if (exists) return state;

      const newSessions = [action.payload, ...state.inventorySessions];
      const varianceByProd = new Map<string, number>();
      action.payload.items.forEach((item) => {
        const v =
          item.variance !== undefined && Number.isFinite(Number(item.variance))
            ? Number(item.variance)
            : Number(item.actualStock) - Number(item.expectedStock);
        varianceByProd.set(item.productId, (varianceByProd.get(item.productId) || 0) + v);
      });

      const allowNegative = Boolean(state.settings?.allowNegativeStock);
      const updatedProducts = state.products.map((p) => {
        const variance = varianceByProd.get(p.id);
        if (variance === undefined) return p;
        const nextStock = Math.round((p.stock + variance) * 1000) / 1000;
        return {
          ...p,
          stock: allowNegative ? nextStock : Math.max(0, nextStock),
        };
      });
      return {
        ...state,
        inventorySessions: newSessions,
        products: updatedProducts,
      };
    }

    case "OPEN_CASH_SESSION": {
      const updated = [
        action.payload,
        ...state.cashSessions
          .filter((cs) => cs.id !== action.payload.id)
          .map((cs) =>
            cs.status === "open" &&
            (!cs.userId || cs.userId === action.payload.userId)
              ? { ...cs, status: "closed" as const, closedAt: action.payload.openedAt }
              : cs
          ),
      ];
      return {
        ...state,
        activeCashSession: action.payload,
        cashSessions: updated,
      };
    }

    case "CLOSE_CASH_SESSION": {
      const exists = state.cashSessions.some(
        (cs) => cs.id === action.payload.id
      );
      const updated = exists
        ? state.cashSessions.map((cs) =>
            cs.id === action.payload.id ? action.payload : cs
          )
        : [action.payload, ...state.cashSessions];
      return {
        ...state,
        activeCashSession: null,
        cashSessions: updated,
      };
    }

    case "REALTIME_PRODUCT_UPDATE": {
      const updated = action.payload;
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === updated.id
            ? {
                ...p,
                ...updated,
                cost:
                  updated.cost !== undefined && updated.cost !== null
                    ? updated.cost
                    : p.cost,
                units: p.units,
              }
            : p
        ),
      };
    }

    case "REALTIME_PRODUCT_COST_UPDATE": {
      const { productId, cost } = action.payload;
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === productId ? { ...p, cost } : p
        ),
      };
    }

    case "REALTIME_PRODUCT_INSERT": {
      const newProd = action.payload;
      if (state.products.some((p) => p.id === newProd.id)) {
        return {
          ...state,
          products: state.products.map((p) =>
            p.id === newProd.id ? { ...p, ...newProd } : p
          ),
        };
      }
      return {
        ...state,
        products: [...state.products, newProd].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      };
    }

    case "REALTIME_PRODUCT_DELETE":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.payload),
      };

    case "REALTIME_SALE_INSERT": {
      const sale = action.payload;
      if (state.sales.some((s) => s.id === sale.id)) return state;
      const nextSales = [sale, ...state.sales];
      const { activeCashSession: nextActive, cashSessions: nextSessions } =
        refreshSessionStatsInList(
          state.activeCashSession,
          state.cashSessions,
          nextSales
        );
      return {
        ...state,
        sales: nextSales,
        activeCashSession: nextActive,
        cashSessions: nextSessions,
      };
    }

    case "REALTIME_SALE_UPDATE": {
      const updated = action.payload;
      const nextSales = state.sales.map((s) =>
        s.id === updated.id ? { ...s, ...updated } : s
      );
      const { activeCashSession: nextActive, cashSessions: nextSessions } =
        refreshSessionStatsInList(
          state.activeCashSession,
          state.cashSessions,
          nextSales
        );
      return {
        ...state,
        sales: nextSales,
        activeCashSession: nextActive,
        cashSessions: nextSessions,
      };
    }

    case "LOAD_STATE": {
      const rawSales = action.payload.sales || [];
      const salesMap = new Map<string, Sale>();
      rawSales.forEach((s: Sale) => {
        if (s && s.id && !salesMap.has(s.id)) salesMap.set(s.id, s);
      });
      const dedupSales = Array.from(salesMap.values()).sort(
        (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      );
      const nextCashSessions = action.payload.cashSessions || [];
      const { activeCashSession: nextActive, cashSessions: syncedCashSessions } =
        refreshSessionStatsInList(
          action.payload.activeCashSession || null,
          nextCashSessions,
          dedupSales
        );

      return {
        ...action.payload,
        sales: dedupSales,
        products: [...(action.payload.products || [])].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        categories:
          action.payload.categories && action.payload.categories.length > 0
            ? action.payload.categories
            : defaultCategories,
        orders: action.payload.orders || [],
        cart: action.payload.cart || [],
        inventorySessions: action.payload.inventorySessions || [],
        expenses: action.payload.expenses || [],
        cashSessions: syncedCashSessions,
        activeCashSession: nextActive,
        batches: action.payload.batches || [],
        priceHistory: action.payload.priceHistory || [],
        quotes: action.payload.quotes || [],
      };
    }

    default:
      return state;
  }
}

// ─── Context Interface ───────────────────────────────────────
export interface StoreContextType {
  state: StoreState;
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  expenses: Expense[];
  orders: Order[];
  quotes: Quote[];
  dispatch: (action: Action) => void;
  formatPrice: (amount: number) => string;
  lowStockProducts: Product[];
  totalRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  todayOrders: number;
  averageBasket: number;
  categorySales: Record<string, number>;
  categoryNames: string[];
  totalExpenses: number;
  netProfit: number;
  activeCashSession: CashSession | null;
  cashSessions: CashSession[];
  currentSessionSales: Sale[];
  currentSessionStats: SessionStats;
  openCashSession: (
    openingAmount: number,
    cashierName?: string
  ) => Promise<CashSession>;
  closeCashSession: (
    closingAmount: number,
    notes?: string
  ) => Promise<CashSession | null>;
  isOnline: boolean;
  isInitialized: boolean;
  networkStatus: NetworkHealthStatus;
  networkHealth: NetworkHealthSnapshot;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  outboxCounts: OutboxCounts;
  outboxItems: OutboxItem[];
  conflictItems: OutboxItem[];
  syncLogs: SyncLogEntry[];
  storageDiagnostics: StorageDiagnostics | null;
  syncOfflineSales: () => Promise<{ success: number; failed: number }>;
  clearOfflineSalesQueue: () => Promise<void>;
  failedOfflineSales: OfflineSaleItem[];
  retryFailedSale: (
    saleId: string
  ) => Promise<{ success: number; failed: number }>;
  refreshFailedOfflineSales: () => Promise<void>;
  triggerManualSync: (opts?: { forcePull?: boolean }) => Promise<SyncRunResult>;
  retryOutboxOperation: (itemId: string) => Promise<void>;
  dismissOutboxOperation: (itemId: string) => Promise<void>;
  resolveConflict: (
    itemId: string,
    decision: "keep_server" | "force_local" | "dismiss"
  ) => Promise<{ success: boolean; error?: string }>;
  refreshOutbox: () => Promise<void>;
  exportOfflineBackup: () => Promise<OfflineBackupPayload | null>;
  importOfflineBackup: (rawJson: string) => Promise<BackupImportResult>;
  isRealtimeActive: boolean;
  unpaidDebts: Sale[];
  totalDebtsAmount: number;
  totalCreditSales: number;
  totalRecoveredAmount: number;
  totalCollectedRevenue: number;
  recoveryRate: number;
  overdueDebtsCount: number;
  collectedNetProfit: number;
  closedCashSessions: CashSession[];
  totalCashDifference: number;
  totalCashShortage: number;
  totalCashSurplus: number;
  todayCashDifference: number;
  todayCashShortage: number;
  cashDiscrepancyRate: number;
  totalPhysicalCashAndBank: number;
  discrepantSessionsCount: number;
  lastClosedCashSession: CashSession | null;
  recordDebtPayment: (
    saleId: string,
    amount: number,
    method?: "cash" | "mobile_money" | "card",
    note?: string,
    cashierName?: string
  ) => Promise<DebtPayment | null>;
  createDirectDebt: (data: {
    customerName: string;
    customerPhone?: string;
    description: string;
    totalAmount: number;
    initialDeposit?: number;
    depositPaymentMethod?: "cash" | "mobile_money" | "card";
    dueDate?: string;
    notes?: string;
  }) => Promise<Sale>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const isSubscriptionExpiredError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || err.details || err.hint || "").toLowerCase();
  const isExplicitSubGate =
    msg.includes("abonnement expiré") ||
    msg.includes("sub_gate") ||
    msg.includes("subscription_ends_at") ||
    msg.includes("is_store_subscription_active");
  const isSubscriptionP0001 =
    err.code === "P0001" &&
    (msg.includes("abonnement") ||
      msg.includes("forfait") ||
      msg.includes("souscription") ||
      msg.includes("essai") ||
      msg.includes("expired") ||
      msg.includes("subscription"));
  return isExplicitSubGate || isSubscriptionP0001;
};

const EMPTY_SYNC_RESULT: SyncRunResult = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  conflicts: 0,
  authPaused: false,
  networkOffline: false,
  skippedLocked: false,
  syncedEntityTypes: [],
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const {
    activeStore,
    user,
    role,
    setActiveStore,
    authStatus,
    sessionExpired,
    markSessionExpired,
    markSessionRestored,
  } = useAuth();

  const isAdmin = role === "admin" || activeStore?.role === "admin";
  const effectiveRole = role || activeStore?.role || "cashier";

  const [state, dispatchBase] = useReducer(storeReducer, undefined, () =>
    createCleanEmptyState(activeStore?.name)
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Santé réseau réelle (probe serveur vs faux en-ligne)
  const [networkHealth, setNetworkHealth] = useState<NetworkHealthSnapshot>(
    () => getNetworkHealthSnapshot()
  );
  const isOnline = networkHealth.isReachable;

  // États Outbox, conflits & journaux
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [outboxCounts, setOutboxCounts] =
    useState<OutboxCounts>(EMPTY_OUTBOX_COUNTS);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [storageDiagnostics, setStorageDiagnostics] =
    useState<StorageDiagnostics | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  // Refs toujours à jour pour éviter toute closure obsolète
  const stateRef = useRef<StoreState>(state);
  const userRef = useRef(user);
  const activeStoreRef = useRef(activeStore);
  const effectiveRoleRef = useRef(effectiveRole);
  const networkHealthRef = useRef(networkHealth);
  const authStatusRef = useRef(authStatus);
  const sessionExpiredRef = useRef(sessionExpired);
  const lastSyncedAtRef = useRef(lastSyncedAt);
  const isInitializedRef = useRef(isInitialized);
  const scopeTokenRef = useRef<string | null>(null);
  const syncInProgressRef = useRef(false);
  const snapshotSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  stateRef.current = state;
  userRef.current = user;
  activeStoreRef.current = activeStore;
  effectiveRoleRef.current = effectiveRole;
  networkHealthRef.current = networkHealth;
  authStatusRef.current = authStatus;
  sessionExpiredRef.current = sessionExpired;
  lastSyncedAtRef.current = lastSyncedAt;
  isInitializedRef.current = isInitialized;

  // ── Rafraîchir état local outbox / conflits / diagnostics ────────────────
  const refreshOutbox = useCallback(async () => {
    const uid = userRef.current?.id;
    const sid = activeStoreRef.current?.id;
    if (!uid || !sid) {
      setOutboxItems([]);
      setOutboxCounts(EMPTY_OUTBOX_COUNTS);
      setSyncLogs([]);
      return;
    }

    const scopeKey = makeScopeKey(uid, sid);
    try {
      const [items, counts, logs, diag] = await Promise.all([
        getOutboxItems({
          scopeKey,
          storeId: sid,
          includeLegacyUserForStore: true,
        }),
        getOutboxCounts({
          scopeKey,
          storeId: sid,
          includeLegacyUserForStore: true,
        }),
        getSyncLogs({ storeId: sid, scopeKey, limit: 60 }),
        getStorageDiagnostics(sid),
      ]);

      // Vérifier qu'on n'a pas changé de boutique pendant la lecture async
      if (
        userRef.current?.id !== uid ||
        activeStoreRef.current?.id !== sid
      ) {
        return;
      }

      setOutboxItems(items);
      setOutboxCounts(counts);
      setSyncLogs(logs);
      setStorageDiagnostics(diag);
    } catch (err) {
      console.warn("[StoreContext] Erreur lecture outbox/diagnostics:", err);
    }
  }, []);

  const refreshFailedOfflineSales = useCallback(async () => {
    await refreshOutbox();
  }, [refreshOutbox]);

  // ── Persistance immédiate du snapshot scoped `${userId}:${storeId}` ──────
  const persistSnapshotNow = useCallback(
    async (nextState: StoreState, serverSyncIso?: string | null) => {
      const uid = userRef.current?.id;
      const sid = activeStoreRef.current?.id;
      if (!uid || !sid) return;
      try {
        await saveStoreSnapshot({
          userId: uid,
          storeId: sid,
          role: effectiveRoleRef.current || "cashier",
          state: nextState,
          lastServerSyncAt: serverSyncIso ?? lastSyncedAtRef.current,
        });
      } catch (err) {
        console.warn("[StoreContext] Avertissement sauvegarde snapshot IDB:", err);
      }
    },
    []
  );

  // Sauvegarde automatique réactive du snapshot & panier à chaque évolution state
  useEffect(() => {
    const uid = user?.id;
    const sid = activeStore?.id;
    if (!isInitialized || !uid || !sid) return;

    writeScopedCart(uid, sid, state.cart);

    if (snapshotSaveTimerRef.current) {
      clearTimeout(snapshotSaveTimerRef.current);
    }
    snapshotSaveTimerRef.current = setTimeout(() => {
      void persistSnapshotNow(stateRef.current);
    }, 120);

    return () => {
      if (snapshotSaveTimerRef.current) {
        clearTimeout(snapshotSaveTimerRef.current);
        snapshotSaveTimerRef.current = null;
      }
    };
  }, [state, isInitialized, user?.id, activeStore?.id, persistSnapshotNow]);

  // ── Cycle de Synchronisation Complet (Push Outbox -> Pull Delta) ─────────
  const runSyncCycle = useCallback(
    async (opts?: {
      forceAll?: boolean;
      forcePull?: boolean;
      reason?: string;
    }): Promise<SyncRunResult> => {
      const uid = userRef.current?.id;
      const sid = activeStoreRef.current?.id;
      const storeName = activeStoreRef.current?.name || "MaBoutiquePro";
      const curRole = effectiveRoleRef.current || "cashier";

      if (!uid || !sid) return EMPTY_SYNC_RESULT;
      if (syncInProgressRef.current) return EMPTY_SYNC_RESULT;
      if (sessionExpiredRef.current) {
        return { ...EMPTY_SYNC_RESULT, authPaused: true };
      }

      if (!networkHealthRef.current.isReachable) {
        const probe = await probeServerHealth({ timeoutMs: 3000 });
        if (!probe.isReachable) {
          return { ...EMPTY_SYNC_RESULT, networkOffline: true };
        }
      }

      const cycleScope = makeScopeKey(uid, sid);
      syncInProgressRef.current = true;
      setIsSyncing(true);

      let result: SyncRunResult = EMPTY_SYNC_RESULT;

      try {
        // 1. Pousser d'abord toutes les mutations en outbox selon l'ordre causal
        result = await processOutboxForScope({
          userId: uid,
          storeId: sid,
          role: curRole,
          forceAll: Boolean(opts?.forceAll),
        });

        if (result.authPaused) {
          markSessionExpired();
          setSyncError(
            "Session expirée : vos opérations restent en sécurité localement. Reconnectez-vous pour synchroniser."
          );
        } else if (result.conflicts > 0) {
          setSyncError(
            `${result.conflicts} conflit(s) de version détecté(s). Ouvrez le centre de synchronisation pour arbitrer.`
          );
        } else if (result.failed > 0 && !result.networkOffline) {
          setSyncError(
            `${result.failed} opération(s) en échec nécessitent une vérification.`
          );
        } else if (!result.networkOffline) {
          setSyncError(null);
        }

        // 2. Descendre les deltas serveur (si quelque chose a changé, sur synchro forcée, ou pull demandé)
        const shouldPull =
          !result.authPaused &&
          !result.networkOffline &&
          (opts?.forcePull ||
            result.succeeded > 0 ||
            opts?.reason === "network_restored" ||
            opts?.reason === "session_restored" ||
            opts?.reason === "manual");

        if (shouldPull && scopeTokenRef.current === cycleScope) {
          try {
            const pulled = await pullStoreIncrementalDelta({
              userId: uid,
              storeId: sid,
              storeName,
              role: curRole,
              currentState: stateRef.current,
              forceFull: Boolean(opts?.forcePull),
            });

            if (scopeTokenRef.current === cycleScope) {
              const latestCart = stateRef.current.cart || [];
              const mergedState: StoreState = {
                ...pulled.state,
                cart: latestCart,
              };
              dispatchBase({ type: "LOAD_STATE", payload: mergedState });
              setLastSyncedAt(pulled.serverSyncAt);

              if (
                pulled.state.settings?.name &&
                activeStoreRef.current?.name !== pulled.state.settings.name
              ) {
                setActiveStore({
                  ...activeStoreRef.current,
                  name: pulled.state.settings.name,
                });
              }
            }
          } catch (pullErr) {
            if (isAuthInvalidError(pullErr)) {
              markSessionExpired();
            } else if (!isNetworkLikeError(pullErr)) {
              console.warn("[StoreContext] Avertissement pull delta:", pullErr);
            }
          }
        }
      } catch (err) {
        if (isAuthInvalidError(err)) {
          markSessionExpired();
          result = { ...result, authPaused: true };
        }
      } finally {
        await refreshOutbox();
        syncInProgressRef.current = false;
        setIsSyncing(false);
      }

      return result;
    },
    [markSessionExpired, refreshOutbox, setActiveStore]
  );

  // ── Démarrage du Moniteur Réseau + Abonnement Cross-Tab ──────────────────
  useEffect(() => {
    const stopMonitor = startNetworkMonitor();
    let prevReachable = getNetworkHealthSnapshot().isReachable;

    const unsubHealth = subscribeNetworkHealth((snap) => {
      setNetworkHealth(snap);
      if (snap.authInvalid) {
        markSessionExpired();
      }
      if (!prevReachable && snap.isReachable && !snap.authInvalid) {
        // Reconnexion réseau confirmée : synchroniser immédiatement
        void runSyncCycle({ forceAll: false, reason: "network_restored" });
      }
      prevReachable = snap.isReachable;
    });

    const unsubEvents = subscribeOfflineEvents((ev) => {
      const curStoreId = activeStoreRef.current?.id;
      if (!curStoreId || ev.storeId !== curStoreId) return;

      if (
        ev.type === "OUTBOX_UPDATED" ||
        ev.type === "CONFLICT_DETECTED" ||
        ev.type === "AUTH_PAUSED"
      ) {
        void refreshOutbox();
      }
      if (ev.type === "SNAPSHOT_UPDATED") {
        const uid = userRef.current?.id;
        if (uid && !syncInProgressRef.current) {
          void getStoreSnapshot(uid, curStoreId).then((snap) => {
            if (
              snap &&
              userRef.current?.id === uid &&
              activeStoreRef.current?.id === curStoreId &&
              Date.parse(snap.cachedAt) >
                Date.parse(lastSyncedAtRef.current || "0") + 500
            ) {
              dispatchBase({
                type: "LOAD_STATE",
                payload: {
                  ...snap.state,
                  cart: stateRef.current.cart || [],
                },
              });
            }
          });
        }
      }
    });

    return () => {
      unsubHealth();
      unsubEvents();
      stopMonitor();
    };
  }, [markSessionExpired, refreshOutbox, runSyncCycle]);

  // ── Reprise automatique lorsque la session auth est restaurée ────────────
  const prevAuthStatusRef = useRef(authStatus);
  useEffect(() => {
    const prev = prevAuthStatusRef.current;
    prevAuthStatusRef.current = authStatus;
    if (prev === "session_expired" && authStatus === "authenticated") {
      markSessionRestored();
      void runSyncCycle({ forceAll: true, reason: "session_restored" });
    }
  }, [authStatus, markSessionRestored, runSyncCycle]);

  // ── Boucle légère de retry automatique backoff en arrière-plan ───────────
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id || !activeStore?.id) return;

    const timer = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (
        syncInProgressRef.current ||
        sessionExpiredRef.current ||
        !networkHealthRef.current.isReachable
      ) {
        return;
      }
      if (outboxCounts.pending > 0) {
        void runSyncCycle({ forceAll: false, reason: "backoff_timer" });
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [user?.id, activeStore?.id, outboxCounts.pending, runSyncCycle]);

  // ── Chargement initial isolé (IDB instantané -> Push -> Pull incrémental) ─
  useEffect(() => {
    const uid = user?.id;
    const sid = activeStore?.id;
    const storeName = activeStore?.name || "MaBoutiquePro";

    if (!uid || !sid || sid === "default") {
      scopeTokenRef.current = null;
      dispatchBase({
        type: "LOAD_STATE",
        payload: createCleanEmptyState(),
      });
      setOutboxItems([]);
      setOutboxCounts(EMPTY_OUTBOX_COUNTS);
      setSyncLogs([]);
      setLastSyncedAt(null);
      setIsInitialized(true);
      return;
    }

    const activeScope = makeScopeKey(uid, sid);
    scopeTokenRef.current = activeScope;
    setIsInitialized(false);
    setSyncError(null);

    // 1. Reset synchrone immédiat pour empêcher toute fuite visuelle d'une autre boutique
    const scopedCart = readScopedCart(uid, sid);
    dispatchBase({
      type: "LOAD_STATE",
      payload: {
        ...createCleanEmptyState(storeName),
        cart: scopedCart,
      },
    });

    let cancelled = false;

    async function bootstrapStoreScope() {
      try {
        // 2. Migration silencieuse v1 -> v2 + adoption éventuelle d'opérations legacy
        await migrateLegacyOfflineStorage({
          userId: uid!,
          storeId: sid!,
          role: effectiveRole,
        });
        await adoptLegacyOutboxForScope(uid!, sid!);
        void requestPersistentStorage();

        if (cancelled || scopeTokenRef.current !== activeScope) return;

        // 3. Restauration instantanée depuis le snapshot IndexedDB isolé (`userId:storeId`)
        const snap = await getStoreSnapshot(uid!, sid!);
        if (cancelled || scopeTokenRef.current !== activeScope) return;

        if (snap?.state) {
          dispatchBase({
            type: "LOAD_STATE",
            payload: {
              ...snap.state,
              cart: readScopedCart(uid!, sid!),
            },
          });
          setLastSyncedAt(snap.lastServerSyncAt || snap.cachedAt || null);
        }

        await refreshOutbox();
        if (cancelled || scopeTokenRef.current !== activeScope) return;
        setIsInitialized(true);

        // 4. Sondage serveur réel : si joignable et session active, pousser puis tirer le delta
        const health = await probeServerHealth({ timeoutMs: 3500 });
        if (cancelled || scopeTokenRef.current !== activeScope) return;

        if (!health.isReachable) {
          return;
        }
        if (health.authInvalid || sessionExpiredRef.current) {
          markSessionExpired();
          return;
        }

        // Pousser les opérations locales en attente AVANT de tirer le serveur
        const pushRes = await processOutboxForScope({
          userId: uid!,
          storeId: sid!,
          role: effectiveRole,
        });

        if (cancelled || scopeTokenRef.current !== activeScope) return;

        if (pushRes.authPaused) {
          markSessionExpired();
          await refreshOutbox();
          return;
        }

        // Tirer l'état incrémental (protégé par le bouclier outbox anti-écrasement)
        try {
          const pulled = await pullStoreIncrementalDelta({
            userId: uid!,
            storeId: sid!,
            storeName,
            role: effectiveRole,
            currentState: snap?.state
              ? { ...snap.state, cart: readScopedCart(uid!, sid!) }
              : stateRef.current,
          });

          if (cancelled || scopeTokenRef.current !== activeScope) return;

          dispatchBase({
            type: "LOAD_STATE",
            payload: {
              ...pulled.state,
              cart: stateRef.current.cart || scopedCart,
            },
          });
          setLastSyncedAt(pulled.serverSyncAt);
        } catch (pullErr) {
          if (isAuthInvalidError(pullErr)) {
            markSessionExpired();
          } else if (!isNetworkLikeError(pullErr)) {
            console.warn(
              "[StoreContext] Rafraîchissement distant partiel (cache IDB conservé):",
              pullErr
            );
          }
        }

        await refreshOutbox();
      } catch (err) {
        console.warn("[StoreContext] Erreur initialisation boutique:", err);
      } finally {
        if (!cancelled && scopeTokenRef.current === activeScope) {
          setIsInitialized(true);
        }
      }
    }

    void bootstrapStoreScope();

    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    activeStore?.id,
    effectiveRole,
    markSessionExpired,
    refreshOutbox,
  ]);

  // ── Synchronisation Temps Réel (Supabase Realtime) ───────────────────────
  useEffect(() => {
    if (!activeStore?.id || !user?.id) return;

    const uid = user.id;
    const sid = activeStore.id;
    const scopeKey = makeScopeKey(uid, sid);
    const channelName = `store_${sid}_realtime`;

    const hasPendingOpFor = async (entityType: string, entityId: string) => {
      try {
        const pendings = await getOutboxItems({
          scopeKey,
          storeId: sid,
          statuses: ["pending", "syncing", "conflict", "auth_paused"],
          includeLegacyUserForStore: true,
        });
        return pendings.some(
          (p) => p.entityType === entityType && p.entityId === entityId
        );
      } catch {
        return false;
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `store_id=eq.${sid}`,
        },
        async (payload: any) => {
          if (payload.eventType === "UPDATE") {
            const p = payload.new;
            if (await hasPendingOpFor("product", p.id)) return;
            dispatchBase({
              type: "REALTIME_PRODUCT_UPDATE",
              payload: {
                id: p.id,
                name: p.name,
                sku: p.sku,
                category: p.category,
                price: Number(p.price) || 0,
                cost: undefined as unknown as number,
                stock: Number(p.stock) || 0,
                minStock: Number(p.min_stock || 0),
                image: p.image || "📦",
                createdAt: p.created_at || new Date().toISOString(),
                updatedAt: p.updated_at || undefined,
              },
            });
          } else if (payload.eventType === "INSERT") {
            const p = payload.new;
            if (await hasPendingOpFor("product", p.id)) return;
            dispatchBase({
              type: "REALTIME_PRODUCT_INSERT",
              payload: {
                id: p.id,
                name: p.name,
                sku: p.sku,
                category: p.category,
                price: Number(p.price) || 0,
                cost: 0,
                stock: Number(p.stock) || 0,
                minStock: Number(p.min_stock || 0),
                image: p.image || "📦",
                createdAt: p.created_at || new Date().toISOString(),
                updatedAt: p.updated_at || undefined,
              },
            });
          } else if (payload.eventType === "DELETE") {
            if (payload.old?.id) {
              if (await hasPendingOpFor("product", payload.old.id)) return;
              dispatchBase({
                type: "REALTIME_PRODUCT_DELETE",
                payload: payload.old.id,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `store_id=eq.${sid}`,
        },
        async (payload: any) => {
          if (payload.eventType === "INSERT") {
            const s = payload.new;
            if (!s?.id) return;
            if (stateRef.current.sales.some((ls) => ls.id === s.id)) return;

            try {
              const { data: items } = await supabase
                .from("sale_items")
                .select("*")
                .eq("sale_id", s.id);

              const isCredit = s.payment_method === "credit";
              const totalAmt = Number(s.total) || 0;
              const rawPaid = Number.isFinite(Number(s.amount_paid))
                ? Number(s.amount_paid)
                : isCredit
                  ? 0
                  : totalAmt;
              const calculatedRem = isCredit
                ? Math.max(0, totalAmt - rawPaid)
                : 0;
              const rawRem =
                Number.isFinite(Number(s.remaining_amount)) &&
                Number(s.remaining_amount) > 0
                  ? Number(s.remaining_amount)
                  : calculatedRem;

              const sale: Sale = {
                id: s.id,
                items: (items || []).map((i: any) => ({
                  productId: i.product_id,
                  productName: i.product_name,
                  quantity: Number(i.quantity) || 1,
                  unitPrice: Number(i.unit_price) || 0,
                  total: Number(i.total) || 0,
                })),
                subtotal: Number(s.subtotal) || 0,
                tax: Number(s.tax) || 0,
                discount: Number(s.discount) || 0,
                total: totalAmt,
                paymentMethod: s.payment_method || "cash",
                amountGiven: s.amount_given
                  ? Number(s.amount_given)
                  : undefined,
                change: s.change ? Number(s.change) : undefined,
                customerName: s.customer_name || undefined,
                customerPhone: s.customer_phone || undefined,
                amountPaid: rawPaid,
                remainingAmount: rawRem,
                paymentStatus:
                  s.payment_status ||
                  (isCredit
                    ? rawRem === 0
                      ? "paid"
                      : rawPaid > 0
                        ? "partial"
                        : "unpaid"
                    : "paid"),
                dueDate: s.due_date || undefined,
                createdAt: s.created_at || new Date().toISOString(),
                userId: s.user_id,
                storeId: s.store_id,
              };

              dispatchBase({
                type: "REALTIME_SALE_INSERT",
                payload: sale,
              });
            } catch {}
          } else if (payload.eventType === "UPDATE") {
            const s = payload.new;
            if (!s?.id) return;
            if (await hasPendingOpFor("sale", s.id)) return;

            dispatchBase({
              type: "REALTIME_SALE_UPDATE",
              payload: {
                id: s.id,
                customerName: s.customer_name || undefined,
                customerPhone: s.customer_phone || undefined,
                amountPaid: Number.isFinite(Number(s.amount_paid))
                  ? Number(s.amount_paid)
                  : undefined,
                remainingAmount: Number.isFinite(Number(s.remaining_amount))
                  ? Number(s.remaining_amount)
                  : undefined,
                paymentStatus: s.payment_status || undefined,
                dueDate: s.due_date || undefined,
              },
            });
          }
        }
      );

    if (isAdmin) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_costs",
          filter: `store_id=eq.${sid}`,
        },
        (payload: any) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const c = payload.new;
            if (c?.product_id) {
              dispatchBase({
                type: "REALTIME_PRODUCT_COST_UPDATE",
                payload: {
                  productId: c.product_id,
                  cost: Number(c.cost) || 0,
                },
              });
            }
          }
        }
      );
    }

    channel.subscribe((status) => {
      setIsRealtimeActive(status === "SUBSCRIBED");
    });

    return () => {
      void supabase.removeChannel(channel);
      setIsRealtimeActive(false);
    };
  }, [activeStore?.id, user?.id, isAdmin]);

  // ── Enregistrement Write-Ahead Outbox + Réactivité UI Immédiate ──────────
  const dispatch = useCallback(
    async (action: Action) => {
      // Actions purement locales (panier / chargement / temps réel)
      if (
        action.type === "ADD_TO_CART" ||
        action.type === "REMOVE_FROM_CART" ||
        action.type === "UPDATE_CART_QTY" ||
        action.type === "UPDATE_CART_UNIT" ||
        action.type === "CLEAR_CART" ||
        action.type === "LOAD_STATE" ||
        action.type === "SET_PRICE_HISTORY" ||
        action.type === "REALTIME_PRODUCT_UPDATE" ||
        action.type === "REALTIME_PRODUCT_INSERT" ||
        action.type === "REALTIME_PRODUCT_DELETE" ||
        action.type === "REALTIME_PRODUCT_COST_UPDATE" ||
        action.type === "REALTIME_SALE_INSERT" ||
        action.type === "REALTIME_SALE_UPDATE"
      ) {
        dispatchBase(action);
        return;
      }

      const uid = userRef.current?.id;
      const sid = activeStoreRef.current?.id;

      // Sans boutique active, uniquement UI locale
      if (!uid || !sid) {
        dispatchBase(action);
        return;
      }

      // Capturer l'état pré-mutation pour l'historique des prix et les jetons OCC
      const currentState = stateRef.current;

      try {
        switch (action.type) {
          case "COMPLETE_SALE": {
            const activeSessionId = currentState.activeCashSession?.id || null;
            const salePayload: Sale = {
              ...action.payload,
              userId: action.payload.userId || uid,
              storeId: action.payload.storeId || sid,
              sessionId: action.payload.sessionId ?? activeSessionId,
            };

            // 1. UI instantanée (< 10 ms)
            dispatchBase({ type: "COMPLETE_SALE", payload: salePayload });

            // 2. Write-Ahead dans IndexedDB Outbox avant tout appel réseau
            await enqueueOutboxOperation({
              id: `sale:${salePayload.id}`,
              idempotencyKey: salePayload.id,
              userId: uid,
              storeId: sid,
              opType: "COMPLETE_SALE",
              entityType: "sale",
              entityId: salePayload.id,
              payload: salePayload,
              createdAt: salePayload.createdAt || new Date().toISOString(),
            });
            break;
          }

          case "CONVERT_QUOTE_TO_SALE": {
            const { quoteId, sale } = action.payload;
            const activeSessionId = currentState.activeCashSession?.id || null;
            const enrichedSale: Sale = {
              ...sale,
              userId: sale.userId || uid,
              storeId: sale.storeId || sid,
              sessionId: sale.sessionId ?? activeSessionId,
            };
            const existingQuote = (currentState.quotes || []).find(
              (q) => q.id === quoteId
            );

            dispatchBase({
              type: "CONVERT_QUOTE_TO_SALE",
              payload: { quoteId, sale: enrichedSale },
            });

            await enqueueOutboxOperation({
              id: `quote_convert:${quoteId}`,
              idempotencyKey: `quote_convert:${quoteId}:${enrichedSale.id}`,
              userId: uid,
              storeId: sid,
              opType: "CONVERT_QUOTE_TO_SALE",
              entityType: "quote",
              entityId: quoteId,
              payload: { quoteId, sale: enrichedSale },
              expectedUpdatedAt: existingQuote?.updatedAt || null,
            });
            break;
          }

          case "ADD_PRODUCT": {
            const p: Product = {
              ...action.payload,
              storeId: action.payload.storeId || sid,
              userId: action.payload.userId || uid,
            };
            dispatchBase({ type: "ADD_PRODUCT", payload: p });
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_PRODUCT",
              entityType: "product",
              entityId: p.id,
              payload: p,
              createdAt: p.createdAt || new Date().toISOString(),
            });
            break;
          }

          case "UPDATE_PRODUCT": {
            const p = action.payload;
            const oldProd = currentState.products.find(
              (item) => item.id === p.id
            );
            const expectedUpdatedAt = oldProd?.updatedAt || null;

            dispatchBase({ type: "UPDATE_PRODUCT", payload: p });

            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "UPDATE_PRODUCT",
              entityType: "product",
              entityId: p.id,
              payload: p,
              expectedUpdatedAt,
            });

            // Générer et empiler les changements d'historique de prix en Outbox
            if (oldProd) {
              const nowIso = new Date().toISOString();
              const authorName =
                userRef.current?.user_metadata?.full_name ||
                userRef.current?.email ||
                "Admin";
              const entries: PriceHistoryEntry[] = [];

              if (Number(p.price) !== Number(oldProd.price)) {
                entries.push({
                  id: generateClientUUID(),
                  storeId: sid,
                  productId: p.id,
                  priceType: "selling",
                  oldPrice: Number(oldProd.price),
                  newPrice: Number(p.price),
                  changeReason: "Ajustement du prix de vente",
                  userId: uid,
                  userName: authorName,
                  createdAt: nowIso,
                });
              }

              if (
                p.cost !== undefined &&
                oldProd.cost !== undefined &&
                Number(p.cost) !== Number(oldProd.cost)
              ) {
                entries.push({
                  id: generateClientUUID(),
                  storeId: sid,
                  productId: p.id,
                  priceType: "cost",
                  oldPrice: Number(oldProd.cost),
                  newPrice: Number(p.cost),
                  changeReason: "Ajustement du coût d'achat",
                  userId: uid,
                  userName: authorName,
                  createdAt: nowIso,
                });
              }

              if (Array.isArray(p.units) && Array.isArray(oldProd.units)) {
                for (const u of p.units) {
                  const oldU = oldProd.units.find(
                    (ou) => ou.name === u.name || ou.id === u.id
                  );
                  if (
                    oldU &&
                    Number(u.price || 0) > 0 &&
                    Number(oldU.price || 0) > 0 &&
                    Number(u.price) !== Number(oldU.price)
                  ) {
                    entries.push({
                      id: generateClientUUID(),
                      storeId: sid,
                      productId: p.id,
                      priceType: "unit_selling",
                      unitName: u.name,
                      oldPrice: Number(oldU.price),
                      newPrice: Number(u.price),
                      changeReason: `Ajustement prix unité [${u.name}]`,
                      userId: uid,
                      userName: authorName,
                      createdAt: nowIso,
                    });
                  }
                }
              }

              for (const entry of entries) {
                dispatchBase({
                  type: "ADD_PRICE_HISTORY_ENTRY",
                  payload: entry,
                });
                await enqueueOutboxOperation({
                  userId: uid,
                  storeId: sid,
                  opType: "ADD_PRICE_HISTORY_ENTRY",
                  entityType: "price_history",
                  entityId: entry.id,
                  payload: entry,
                  createdAt: entry.createdAt,
                });
              }
            }
            break;
          }

          case "DELETE_PRODUCT": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "DELETE_PRODUCT",
              entityType: "product",
              entityId: action.payload,
              payload: { id: action.payload },
            });
            break;
          }

          case "BATCH_ADD_PRODUCTS": {
            dispatchBase(action);
            if (action.payload.length > 0) {
              await enqueueOutboxOperation({
                userId: uid,
                storeId: sid,
                opType: "BATCH_ADD_PRODUCTS",
                entityType: "product",
                entityId: `batch_${generateClientUUID()}`,
                payload: action.payload,
              });
            }
            break;
          }

          case "ADD_CUSTOMER": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_CUSTOMER",
              entityType: "customer",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "ADD_CATEGORY": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_CATEGORY",
              entityType: "category",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "DELETE_CATEGORY": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "DELETE_CATEGORY",
              entityType: "category",
              entityId: action.payload,
              payload: { id: action.payload },
            });
            break;
          }

          case "ADD_BATCH": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_BATCH",
              entityType: "product_batch",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "DELETE_BATCH": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "DELETE_BATCH",
              entityType: "product_batch",
              entityId: action.payload,
              payload: { id: action.payload },
            });
            break;
          }

          case "ADD_PRICE_HISTORY_ENTRY": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_PRICE_HISTORY_ENTRY",
              entityType: "price_history",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "ADD_EXPENSE": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_EXPENSE",
              entityType: "expense",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "UPDATE_EXPENSE": {
            const oldExp = currentState.expenses.find(
              (e) => e.id === action.payload.id
            );
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "UPDATE_EXPENSE",
              entityType: "expense",
              entityId: action.payload.id,
              payload: action.payload,
              expectedUpdatedAt: oldExp?.updatedAt || null,
            });
            break;
          }

          case "DELETE_EXPENSE": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "DELETE_EXPENSE",
              entityType: "expense",
              entityId: action.payload,
              payload: { id: action.payload },
            });
            break;
          }

          case "ADD_ORDER": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_ORDER",
              entityType: "order",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "UPDATE_ORDER_STATUS": {
            const targetOrder = currentState.orders.find(
              (o) => o.id === action.payload.orderId
            );
            if (!targetOrder || targetOrder.status === "received") return;
            dispatchBase(action);
            await enqueueOutboxOperation({
              id: `order_receive:${action.payload.orderId}`,
              idempotencyKey: `order_receive:${action.payload.orderId}`,
              userId: uid,
              storeId: sid,
              opType: "UPDATE_ORDER_STATUS",
              entityType: "order",
              entityId: action.payload.orderId,
              payload: action.payload,
            });
            break;
          }

          case "DELETE_ORDER": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "DELETE_ORDER",
              entityType: "order",
              entityId: action.payload,
              payload: { id: action.payload },
            });
            break;
          }

          case "ADD_QUOTE": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "ADD_QUOTE",
              entityType: "quote",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "UPDATE_QUOTE": {
            const oldQuote = (currentState.quotes || []).find(
              (q) => q.id === action.payload.id
            );
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "UPDATE_QUOTE",
              entityType: "quote",
              entityId: action.payload.id,
              payload: action.payload,
              expectedUpdatedAt: oldQuote?.updatedAt || null,
            });
            break;
          }

          case "DELETE_QUOTE": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "DELETE_QUOTE",
              entityType: "quote",
              entityId: action.payload,
              payload: { id: action.payload },
            });
            break;
          }

          case "ADD_INVENTORY_SESSION": {
            dispatchBase(action);
            await enqueueOutboxOperation({
              id: `inv:${action.payload.id}`,
              idempotencyKey: action.payload.id,
              userId: uid,
              storeId: sid,
              opType: "ADD_INVENTORY_SESSION",
              entityType: "inventory_session",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "UPDATE_SETTINGS": {
            const expectedUpdatedAt = currentState.settings?.updatedAt || null;
            dispatchBase(action);

            if (action.payload.name && activeStoreRef.current) {
              setActiveStore({
                ...activeStoreRef.current,
                name: action.payload.name,
              });
            }

            await enqueueOutboxOperation({
              userId: uid,
              storeId: sid,
              opType: "UPDATE_SETTINGS",
              entityType: "settings",
              entityId: sid,
              payload: action.payload,
              expectedUpdatedAt,
            });
            break;
          }

          case "OPEN_CASH_SESSION":
          case "CLOSE_CASH_SESSION": {
            const isClose = action.type === "CLOSE_CASH_SESSION";
            dispatchBase(action);
            await enqueueOutboxOperation({
              id: `${isClose ? "cash_close" : "cash_open"}:${action.payload.id}`,
              idempotencyKey: `${isClose ? "cash_close" : "cash_open"}:${action.payload.id}`,
              userId: uid,
              storeId: sid,
              opType: action.type,
              entityType: "cash_session",
              entityId: action.payload.id,
              payload: action.payload,
            });
            break;
          }

          case "RECORD_DEBT_PAYMENT":
            dispatchBase(action);
            break;
        }

        await refreshOutbox();

        if (
          networkHealthRef.current.isReachable &&
          !sessionExpiredRef.current
        ) {
          void runSyncCycle({ forceAll: false, reason: "mutation" });
        }
      } catch (err) {
        console.error("[StoreContext] Erreur traitement dispatch outbox:", err);
      }
    },
    [refreshOutbox, runSyncCycle, setActiveStore]
  );

  // ── Actions Métier Spécialisées (Dettes, Caisse, Sync, Conflits, Backup) ─

  const recordDebtPayment = async (
    saleId: string,
    amount: number,
    method: "cash" | "mobile_money" | "card" = "cash",
    note?: string,
    cashierName?: string
  ): Promise<DebtPayment | null> => {
    if (amount <= 0) return null;
    const targetSale = stateRef.current.sales.find((s) => s.id === saleId);
    if (!targetSale) return null;

    const currentPaid = targetSale.amountPaid || 0;
    const currentRemaining = targetSale.remainingAmount ?? targetSale.total;
    const paymentAmount = Math.min(amount, currentRemaining);
    if (paymentAmount <= 0) return null;

    const newPaid = currentPaid + paymentAmount;
    const newRemaining = Math.max(0, currentRemaining - paymentAmount);
    const newStatus =
      newRemaining === 0 ? ("paid" as const) : ("partial" as const);
    const now = new Date().toISOString();

    const resolvedCashierName =
      cashierName ||
      userRef.current?.user_metadata?.full_name ||
      stateRef.current.settings?.managerName ||
      (effectiveRoleRef.current === "admin" ? "Gérant" : "Caissier");

    const paymentId = generateClientUUID();
    const paymentRecord: DebtPayment = {
      id: paymentId,
      saleId,
      amount: paymentAmount,
      paymentMethod: method,
      paidAt: now,
      note: note || undefined,
      cashierName: resolvedCashierName,
    };

    dispatchBase({
      type: "RECORD_DEBT_PAYMENT",
      payload: {
        saleId,
        paymentAmount,
        newPaid,
        newRemaining,
        newStatus,
        method,
        payment: paymentRecord,
      },
    });

    const uid = userRef.current?.id;
    const sid = activeStoreRef.current?.id;
    if (uid && sid) {
      await enqueueOutboxOperation({
        id: `debt:${paymentId}`,
        idempotencyKey: paymentId,
        userId: uid,
        storeId: sid,
        opType: "RECORD_DEBT_PAYMENT",
        entityType: "debt_payment",
        entityId: paymentId,
        payload: {
          id: paymentId,
          storeId: sid,
          saleId,
          paymentAmount,
          newPaid,
          newRemaining,
          newStatus,
          method,
          note: note || undefined,
          cashierName: resolvedCashierName,
          createdAt: now,
          sessionId: stateRef.current.activeCashSession?.id || null,
        },
        createdAt: now,
      });

      await refreshOutbox();
      if (
        networkHealthRef.current.isReachable &&
        !sessionExpiredRef.current
      ) {
        void runSyncCycle({ forceAll: false, reason: "debt_payment" });
      }
    }

    return paymentRecord;
  };

  const createDirectDebt = async (data: {
    customerName: string;
    customerPhone?: string;
    description: string;
    totalAmount: number;
    initialDeposit?: number;
    depositPaymentMethod?: "cash" | "mobile_money" | "card";
    dueDate?: string;
    notes?: string;
  }): Promise<Sale> => {
    const uid = userRef.current?.id;
    const sid = activeStoreRef.current?.id;

    const deposit = Math.min(
      Math.max(0, data.initialDeposit || 0),
      data.totalAmount
    );
    const remaining = Math.max(0, data.totalAmount - deposit);
    const status = remaining === 0 ? "paid" : deposit > 0 ? "partial" : "unpaid";
    const saleId = generateClientUUID();
    const now = new Date().toISOString();

    const initialPayment: DebtPayment[] =
      deposit > 0
        ? [
            {
              id: `init-${saleId}`,
              saleId,
              amount: deposit,
              paymentMethod: data.depositPaymentMethod || "cash",
              paidAt: now,
              note: "Acompte initial versé à la création",
              cashierName:
                userRef.current?.user_metadata?.full_name ||
                userRef.current?.email?.split("@")[0] ||
                "Caissier",
            },
          ]
        : [];

    const sale: Sale = {
      id: saleId,
      items: [
        {
          productId: "custom-credit",
          productName: data.description.trim() || "Créance / Vente à crédit",
          quantity: 1,
          unitPrice: data.totalAmount,
          total: data.totalAmount,
        },
      ],
      subtotal: data.totalAmount,
      tax: 0,
      discount: 0,
      total: data.totalAmount,
      paymentMethod: "credit",
      amountPaid: deposit,
      remainingAmount: remaining,
      paymentStatus: status,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone?.trim() || undefined,
      dueDate: data.dueDate || undefined,
      notes: data.notes?.trim() || undefined,
      createdAt: now,
      userId: uid,
      storeId: sid,
      sessionId: stateRef.current.activeCashSession?.id || null,
      payments: initialPayment,
    };

    // Enregistrer le nouveau client en outbox avant la vente si besoin
    if (data.customerName.trim()) {
      const existing = (stateRef.current.customers || []).find(
        (c) => c.name.toLowerCase() === data.customerName.trim().toLowerCase()
      );
      if (!existing) {
        const newCust: Customer = {
          id: generateClientUUID(),
          name: data.customerName.trim(),
          phone: data.customerPhone?.trim() || "",
          totalPurchases: data.totalAmount,
          lastVisit: now,
        };
        dispatchBase({ type: "ADD_CUSTOMER", payload: newCust });
        if (uid && sid) {
          await enqueueOutboxOperation({
            userId: uid,
            storeId: sid,
            opType: "ADD_CUSTOMER",
            entityType: "customer",
            entityId: newCust.id,
            payload: newCust,
            createdAt: now,
          });
        }
      }
    }

    dispatchBase({ type: "COMPLETE_SALE", payload: sale });

    if (uid && sid) {
      await enqueueOutboxOperation({
        id: `sale:${sale.id}`,
        idempotencyKey: sale.id,
        userId: uid,
        storeId: sid,
        opType: "COMPLETE_SALE",
        entityType: "sale",
        entityId: sale.id,
        payload: sale,
        createdAt: now,
      });

      await refreshOutbox();
      if (
        networkHealthRef.current.isReachable &&
        !sessionExpiredRef.current
      ) {
        void runSyncCycle({ forceAll: false, reason: "create_debt" });
      }
    }

    return sale;
  };

  const openCashSession = async (
    openingAmount: number,
    cashierName?: string
  ): Promise<CashSession> => {
    const openedAt = new Date().toISOString();
    const uid = userRef.current?.id || "";
    const sid = activeStoreRef.current?.id || "";
    const sessionId = generateClientUUID();

    const session: CashSession = {
      id: sessionId,
      storeId: sid,
      userId: uid,
      cashierName:
        cashierName &&
        !cashierName.includes("@") &&
        cashierName !== userRef.current?.email?.split("@")[0]
          ? cashierName
          : userRef.current?.user_metadata?.full_name ||
            stateRef.current.settings?.managerName ||
            (effectiveRoleRef.current === "admin" ? "Gérant" : "Caissier"),
      openingAmount,
      expectedAmount: openingAmount,
      totalCashSales: 0,
      totalMobileMoneySales: 0,
      totalCardSales: 0,
      totalSalesCount: 0,
      totalSalesAmount: 0,
      openedAt,
      status: "open",
    };

    dispatchBase({ type: "OPEN_CASH_SESSION", payload: session });

    if (uid && sid) {
      await enqueueOutboxOperation({
        id: `cash_open:${session.id}`,
        idempotencyKey: `cash_open:${session.id}`,
        userId: uid,
        storeId: sid,
        opType: "OPEN_CASH_SESSION",
        entityType: "cash_session",
        entityId: session.id,
        payload: session,
        createdAt: openedAt,
      });

      await refreshOutbox();
      if (
        networkHealthRef.current.isReachable &&
        !sessionExpiredRef.current
      ) {
        void runSyncCycle({ forceAll: false, reason: "open_cash" });
      }
    }

    return session;
  };

  const closeCashSession = async (
    closingAmount: number,
    notes?: string
  ): Promise<CashSession | null> => {
    const cur = stateRef.current.activeCashSession;
    if (!cur) return null;

    const stats = getSessionStats(
      cur,
      stateRef.current.sales,
      stateRef.current.cashSessions
    );
    const expected = stats.expectedCashInDrawer;
    const diff = closingAmount - expected;
    const closedAt = new Date().toISOString();

    const closedSession: CashSession = {
      ...cur,
      closingAmount,
      expectedAmount: expected,
      difference: diff,
      totalCashSales: stats.cash,
      totalMobileMoneySales: stats.mm,
      totalCardSales: stats.card,
      totalSalesCount: stats.count,
      totalSalesAmount: stats.total,
      status: "closed",
      closedAt,
      notes: notes || undefined,
    };

    dispatchBase({ type: "CLOSE_CASH_SESSION", payload: closedSession });

    const uid = userRef.current?.id;
    const sid = activeStoreRef.current?.id;
    if (uid && sid) {
      await enqueueOutboxOperation({
        id: `cash_close:${closedSession.id}`,
        idempotencyKey: `cash_close:${closedSession.id}`,
        userId: uid,
        storeId: sid,
        opType: "CLOSE_CASH_SESSION",
        entityType: "cash_session",
        entityId: closedSession.id,
        payload: closedSession,
        createdAt: closedAt,
      });

      await refreshOutbox();
      if (
        networkHealthRef.current.isReachable &&
        !sessionExpiredRef.current
      ) {
        void runSyncCycle({ forceAll: false, reason: "close_cash" });
      }
    }

    return closedSession;
  };

  // ── Commandes manuelles Sync / Retry / Résolution Conflits / Backup ──────
  const triggerManualSync = useCallback(
    async (opts?: { forcePull?: boolean }): Promise<SyncRunResult> => {
      return runSyncCycle({
        forceAll: true,
        forcePull: opts?.forcePull ?? true,
        reason: "manual",
      });
    },
    [runSyncCycle]
  );

  const syncOfflineSales = useCallback(async (): Promise<{
    success: number;
    failed: number;
  }> => {
    const res = await runSyncCycle({
      forceAll: true,
      forcePull: false,
      reason: "manual",
    });
    return {
      success: res.succeeded,
      failed: res.failed + res.conflicts,
    };
  }, [runSyncCycle]);

  /**
   * Purge sécurisée : supprime uniquement les entrées `done` ou déjà traitées,
   * sans JAMAIS effacer des ventes/paiements encore `pending`, `conflict` ou `auth_paused`.
   */
  const clearOfflineSalesQueue = useCallback(async (): Promise<void> => {
    const uid = userRef.current?.id;
    const sid = activeStoreRef.current?.id;
    if (!uid || !sid) return;
    await clearOutboxForScope(makeScopeKey(uid, sid), {
      mode: "scope",
      includeUnsynced: false,
      statuses: ["done"],
    });
    await refreshOutbox();
  }, [refreshOutbox]);

  const retryOutboxOperation = useCallback(
    async (itemId: string): Promise<void> => {
      await retryOutboxItem(itemId);
      await refreshOutbox();
      if (
        networkHealthRef.current.isReachable &&
        !sessionExpiredRef.current
      ) {
        await runSyncCycle({ forceAll: true, reason: "retry_single" });
      }
    },
    [refreshOutbox, runSyncCycle]
  );

  const dismissOutboxOperation = useCallback(
    async (itemId: string): Promise<void> => {
      await removeOutboxItem(itemId);
      await refreshOutbox();
    },
    [refreshOutbox]
  );

  const retryFailedSale = useCallback(
    async (saleId: string): Promise<{ success: number; failed: number }> => {
      const candidates = outboxItems.filter(
        (it) => it.entityId === saleId || it.id === `sale:${saleId}`
      );
      for (const c of candidates) {
        await retryOutboxItem(c.id);
      }
      await refreshOutbox();
      const res = await runSyncCycle({ forceAll: true, reason: "retry_sale" });
      return {
        success: res.succeeded,
        failed: res.failed + res.conflicts,
      };
    },
    [outboxItems, refreshOutbox, runSyncCycle]
  );

  const resolveConflict = useCallback(
    async (
      itemId: string,
      decision: "keep_server" | "force_local" | "dismiss"
    ): Promise<{ success: boolean; error?: string }> => {
      const uid = userRef.current?.id;
      const sid = activeStoreRef.current?.id;
      if (!uid || !sid) {
        return { success: false, error: "Aucune boutique active." };
      }
      const res = await resolveOutboxConflict({
        itemId,
        decision,
        userId: uid,
        storeId: sid,
        role: effectiveRoleRef.current || "cashier",
      });
      if (res.success && decision === "keep_server") {
        // Recharger le dernier état serveur pour refléter immédiatement la décision
        await runSyncCycle({
          forceAll: false,
          forcePull: true,
          reason: "conflict_keep_server",
        });
      } else {
        await refreshOutbox();
      }
      return res;
    },
    [refreshOutbox, runSyncCycle]
  );

  const exportOfflineBackup = useCallback(async () => {
    const uid = userRef.current?.id;
    const sid = activeStoreRef.current?.id;
    if (!uid || !sid) return null;
    await persistSnapshotNow(stateRef.current);
    return exportStoreOfflineBackup(uid, sid);
  }, [persistSnapshotNow]);

  const importOfflineBackup = useCallback(
    async (rawJson: string): Promise<BackupImportResult> => {
      const uid = userRef.current?.id;
      const sid = activeStoreRef.current?.id;
      if (!uid || !sid) {
        return {
          success: false,
          importedOutboxCount: 0,
          skippedDuplicateCount: 0,
          restoredSnapshot: false,
          restoredCursorsCount: 0,
          error: "Aucune boutique active.",
        };
      }
      const res = await importStoreOfflineBackup(rawJson, uid, sid);
      if (res.success) {
        const snap = await getStoreSnapshot(uid, sid);
        if (snap?.state) {
          dispatchBase({
            type: "LOAD_STATE",
            payload: {
              ...snap.state,
              cart: stateRef.current.cart || [],
            },
          });
        }
        await refreshOutbox();
      }
      return res;
    },
    [refreshOutbox]
  );

  // ── Valeurs dérivées pour compatibilité complète UI ──────────────────────
  const pendingSyncCount =
    outboxCounts.pending +
    outboxCounts.syncing +
    outboxCounts.authPaused +
    outboxCounts.conflict;

  const conflictItems = useMemo(
    () => outboxItems.filter((it) => it.status === "conflict"),
    [outboxItems]
  );

  const failedOfflineSales: OfflineSaleItem[] = useMemo(() => {
    return outboxItems
      .filter(
        (it) =>
          (it.opType === "COMPLETE_SALE" ||
            it.opType === "CONVERT_QUOTE_TO_SALE") &&
          (it.status === "failed" || it.status === "conflict")
      )
      .map((it) => {
        const saleObj =
          it.opType === "CONVERT_QUOTE_TO_SALE"
            ? (it.payload as { sale: Sale })?.sale
            : (it.payload as Sale);
        return {
          id: saleObj?.id || it.entityId,
          storeId: it.storeId,
          sale: saleObj,
          createdAt: it.createdAt,
          retryCount: it.retryCount,
          lastError: it.lastError || it.conflictData?.message,
          status: "failed" as const,
          lastAttemptAt: it.lastAttemptAt,
        };
      })
      .filter((x) => Boolean(x.sale));
  }, [outboxItems]);

  const unpaidDebts = useMemo(() => {
    return (state.sales || []).filter((s) => {
      if (!s || s.paymentMethod !== "credit") return false;
      const total = Number.isFinite(Number(s.total)) ? Number(s.total) : 0;
      const paid = Number.isFinite(Number(s.amountPaid))
        ? Number(s.amountPaid)
        : 0;
      const calculatedRem = Math.max(0, total - paid);
      const rem =
        s.remainingAmount !== undefined &&
        s.remainingAmount !== null &&
        s.remainingAmount > 0
          ? Number(s.remainingAmount)
          : calculatedRem;
      const isPaid = (s.paymentStatus === "paid" && paid >= total) || rem <= 0;
      return !isPaid && rem > 0;
    });
  }, [state.sales]);

  const totalDebtsAmount = useMemo(() => {
    return (unpaidDebts || []).reduce((sum, s) => {
      if (!s) return sum;
      const total = Number.isFinite(Number(s.total)) ? Number(s.total) : 0;
      const paid = Number.isFinite(Number(s.amountPaid))
        ? Number(s.amountPaid)
        : 0;
      const calculatedRem = Math.max(0, total - paid);
      const rem =
        s.remainingAmount !== undefined &&
        s.remainingAmount !== null &&
        s.remainingAmount > 0
          ? Number(s.remainingAmount)
          : calculatedRem;
      return sum + rem;
    }, 0);
  }, [unpaidDebts]);

  const formatPrice = useCallback(
    (amount: number) => {
      const validAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
      return (
        new Intl.NumberFormat("fr-FR").format(validAmount) +
        " " +
        (state.settings?.currency || "FCFA")
      );
    },
    [state.settings?.currency]
  );

  const lowStockProducts = useMemo(
    () => (state.products || []).filter((p) => p && p.stock <= p.minStock),
    [state.products]
  );

  const uniqueSales = useMemo(() => {
    const map = new Map<string, Sale>();
    (state.sales || []).forEach((s) => {
      if (s && s.id && !map.has(s.id)) map.set(s.id, s);
    });
    return Array.from(map.values());
  }, [state.sales]);

  const totalRevenue = useMemo(
    () => uniqueSales.reduce((sum, s) => sum + (s?.total || 0), 0),
    [uniqueSales]
  );

  const today = new Date().toISOString().split("T")[0];
  const todaySales = useMemo(
    () =>
      uniqueSales.filter((s) => s?.createdAt && s.createdAt.startsWith(today)),
    [uniqueSales, today]
  );
  const todayRevenue = useMemo(
    () => todaySales.reduce((sum, s) => sum + (s?.total || 0), 0),
    [todaySales]
  );
  const totalOrders = uniqueSales.length;
  const todayOrders = todaySales.length;
  const averageBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const totalExpenses = useMemo(
    () =>
      state.expenses
        ? state.expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        : 0,
    [state.expenses]
  );

  const totalCOGS = useMemo(() => {
    let sum = 0;
    uniqueSales.forEach((sale) => {
      if (!sale) return;
      (sale.items || []).forEach((item) => {
        if (!item) return;
        const product = (state.products || []).find(
          (p) => p.id === item.productId
        );
        const effectiveUnitCost =
          item.cost !== undefined && item.cost !== null
            ? Number(item.cost)
            : Number(product?.cost) || 0;
        const refQty =
          item.quantityReference !== undefined &&
          item.quantityReference !== null &&
          Number(item.quantityReference) > 0
            ? Number(item.quantityReference)
            : Number(item.quantity) * (Number(item.unitMultiplier) || 1);
        sum += effectiveUnitCost * refQty;
      });
    });
    return sum;
  }, [uniqueSales, state.products]);

  const netProfit = totalRevenue - totalCOGS - totalExpenses;

  const creditSales = useMemo(
    () =>
      (state.sales || []).filter(
        (s) =>
          s &&
          (s.paymentMethod === "credit" ||
            (Number.isFinite(Number(s.remainingAmount)) &&
              Number(s.remainingAmount) > 0))
      ),
    [state.sales]
  );

  const totalCreditSales = useMemo(
    () =>
      creditSales.reduce(
        (sum, s) => sum + (Number.isFinite(Number(s?.total)) ? Number(s.total) : 0),
        0
      ),
    [creditSales]
  );

  const totalRecoveredAmount = useMemo(
    () =>
      creditSales.reduce((sum, s) => {
        if (!s) return sum;
        const total = Number.isFinite(Number(s.total)) ? Number(s.total) : 0;
        const paid = Number.isFinite(Number(s.amountPaid))
          ? Number(s.amountPaid)
          : s.paymentStatus === "paid"
            ? total
            : 0;
        return sum + paid;
      }, 0),
    [creditSales]
  );

  const totalCollectedRevenue = Math.max(0, totalRevenue - totalDebtsAmount);

  const recoveryRate =
    totalCreditSales > 0 &&
    Number.isFinite(totalCreditSales) &&
    Number.isFinite(totalRecoveredAmount)
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((totalRecoveredAmount / totalCreditSales) * 100)
          )
        )
      : 100;

  const overdueDebtsCount = useMemo(() => {
    const now = new Date();
    return (unpaidDebts || []).filter(
      (s) => s && s.dueDate && new Date(s.dueDate) < now
    ).length;
  }, [unpaidDebts]);

  const collectedNetProfit = totalCollectedRevenue - totalCOGS - totalExpenses;

  const closedCashSessions = useMemo(() => {
    return (state.cashSessions || [])
      .filter((cs) => cs && cs.status === "closed")
      .sort(
        (a, b) =>
          new Date(b.closedAt || b.openedAt).getTime() -
          new Date(a.closedAt || a.openedAt).getTime()
      );
  }, [state.cashSessions]);

  const totalCashDifference = useMemo(
    () =>
      closedCashSessions.reduce(
        (sum, cs) => sum + (Number(cs.difference) || 0),
        0
      ),
    [closedCashSessions]
  );

  const totalCashShortage = useMemo(
    () =>
      closedCashSessions
        .filter((cs) => (Number(cs.difference) || 0) < 0)
        .reduce(
          (sum, cs) => sum + Math.abs(Number(cs.difference) || 0),
          0
        ),
    [closedCashSessions]
  );

  const totalCashSurplus = useMemo(
    () =>
      closedCashSessions
        .filter((cs) => (Number(cs.difference) || 0) > 0)
        .reduce((sum, cs) => sum + (Number(cs.difference) || 0), 0),
    [closedCashSessions]
  );

  const discrepantSessionsCount = useMemo(
    () =>
      closedCashSessions.filter(
        (cs) => Math.abs(Number(cs.difference) || 0) > 0
      ).length,
    [closedCashSessions]
  );

  const todayClosedSessions = useMemo(
    () =>
      closedCashSessions.filter((cs) =>
        isSameCalendarDay(cs.closedAt || cs.openedAt)
      ),
    [closedCashSessions]
  );

  const todayCashDifference = useMemo(
    () =>
      todayClosedSessions.reduce(
        (sum, cs) => sum + (Number(cs.difference) || 0),
        0
      ),
    [todayClosedSessions]
  );

  const todayCashShortage = useMemo(
    () =>
      todayClosedSessions
        .filter((cs) => (Number(cs.difference) || 0) < 0)
        .reduce(
          (sum, cs) => sum + Math.abs(Number(cs.difference) || 0),
          0
        ),
    [todayClosedSessions]
  );

  const cashDiscrepancyRate = useMemo(() => {
    if (closedCashSessions.length === 0) return 100;
    const cleanSessions = closedCashSessions.filter(
      (cs) => Math.abs(Number(cs.difference) || 0) === 0
    ).length;
    return Math.round((cleanSessions / closedCashSessions.length) * 100);
  }, [closedCashSessions]);

  const lastClosedCashSession =
    closedCashSessions.length > 0 ? closedCashSessions[0] : null;

  const totalPhysicalCashAndBank = Math.max(
    0,
    totalCollectedRevenue - totalCashShortage
  );

  const categorySales = useMemo(() => {
    const map: Record<string, number> = {};
    (state.sales || []).forEach((sale) => {
      if (!sale) return;
      const discountRatio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
      (sale.items || []).forEach((item) => {
        if (!item) return;
        const product = (state.products || []).find(
          (p) => p.id === item.productId
        );
        if (product) {
          const netItemTotal = Math.round(item.total * discountRatio);
          map[product.category] = (map[product.category] || 0) + netItemTotal;
        }
      });
    });
    return map;
  }, [state.sales, state.products]);

  const categoryNames = useMemo(
    () => state.categories.map((c) => c.name),
    [state.categories]
  );

  const currentSessionSales = useMemo(() => {
    if (!state.activeCashSession) return [];
    return getSalesForSession(
      state.activeCashSession,
      state.sales || [],
      state.cashSessions || []
    );
  }, [state.activeCashSession, state.sales, state.cashSessions]);

  const currentSessionStats = useMemo(() => {
    return getSessionStats(
      state.activeCashSession,
      state.sales || [],
      state.cashSessions || []
    );
  }, [state.activeCashSession, state.sales, state.cashSessions]);

  return (
    <StoreContext.Provider
      value={{
        sales: state.sales,
        products: state.products,
        customers: state.customers,
        expenses: state.expenses,
        orders: state.orders,
        quotes: state.quotes || [],
        state,
        dispatch,
        formatPrice,
        lowStockProducts,
        totalRevenue,
        todayRevenue,
        totalOrders,
        todayOrders,
        averageBasket,
        categorySales,
        categoryNames,
        totalExpenses,
        netProfit,
        activeCashSession: state.activeCashSession,
        cashSessions: state.cashSessions,
        currentSessionSales,
        currentSessionStats,
        openCashSession,
        closeCashSession,
        isOnline,
        isInitialized,
        networkStatus: networkHealth.status,
        networkHealth,
        pendingSyncCount,
        isSyncing,
        lastSyncedAt,
        syncError,
        outboxCounts,
        outboxItems,
        conflictItems,
        syncLogs,
        storageDiagnostics,
        syncOfflineSales,
        clearOfflineSalesQueue,
        failedOfflineSales,
        retryFailedSale,
        refreshFailedOfflineSales,
        triggerManualSync,
        retryOutboxOperation,
        dismissOutboxOperation,
        resolveConflict,
        refreshOutbox,
        exportOfflineBackup,
        importOfflineBackup,
        isRealtimeActive,
        unpaidDebts,
        totalDebtsAmount,
        totalCreditSales,
        totalRecoveredAmount,
        totalCollectedRevenue,
        recoveryRate,
        overdueDebtsCount,
        collectedNetProfit,
        closedCashSessions,
        totalCashDifference,
        totalCashShortage,
        totalCashSurplus,
        todayCashDifference,
        todayCashShortage,
        cashDiscrepancyRate,
        totalPhysicalCashAndBank,
        discrepantSessionsCount,
        lastClosedCashSession,
        recordDebtPayment,
        createDirectDebt,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
}
