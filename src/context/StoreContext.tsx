"use client";
import { saveOfflineSale, getOfflineSales, removeOfflineSale, getOfflineSalesCount } from "@/lib/offlineQueue";

import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, ReactNode } from "react";
import { useAuth } from '@/context/AuthContext';
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────
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
}

export interface CartItem {
  product: Product;
  quantity: number;
}


export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  createdAt?: string;
}

export interface Order {
  id: string;
  supplierName: string;
  items: { productId: string; productName: string; quantity: number; costPrice: number; total: number }[];
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

export interface Sale {
  id: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[];
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
}

// ─── Actions ─────────────────────────────────────────────────
type Action =
  | { type: "ADD_PRODUCT"; payload: Product }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | { type: "ADD_TO_CART"; payload: Product }
  | { type: "REMOVE_FROM_CART"; payload: string }
  | { type: "UPDATE_CART_QTY"; payload: { productId: string; quantity: number } }
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
      } 
    }
  | { type: "ADD_CUSTOMER"; payload: Customer }
  | { type: "ADD_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "UPDATE_SETTINGS"; payload: Partial<StoreSettings> }
    | { type: "ADD_ORDER"; payload: Order }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "UPDATE_EXPENSE"; payload: Expense }
  | { type: "DELETE_EXPENSE"; payload: string }
  | { type: "UPDATE_ORDER_STATUS"; payload: { orderId: string; status: "received" } }
  | { type: "DELETE_ORDER"; payload: string }
  | { type: "ADD_INVENTORY_SESSION"; payload: InventorySession }
  | { type: "OPEN_CASH_SESSION"; payload: CashSession }
  | { type: "CLOSE_CASH_SESSION"; payload: CashSession }
  | { type: "REALTIME_PRODUCT_UPDATE"; payload: Product }
  | { type: "REALTIME_PRODUCT_INSERT"; payload: Product }
  | { type: "REALTIME_PRODUCT_DELETE"; payload: string }
  | { type: "REALTIME_SALE_INSERT"; payload: Sale }
  | { type: "LOAD_STATE"; payload: StoreState };

// ─── Demo seed data ──────────────────────────────────────────
const demoCategories: Category[] = [
  { id: "cat1", name: "Vêtements", icon: "👕", color: "#6343EA" },
  { id: "cat2", name: "Chaussures", icon: "👟", color: "#22C580" },
  { id: "cat3", name: "Accessoires", icon: "👜", color: "#F59E0B" },
  { id: "cat4", name: "Beauté", icon: "🧴", color: "#EC4899" },
];

const demoProducts: Product[] = [
  { id: "p1", name: "T-Shirt Premium", sku: "TSH-001", category: "Vêtements", price: 12500, cost: 6000, stock: 45, minStock: 10, image: "👕", createdAt: "2026-09-01" },
  { id: "p2", name: "Jean Slim Fit", sku: "JEA-002", category: "Vêtements", price: 18000, cost: 9500, stock: 28, minStock: 8, image: "👖", createdAt: "2026-09-01" },
  { id: "p3", name: "Sneakers Urban", sku: "SNK-003", category: "Chaussures", price: 35000, cost: 18000, stock: 15, minStock: 5, image: "👟", createdAt: "2026-09-02" },
  { id: "p4", name: "Sac à Main Cuir", sku: "SAC-004", category: "Accessoires", price: 25000, cost: 12000, stock: 20, minStock: 5, image: "👜", createdAt: "2026-09-03" },
  { id: "p5", name: "Montre Classique", sku: "MON-005", category: "Accessoires", price: 45000, cost: 22000, stock: 8, minStock: 3, image: "⌚", createdAt: "2026-09-04" },
  { id: "p6", name: "Casquette Sport", sku: "CAS-006", category: "Accessoires", price: 8000, cost: 3500, stock: 60, minStock: 15, image: "🧢", createdAt: "2026-09-05" },
  { id: "p7", name: "Robe Élégante", sku: "ROB-007", category: "Vêtements", price: 22000, cost: 11000, stock: 18, minStock: 5, image: "👗", createdAt: "2026-09-06" },
  { id: "p8", name: "Lunettes de Soleil", sku: "LUN-008", category: "Accessoires", price: 15000, cost: 6500, stock: 3, minStock: 5, image: "🕶️", createdAt: "2026-09-07" },
  { id: "p9", name: "Parfum Prestige", sku: "PAR-009", category: "Beauté", price: 38000, cost: 15000, stock: 12, minStock: 4, image: "🧴", createdAt: "2026-09-08" },
  { id: "p10", name: "Ceinture Cuir", sku: "CEI-010", category: "Accessoires", price: 9500, cost: 4000, stock: 2, minStock: 8, image: "🪢", createdAt: "2026-09-09" },
].sort((a, b) => a.name.localeCompare(b.name));

const demoSales: Sale[] = [
  { id: "s1", items: [{ productId: "p1", productName: "T-Shirt Premium", quantity: 2, unitPrice: 12500, total: 25000 }], subtotal: 25000, tax: 4500, discount: 0, total: 29500, paymentMethod: "cash", createdAt: "2026-09-18T09:30:00" },
  { id: "s2", items: [{ productId: "p3", productName: "Sneakers Urban", quantity: 1, unitPrice: 35000, total: 35000 }, { productId: "p6", productName: "Casquette Sport", quantity: 2, unitPrice: 8000, total: 16000 }], subtotal: 51000, tax: 9180, discount: 2000, total: 58180, paymentMethod: "mobile_money", createdAt: "2026-09-18T11:15:00" },
  { id: "s3", items: [{ productId: "p5", productName: "Montre Classique", quantity: 1, unitPrice: 45000, total: 45000 }], subtotal: 45000, tax: 8100, discount: 0, total: 53100, paymentMethod: "card", createdAt: "2026-09-18T14:00:00" },
  { id: "s4", items: [{ productId: "p7", productName: "Robe Élégante", quantity: 1, unitPrice: 22000, total: 22000 }, { productId: "p4", productName: "Sac à Main Cuir", quantity: 1, unitPrice: 25000, total: 25000 }], subtotal: 47000, tax: 8460, discount: 5000, total: 50460, paymentMethod: "cash", createdAt: "2026-09-19T08:45:00" },
  { id: "s5", items: [{ productId: "p9", productName: "Parfum Prestige", quantity: 2, unitPrice: 38000, total: 76000 }], subtotal: 76000, tax: 13680, discount: 3000, total: 86680, paymentMethod: "mobile_money", createdAt: "2026-09-19T10:20:00" },
];

const demoCustomers: Customer[] = [
  { id: "c1", name: "Awa Diallo", phone: "+221 77 123 4567", totalPurchases: 87500, lastVisit: "2026-09-19" },
  { id: "c2", name: "Moussa Ndiaye", phone: "+221 78 234 5678", totalPurchases: 58180, lastVisit: "2026-09-18" },
  { id: "c3", name: "Fatou Sow", phone: "+221 76 345 6789", totalPurchases: 53100, lastVisit: "2026-09-18" },
  { id: "c4", name: "Ibrahima Fall", phone: "+221 77 456 7890", totalPurchases: 50460, lastVisit: "2026-09-19" },
];

const initialState: StoreState = {
  products: demoProducts,
  sales: demoSales,
  orders: [],
  expenses: [],
  customers: demoCustomers,
  cart: [],
  categories: demoCategories,
  inventorySessions: [],
  cashSessions: [],
  activeCashSession: null,
  settings: { name: "BoutiquePro", currency: "FCFA", taxRate: 0, city: "Dakar", country: "Sénégal", email: "contact@boutiquepro.com", phone: "+221 77 000 00 00" },
};


// ─── Fonctions d'agrégation des ventes de caisse ──────────────
export function isSameCalendarDay(d1: string | Date, d2: string | Date = new Date()): boolean {
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
  allSessions: CashSession[] = []
): Sale[] {
  if (!session || !session.openedAt) return [];
  const sessionOpenedTime = new Date(session.openedAt).getTime();
  if (isNaN(sessionOpenedTime)) return [];
  const sessionClosedTime = session.closedAt ? new Date(session.closedAt).getTime() : Infinity;

  // Si la session est déjà clôturée officiellement
  if (session.status === "closed" && session.closedAt) {
    return (allSales || []).filter((s) => {
      if (!s || !s.createdAt) return false;
      const saleTime = new Date(s.createdAt).getTime();
      return !isNaN(saleTime) && saleTime >= sessionOpenedTime && saleTime <= sessionClosedTime;
    });
  }

  // Session en cours : rechercher la dernière clôture avant cette session
  const previousClosedSessions = (allSessions || []).filter((cs) =>
    cs &&
    cs.id !== session.id &&
    cs.status === "closed" &&
    cs.closedAt &&
    new Date(cs.closedAt).getTime() <= sessionOpenedTime
  );

  let cutoffTime = 0;
  if (previousClosedSessions.length > 0) {
    previousClosedSessions.sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());
    cutoffTime = new Date(previousClosedSessions[0].closedAt!).getTime();
  }

  return (allSales || []).filter((s) => {
    if (!s || !s.createdAt) return false;
    const saleTime = new Date(s.createdAt).getTime();
    if (isNaN(saleTime)) return false;

    // 1. Vente après l'ouverture du shift
    if (saleTime >= sessionOpenedTime) return true;

    // 2. OU vente de la journée avant l'ouverture du shift (sans précédent shift fermé la couvrant)
    const isToday = isSameCalendarDay(s.createdAt, session.openedAt);
    if (isToday && (cutoffTime === 0 || saleTime > cutoffTime)) {
      return true;
    }

    return false;
  });
}
// ─── Reducer ─────────────────────────────────────────────────
function storeReducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "ADD_PRODUCT":
      return { ...state, products: [...state.products, action.payload].sort((a, b) => a.name.localeCompare(b.name)) };
    case "UPDATE_PRODUCT":
      return { ...state, products: state.products.map((p) => (p.id === action.payload.id ? action.payload : p)).sort((a, b) => a.name.localeCompare(b.name)) };
    case "DELETE_PRODUCT":
      return { ...state, products: state.products.filter((p) => p.id !== action.payload) };
    case "ADD_TO_CART": {
      const existing = state.cart.find((c) => c.product.id === action.payload.id);
      if (existing) {
        return { ...state, cart: state.cart.map((c) => (c.product.id === action.payload.id ? { ...c, quantity: c.quantity + 1 } : c)) };
      }
      return { ...state, cart: [...state.cart, { product: action.payload, quantity: 1 }] };
    }
    case "REMOVE_FROM_CART":
      return { ...state, cart: state.cart.filter((c) => c.product.id !== action.payload) };
    case "UPDATE_CART_QTY":
      if (action.payload.quantity <= 0) {
        return { ...state, cart: state.cart.filter((c) => c.product.id !== action.payload.productId) };
      }
      return { ...state, cart: state.cart.map((c) => (c.product.id === action.payload.productId ? { ...c, quantity: action.payload.quantity } : c)) };
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "COMPLETE_SALE": {
      const updatedProducts = state.products.map((p) => {
        const soldItem = action.payload.items.find((i) => i.productId === p.id);
        return soldItem ? { ...p, stock: Math.max(0, p.stock - soldItem.quantity) } : p;
      });

      let updatedActiveSession = state.activeCashSession;
      let updatedCashSessions = state.cashSessions;

      if (updatedActiveSession) {
        const isCash = action.payload.paymentMethod === "cash";
        const isMM = action.payload.paymentMethod === "mobile_money";
        const isCard = action.payload.paymentMethod === "card";
        const isCredit = action.payload.paymentMethod === "credit";
        const downPayment = isCredit ? (action.payload.amountPaid || 0) : 0;
        const cashEntry = isCredit ? downPayment : (isCash ? action.payload.total : 0);
        const effectiveAmount = isCredit ? downPayment : action.payload.total;

        updatedActiveSession = {
          ...updatedActiveSession,
          totalCashSales: updatedActiveSession.totalCashSales + cashEntry,
          totalMobileMoneySales: updatedActiveSession.totalMobileMoneySales + (isMM ? action.payload.total : 0),
          totalCardSales: updatedActiveSession.totalCardSales + (isCard ? action.payload.total : 0),
          totalSalesCount: updatedActiveSession.totalSalesCount + 1,
          totalSalesAmount: updatedActiveSession.totalSalesAmount + effectiveAmount,
          expectedAmount: updatedActiveSession.openingAmount + updatedActiveSession.totalCashSales + cashEntry
        };

        updatedCashSessions = updatedCashSessions.map((cs) =>
          cs.id === updatedActiveSession?.id ? updatedActiveSession : cs
        );
      }

      return { 
        ...state, 
        sales: [action.payload, ...state.sales], 
        products: updatedProducts, 
        cart: [],
        activeCashSession: updatedActiveSession,
        cashSessions: updatedCashSessions
      };
    }
    case "RECORD_DEBT_PAYMENT": {
      const { saleId, paymentAmount, newPaid, newRemaining, newStatus, method, payment } = action.payload;
      const updatedSales = state.sales.map((s) => {
        if (s.id !== saleId) return s;
        const prevPayments = s.payments || [];
        return {
          ...s,
          amountPaid: newPaid,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
          payments: payment ? [payment, ...prevPayments] : prevPayments,
        };
      });

      let updatedActiveSession = state.activeCashSession;
      let updatedCashSessions = state.cashSessions;

      if (updatedActiveSession && method === "cash") {
        updatedActiveSession = {
          ...updatedActiveSession,
          totalCashSales: updatedActiveSession.totalCashSales + paymentAmount,
          totalSalesAmount: updatedActiveSession.totalSalesAmount + paymentAmount,
          expectedAmount: updatedActiveSession.expectedAmount + paymentAmount,
        };
        updatedCashSessions = updatedCashSessions.map((cs) =>
          cs.id === updatedActiveSession?.id ? updatedActiveSession : cs
        );
      }

      return {
        ...state,
        sales: updatedSales,
        activeCashSession: updatedActiveSession,
        cashSessions: updatedCashSessions,
      };
    }
        case "ADD_EXPENSE":
      return { ...state, expenses: [action.payload, ...state.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
    case "UPDATE_EXPENSE":
      return { ...state, expenses: state.expenses.map((e) => (e.id === action.payload.id ? action.payload : e)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
    case "DELETE_EXPENSE":
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.payload) };
    case "ADD_ORDER":
      return { ...state, orders: [action.payload, ...state.orders] };
    case "DELETE_ORDER":
      return { ...state, orders: state.orders.filter((o) => o.id !== action.payload) };
    case "UPDATE_ORDER_STATUS": {
      const order = state.orders.find(o => o.id === action.payload.orderId);
      if (!order || order.status === "received") return state;
      
      // Update order status
      const updatedOrders = state.orders.map(o => o.id === action.payload.orderId ? { ...o, status: "received" as const } : o);
      
      // Increase product stock
      const updatedProducts = state.products.map(p => {
        const orderedItem = order.items.find(i => i.productId === p.id);
        return orderedItem ? { ...p, stock: p.stock + orderedItem.quantity } : p;
      });

      return { ...state, orders: updatedOrders, products: updatedProducts };
    }
    case "ADD_CUSTOMER":
      return { ...state, customers: [...state.customers, action.payload] };
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.payload] };
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter((c) => c.id !== action.payload) };
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case "ADD_INVENTORY_SESSION": {
      const newSessions = [action.payload, ...state.inventorySessions];
      const updatedProducts = state.products.map(p => {
        const item = action.payload.items.find(i => i.productId === p.id);
        if (item) {
          return { ...p, stock: item.actualStock };
        }
        return p;
      });
      return { ...state, inventorySessions: newSessions, products: updatedProducts };
    }
    case "OPEN_CASH_SESSION": {
      return {
        ...state,
        activeCashSession: action.payload,
        cashSessions: [action.payload, ...state.cashSessions.filter((cs) => cs.id !== action.payload.id)]
      };
    }
    case "CLOSE_CASH_SESSION": {
      return {
        ...state,
        activeCashSession: null,
        cashSessions: state.cashSessions.map((cs) => cs.id === action.payload.id ? action.payload : cs)
      };
    }
    case "REALTIME_PRODUCT_UPDATE": {
      const updated = action.payload;
      return {
        ...state,
        products: state.products.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
      };
    }
    case "REALTIME_PRODUCT_INSERT": {
      const newProd = action.payload;
      if (state.products.some((p) => p.id === newProd.id)) {
        return {
          ...state,
          products: state.products.map((p) => (p.id === newProd.id ? { ...p, ...newProd } : p)),
        };
      }
      return {
        ...state,
        products: [...state.products, newProd].sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
    case "REALTIME_PRODUCT_DELETE": {
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.payload),
      };
    }
    case "REALTIME_SALE_INSERT": {
      const sale = action.payload;
      if (state.sales.some((s) => s.id === sale.id)) return state;
      return {
        ...state,
        sales: [sale, ...state.sales],
      };
    }
    case "LOAD_STATE":
      return { 
        ...action.payload, 
        products: [...(action.payload.products || [])].sort((a, b) => a.name.localeCompare(b.name)),
        categories: action.payload.categories || demoCategories,
        orders: action.payload.orders || [],
        cart: action.payload.cart || [],
        inventorySessions: action.payload.inventorySessions || [],
        expenses: action.payload.expenses || [],
        cashSessions: action.payload.cashSessions || [],
        activeCashSession: action.payload.activeCashSession || null
      };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
interface StoreContextType {
  state: StoreState;
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  expenses: Expense[];
  orders: Order[];
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
  openCashSession: (openingAmount: number, cashierName?: string) => Promise<CashSession>;
  closeCashSession: (closingAmount: number, notes?: string) => Promise<CashSession | null>;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  syncOfflineSales: () => Promise<{ success: number; failed: number }>;
  isRealtimeActive: boolean;
  unpaidDebts: Sale[];
  totalDebtsAmount: number;
  totalCreditSales: number;
  totalRecoveredAmount: number;
  totalCollectedRevenue: number;
  recoveryRate: number;
  overdueDebtsCount: number;
  collectedNetProfit: number;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const { activeStore, user } = useAuth();
  const [state, dispatchBase] = useReducer(storeReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Synchronisation des ventes hors-ligne
  const unpaidDebts = useMemo(() => {
    return (state.sales || []).filter(
      (s) => s && s.paymentMethod === "credit" && (s.remainingAmount === undefined || s.remainingAmount > 0)
    );
  }, [state.sales]);

  const totalDebtsAmount = useMemo(() => {
    return (unpaidDebts || []).reduce((sum, s) => sum + (s ? (s.remainingAmount ?? s.total ?? 0) : 0), 0);
  }, [unpaidDebts]);

  const recordDebtPayment = async (
    saleId: string,
    amount: number,
    method: "cash" | "mobile_money" | "card" = "cash",
    note?: string,
    cashierName?: string
  ): Promise<DebtPayment | null> => {
    if (amount <= 0) return null;
    const targetSale = state.sales.find((s) => s.id === saleId);
    if (!targetSale) return null;

    const currentPaid = targetSale.amountPaid || 0;
    const currentRemaining = targetSale.remainingAmount ?? targetSale.total;
    const paymentAmount = Math.min(amount, currentRemaining);

    const newPaid = currentPaid + paymentAmount;
    const newRemaining = Math.max(0, currentRemaining - paymentAmount);
    const newStatus = newRemaining === 0 ? ("paid" as const) : ("partial" as const);
    const now = new Date().toISOString();

    const paymentRecord: DebtPayment = {
      id: `rec-${Date.now()}`,
      saleId,
      amount: paymentAmount,
      paymentMethod: method,
      paidAt: now,
      note: note || undefined,
      cashierName: cashierName || user?.email?.split("@")[0] || "Caissier"
    };

    dispatchBase({
      type: "RECORD_DEBT_PAYMENT",
      payload: { saleId, paymentAmount, newPaid, newRemaining, newStatus, method, payment: paymentRecord },
    });

    if (typeof window !== "undefined" && activeStore?.id) {
      try {
        const storeKey = `boutiquepro_debt_payments_${activeStore.id}`;
        const existingStored = JSON.parse(localStorage.getItem(storeKey) || "[]");
        localStorage.setItem(storeKey, JSON.stringify([paymentRecord, ...existingStored]));
      } catch (e) {
        console.warn("Erreur stockage paiement local:", e);
      }
    }

    if (typeof window !== "undefined" && navigator.onLine && activeStore?.id) {
      try {
        await supabase
          .from("sales")
          .update({
            amount_paid: newPaid,
            remaining_amount: newRemaining,
            payment_status: newStatus,
          })
          .eq("id", saleId)
          .eq("store_id", activeStore.id);
      } catch (err) {
        console.warn("Erreur mise à jour Supabase dette:", err);
      }

      if (method === "cash" && state.activeCashSession?.id) {
        try {
          const newCash = state.activeCashSession.totalCashSales + paymentAmount;
          const newTotal = state.activeCashSession.totalSalesAmount + paymentAmount;
          const newExpected = state.activeCashSession.openingAmount + newCash;
          await supabase
            .from("cash_sessions")
            .update({
              total_cash_sales: newCash,
              total_sales_amount: newTotal,
              expected_amount: newExpected,
            })
            .eq("id", state.activeCashSession.id);
        } catch (err) {
          console.warn("Erreur crédit session caisse dette:", err);
        }
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
    const deposit = Math.min(Math.max(0, data.initialDeposit || 0), data.totalAmount);
    const remaining = Math.max(0, data.totalAmount - deposit);
    const status = remaining === 0 ? "paid" : deposit > 0 ? "partial" : "unpaid";
    const saleId = `debt-${Date.now()}`;
    const now = new Date().toISOString();

    const initialPayment: DebtPayment[] = deposit > 0 ? [{
      id: `rec-${Date.now()}`,
      saleId,
      amount: deposit,
      paymentMethod: data.depositPaymentMethod || "cash",
      paidAt: now,
      note: "Acompte initial versé à la création",
      cashierName: user?.email?.split("@")[0] || "Caissier"
    }] : [];

    const sale: Sale = {
      id: saleId,
      items: [
        {
          productId: "custom-credit",
          productName: data.description.trim() || "Créance / Vente à crédit",
          quantity: 1,
          unitPrice: data.totalAmount,
          total: data.totalAmount
        }
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
      userId: user?.id,
      storeId: activeStore?.id,
      payments: initialPayment
    };

    dispatchBase({ type: "COMPLETE_SALE", payload: sale });

    if (initialPayment.length > 0 && typeof window !== "undefined" && activeStore?.id) {
      try {
        const storeKey = `boutiquepro_debt_payments_${activeStore.id}`;
        const existingStored = JSON.parse(localStorage.getItem(storeKey) || "[]");
        localStorage.setItem(storeKey, JSON.stringify([initialPayment[0], ...existingStored]));
      } catch (e) {
        console.warn("Erreur stockage acompte initial:", e);
      }
    }

    if (data.customerName.trim()) {
      const existing = (state.customers || []).find(
        (c) => c.name.toLowerCase() === data.customerName.trim().toLowerCase()
      );
      if (!existing) {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: data.customerName.trim(),
          phone: data.customerPhone?.trim() || "",
          totalPurchases: data.totalAmount,
          lastVisit: now
        };
        dispatchBase({ type: "ADD_CUSTOMER", payload: newCust });
        if (typeof window !== "undefined" && navigator.onLine && activeStore?.id) {
          supabase.from("customers").insert([{
            id: newCust.id,
            store_id: activeStore.id,
            name: newCust.name,
            phone: newCust.phone,
            total_purchases: newCust.totalPurchases,
            last_visit: newCust.lastVisit
          }]).then();
        }
      }
    }

    if (typeof window !== "undefined" && !navigator.onLine && activeStore?.id) {
      await saveOfflineSale(activeStore.id, sale);
      setPendingSyncCount((prev) => prev + 1);
    } else if (activeStore?.id) {
      try {
        const { error: saleError } = await supabase.rpc("create_sale", {
          p_store_id: activeStore.id,
          p_sale_id: sale.id,
          p_subtotal: sale.subtotal,
          p_tax: sale.tax,
          p_discount: sale.discount,
          p_total: sale.total,
          p_payment_method: sale.paymentMethod,
          p_customer_name: sale.customerName || null,
          p_created_at: sale.createdAt,
          p_items: sale.items
        });

        if (saleError) {
          await supabase.from("sales").insert([{
            id: sale.id,
            store_id: activeStore.id,
            subtotal: sale.subtotal,
            tax: 0,
            discount: 0,
            total: sale.total,
            payment_method: "credit",
            customer_name: sale.customerName,
            customer_phone: sale.customerPhone,
            amount_paid: sale.amountPaid,
            remaining_amount: sale.remainingAmount,
            payment_status: sale.paymentStatus,
            due_date: sale.dueDate,
            created_at: sale.createdAt
          }]);
        } else {
          await supabase.from("sales").update({
            customer_phone: sale.customerPhone,
            amount_paid: sale.amountPaid,
            remaining_amount: sale.remainingAmount,
            payment_status: sale.paymentStatus,
            due_date: sale.dueDate
          }).eq("id", sale.id).eq("store_id", activeStore.id);
        }
      } catch (err) {
        console.warn("Basculement offline pour créance:", err);
        await saveOfflineSale(activeStore.id, sale);
        setPendingSyncCount((prev) => prev + 1);
      }
    }

    return sale;
  };

  const syncOfflineSales = async (): Promise<{ success: number; failed: number }> => {
    if (!activeStore?.id || !navigator.onLine || isSyncing) return { success: 0, failed: 0 };
    setIsSyncing(true);
    let success = 0;
    let failed = 0;

    try {
      const pendingItems = await getOfflineSales(activeStore.id);
      for (const item of pendingItems) {
        const s = item.sale;
        try {
          const { error: saleError } = await supabase.rpc("create_sale", {
            p_store_id: activeStore.id,
            p_sale_id: s.id,
            p_subtotal: s.subtotal,
            p_tax: s.tax,
            p_discount: s.discount,
            p_total: s.total,
            p_payment_method: s.paymentMethod,
            p_customer_name: s.customerName || null,
            p_created_at: s.createdAt,
            p_items: s.items,
          });

          // Succès ou vente déjà présente (idempotent code 23505)
          if (!saleError || saleError.code === "23505") {
            await removeOfflineSale(s.id);
            success++;
          } else {
            console.error("Erreur sync vente:", saleError);
            failed++;
          }
        } catch (err) {
          console.error("Exception sync vente:", err);
          failed++;
        }
      }
    } finally {
      const remaining = await getOfflineSalesCount(activeStore.id);
      setPendingSyncCount(remaining);
      setIsSyncing(false);
    }

    return { success, failed };
  };

  // Écoute de l'état réseau (en ligne / hors-ligne) et synchronisation automatique
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const refreshPendingCount = async () => {
      if (activeStore?.id) {
        const count = await getOfflineSalesCount(activeStore.id);
        setPendingSyncCount(count);
      }
    };
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineSales();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      refreshPendingCount();
      if (navigator.onLine && pendingSyncCount > 0 && !isSyncing) {
        syncOfflineSales();
      }
    }, 25000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [activeStore?.id, pendingSyncCount, isSyncing]);

  // ─── Synchronisation Temps Réel (Supabase Realtime) ───────────
  // Écoute strictement isolée sur filter store_id = activeStore.id
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  useEffect(() => {
    if (!activeStore?.id) return;

    const channelName = `store_${activeStore.id}_realtime`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `store_id=eq.${activeStore.id}`,
        },
        (payload: any) => {
          if (payload.eventType === "UPDATE") {
            const p = payload.new;
            dispatchBase({
              type: "REALTIME_PRODUCT_UPDATE",
              payload: {
                id: p.id,
                name: p.name,
                sku: p.sku,
                category: p.category,
                price: Number(p.price) || 0,
                cost: Number(p.cost) || 0,
                stock: Number(p.stock) || 0,
                minStock: Number(p.min_stock || 0),
                image: p.image || "📦",
                createdAt: p.created_at || new Date().toISOString(),
              },
            });
          } else if (payload.eventType === "INSERT") {
            const p = payload.new;
            dispatchBase({
              type: "REALTIME_PRODUCT_INSERT",
              payload: {
                id: p.id,
                name: p.name,
                sku: p.sku,
                category: p.category,
                price: Number(p.price) || 0,
                cost: Number(p.cost) || 0,
                stock: Number(p.stock) || 0,
                minStock: Number(p.min_stock || 0),
                image: p.image || "📦",
                createdAt: p.created_at || new Date().toISOString(),
              },
            });
          } else if (payload.eventType === "DELETE") {
            if (payload.old?.id) {
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
          event: "INSERT",
          schema: "public",
          table: "sales",
          filter: `store_id=eq.${activeStore.id}`,
        },
        async (payload: any) => {
          const s = payload.new;
          if (!s?.id) return;

          try {
            const { data: items } = await supabase
              .from("sale_items")
              .select("*")
              .eq("sale_id", s.id);

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
              total: Number(s.total) || 0,
              paymentMethod: s.payment_method || "cash",
              amountGiven: s.amount_given ? Number(s.amount_given) : undefined,
              change: s.change ? Number(s.change) : undefined,
              customerName: s.customer_name || undefined,
              createdAt: s.created_at || new Date().toISOString(),
              userId: s.user_id,
              storeId: s.store_id,
            };

            dispatchBase({
              type: "REALTIME_SALE_INSERT",
              payload: sale,
            });
          } catch (e) {
            console.warn("Notice Realtime sale items:", e);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeActive(false);
    };
  }, [activeStore?.id]);

  // Load from Supabase
  useEffect(() => {
    if (!activeStore) return;

    async function loadData() {
      try {
        const [
          { data: settings },
          { data: categories },
          { data: products },
          { data: sales },
          { data: customers },
          { data: orders },
          { data: inventory },
          { data: expenses },
          { data: cashSessionsData }
        ] = await Promise.all([
          supabase.from('settings').select('*').eq('store_id', activeStore.id).maybeSingle(),
          supabase.from('categories').select('*').eq('store_id', activeStore.id),
          supabase.from('products').select('*').eq('store_id', activeStore.id),
          supabase.from('sales').select('*, items:sale_items(*)').eq('store_id', activeStore.id),
          supabase.from('customers').select('*').eq('store_id', activeStore.id),
          supabase.from('orders').select('*, items:order_items(*)').eq('store_id', activeStore.id),
          supabase.from('inventory_sessions').select('*, items:inventory_items(*)'),
          supabase.from('expenses').select('*').eq('store_id', activeStore.id),
          supabase.from('cash_sessions').select('*').eq('store_id', activeStore.id).order('opened_at', { ascending: false })
        ]);

        const payload: any = {
          sales: [],
          inventorySessions: [],
          orders: [],
  expenses: [],
          customers: [],
          cart: [],
          categories: demoCategories,
          products: [],
          settings: { name: "BoutiquePro", currency: "FCFA", taxRate: 0, city: "Dakar", country: "Sénégal", email: "contact@boutiquepro.com", phone: "+228 98 37 61 01" }
        };

        if (settings) {
          payload.settings = {
            name: settings.name || "BoutiquePro",
            currency: settings.currency || "FCFA",
            taxRate: Number(settings.tax_rate) || 0,
            logo: settings.logo,
            city: settings.city,
            country: settings.country,
            email: settings.email,
            phone: settings.phone
          };
        }
        if (categories && categories.length > 0) payload.categories = categories;
        if (products) {
          payload.products = products.map((p: any) => ({
            ...p,
            minStock: p.min_stock || 0
          }));
        }
        let localStoredPayments: DebtPayment[] = [];
        if (typeof window !== "undefined" && activeStore?.id) {
          try {
            localStoredPayments = JSON.parse(localStorage.getItem(`boutiquepro_debt_payments_${activeStore.id}`) || "[]");
          } catch (e) {}
        }

        if (sales) {
          payload.sales = sales.map((s: any) => ({
            ...s,
            paymentMethod: s.payment_method || "cash",
            customerName: s.customer_name,
            customerPhone: s.customer_phone,
            amountPaid: Number(s.amount_paid) || (s.payment_method === 'credit' ? 0 : s.total),
            remainingAmount: Number(s.remaining_amount) ?? (s.payment_method === 'credit' ? s.total : 0),
            paymentStatus: s.payment_status || (s.payment_method === 'credit' ? 'unpaid' : 'paid'),
            dueDate: s.due_date,
            createdAt: s.created_at,
            payments: localStoredPayments.filter((p) => p.saleId === s.id),
            items: s.items ? s.items.map((i: any) => ({
              ...i,
              productId: i.product_id,
              productName: i.product_name,
              unitPrice: i.unit_price
            })) : []
          }));
        }
        if (customers) {
          payload.customers = customers.map((c: any) => ({
            ...c,
            totalPurchases: c.total_purchases,
            lastVisit: c.last_visit
          }));
        }
        if (orders) {
          payload.orders = orders.map((o: any) => ({
            ...o,
            supplierName: o.supplier_name,
            totalCost: o.total_cost,
            createdAt: o.created_at,
            expectedAt: o.expected_at,
            items: o.items ? o.items.map((i: any) => ({
              ...i,
              productId: i.product_id,
              productName: i.product_name,
              costPrice: i.cost_price
            })) : []
          }));
        }
        if (inventory) {
          payload.inventorySessions = inventory.map((inv: any) => ({
            ...inv,
            totalVarianceValue: inv.total_variance_value,
            items: inv.items ? inv.items.map((i: any) => ({
              ...i,
              productId: i.product_id,
              productName: i.product_name,
              expectedStock: i.expected_stock,
              actualStock: i.actual_stock,
              costPrice: i.cost_price
            })) : []
          }));
        }
        if (expenses) {
          payload.expenses = expenses.map((e: any) => ({
             ...e,
             createdAt: e.created_at
          }));
        }
        payload.cashSessions = [];
        payload.activeCashSession = null;
        if (cashSessionsData && cashSessionsData.length > 0) {
          payload.cashSessions = cashSessionsData.map((cs: any) => ({
            id: cs.id,
            storeId: cs.store_id,
            userId: cs.user_id,
            cashierName: cs.cashier_name,
            openingAmount: Number(cs.opening_amount) || 0,
            closingAmount: cs.closing_amount !== null ? Number(cs.closing_amount) : undefined,
            expectedAmount: cs.expected_amount !== null ? Number(cs.expected_amount) : undefined,
            difference: cs.difference !== null ? Number(cs.difference) : undefined,
            totalCashSales: Number(cs.total_cash_sales) || 0,
            totalMobileMoneySales: Number(cs.total_mobile_money_sales) || 0,
            totalCardSales: Number(cs.total_card_sales) || 0,
            totalSalesCount: Number(cs.total_sales_count) || 0,
            totalSalesAmount: Number(cs.total_sales_amount) || 0,
            openedAt: cs.opened_at,
            closedAt: cs.closed_at,
            status: cs.status || "open",
            notes: cs.notes
          }));
          const currentOpen = payload.cashSessions.find((cs: any) => cs.status === "open");
          if (currentOpen) {
            // Recalcul dynamique des ventes réelles pour la session en cours
            const sessionSales = getSalesForSession(currentOpen, payload.sales, payload.cashSessions);
            const cash = sessionSales.filter((s: any) => s.paymentMethod === "cash").reduce((sum: number, s: any) => sum + s.total, 0);
            const mm = sessionSales.filter((s: any) => s.paymentMethod === "mobile_money").reduce((sum: number, s: any) => sum + s.total, 0);
            const card = sessionSales.filter((s: any) => s.paymentMethod === "card").reduce((sum: number, s: any) => sum + s.total, 0);
            const totalAmount = sessionSales.reduce((sum: number, s: any) => sum + s.total, 0);

            currentOpen.totalCashSales = cash;
            currentOpen.totalMobileMoneySales = mm;
            currentOpen.totalCardSales = card;
            currentOpen.totalSalesCount = sessionSales.length;
            currentOpen.totalSalesAmount = totalAmount;
            currentOpen.expectedAmount = currentOpen.openingAmount + cash;

            payload.activeCashSession = currentOpen;
          }
        }

        // Restore Cart from localStorage (cart shouldn't be in DB)
        const saved = typeof window !== "undefined" ? localStorage.getItem("boutiquepro-state") : null;
        if (saved) {
          try {
            const localData = JSON.parse(saved);
            if (Array.isArray(localData?.cart)) {
              payload.cart = localData.cart.filter((c: any) => c && c.product && typeof c.product.price === "number");
            }
          } catch {
            payload.cart = [];
          }
        }

        dispatchBase({ type: "LOAD_STATE", payload });
      } catch (err) {
        console.error("Error loading data from Supabase:", err);
        dispatchBase({ type: "LOAD_STATE", payload: initialState });
      } finally {
        setIsInitialized(true);
      }
    }
    loadData();
  }, [activeStore]);

  // Sync to local storage for unmigrated data (sales, inventory) just so it doesn't break
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("boutiquepro-state", JSON.stringify(state));
    }
  }, [state, isInitialized]);

  // Async Dispatch Wrapper
  const dispatch = async (action: Action) => {
    try {
      if (action.type === "ADD_PRODUCT") {
        const p = action.payload;
        const { error } = await supabase.from('products').insert([{ store_id: activeStore.id, 
          id: p.id, name: p.name, sku: p.sku, category: p.category, 
          price: p.price, cost: p.cost, stock: p.stock, 
          min_stock: p.minStock, image: p.image
        }]);
        if (error) { console.error("Supabase Add Product Error:", error); alert("Erreur Supabase Produit: " + error.message + " (Code: " + error.code + ")"); }
      } 
      else if (action.type === "DELETE_PRODUCT") {
        const { error } = await supabase.from('products').delete().eq('id', action.payload);
        if (error) console.error("Supabase Delete Product Error:", error);
      }
      else if (action.type === "UPDATE_PRODUCT") {
        const p = action.payload;
        const { error } = await supabase.from('products').update({
          name: p.name, sku: p.sku, category: p.category, 
          price: p.price, cost: p.cost, stock: p.stock, 
          min_stock: p.minStock, image: p.image
        }).eq('id', p.id);
        if (error) console.error("Supabase Update Product Error:", error);
      }
      else if (action.type === "UPDATE_SETTINGS") {
        const s = action.payload as any;
        const updates: any = {};
        if (s.name !== undefined) updates.name = s.name;
        if (s.currency !== undefined) updates.currency = s.currency;
        if (s.taxRate !== undefined) updates.tax_rate = s.taxRate;
        if (s.logo !== undefined) updates.logo = s.logo;
        if (s.city !== undefined) updates.city = s.city;
        if (s.country !== undefined) updates.country = s.country;
        if (s.email !== undefined) updates.email = s.email;
        if (s.phone !== undefined) updates.phone = s.phone;
        
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from('settings').update(updates).eq('store_id', activeStore.id);
          if (error) console.error("Supabase Update Settings Error:", error);
        }
      }
      else if (action.type === "COMPLETE_SALE") {
        const s = action.payload;

        // 1. Si le navigateur est hors-ligne, basculer directement dans la file d'attente locale
        if (typeof window !== "undefined" && !navigator.onLine) {
          await saveOfflineSale(activeStore.id, s);
          setPendingSyncCount((prev) => prev + 1);
          console.info("Vente enregistrée en file d'attente hors-ligne (mode sans connexion):", s.id);
        } else {
          try {
            // 2. Tentative en ligne via RPC atomique
            const { error: saleError } = await supabase.rpc('create_sale', {
              p_store_id: activeStore.id,
              p_sale_id: s.id,
              p_subtotal: s.subtotal,
              p_tax: s.tax,
              p_discount: s.discount,
              p_total: s.total,
              p_payment_method: s.paymentMethod,
              p_customer_name: s.customerName || null,
              p_created_at: s.createdAt,
              p_items: s.items
            });

            if (saleError) {
              console.warn("Erreur serveur Supabase, basculement en sauvegarde hors-ligne sécurisée:", saleError);
              await saveOfflineSale(activeStore.id, s);
              setPendingSyncCount((prev) => prev + 1);
            }
          } catch (netErr) {
            console.warn("Réseau indisponible, basculement en file d'attente hors-ligne:", netErr);
            await saveOfflineSale(activeStore.id, s);
            setPendingSyncCount((prev) => prev + 1);
          }
        }

        // Mettre à jour en continu les totaux dans Supabase si connecté et session active
        if (typeof window !== "undefined" && navigator.onLine && state.activeCashSession?.id) {
          try {
            const isCash = s.paymentMethod === "cash";
            const isMM = s.paymentMethod === "mobile_money";
            const isCard = s.paymentMethod === "card";
            const newCash = state.activeCashSession.totalCashSales + (isCash ? s.total : 0);
            const newMM = state.activeCashSession.totalMobileMoneySales + (isMM ? s.total : 0);
            const newCard = state.activeCashSession.totalCardSales + (isCard ? s.total : 0);
            const newCount = state.activeCashSession.totalSalesCount + 1;
            const newTotal = state.activeCashSession.totalSalesAmount + s.total;
            const newExpected = state.activeCashSession.openingAmount + newCash;

            await supabase.from("cash_sessions").update({
              total_cash_sales: newCash,
              total_mobile_money_sales: newMM,
              total_card_sales: newCard,
              total_sales_count: newCount,
              total_sales_amount: newTotal,
              expected_amount: newExpected
            }).eq("id", state.activeCashSession.id);
          } catch (e) {
            console.warn("Notice mise à jour session caisse:", e);
          }
        }
      }
      else if (action.type === "ADD_CUSTOMER") {
        const c = action.payload;
        const { error } = await supabase.from('customers').insert([{ store_id: activeStore.id, 
          id: c.id, name: c.name, phone: c.phone, email: c.email,
          total_purchases: c.totalPurchases, last_visit: c.lastVisit
        }]);
        if (error) console.error("Supabase Add Customer Error:", error);
      }
      else if (action.type === "ADD_ORDER") {
        const o = action.payload;
        const { error } = await supabase.from('orders').insert([{ store_id: activeStore.id, 
          id: o.id, supplier_name: o.supplierName, total_cost: o.totalCost,
          status: o.status, created_at: o.createdAt, expected_at: o.expectedAt
        }]);
        if (!error && o.items && o.items.length > 0) {
          const items = o.items.map((i: any) => ({
            id: 'oi' + Math.random().toString(36).substring(7),
            order_id: o.id, product_id: i.productId, product_name: i.productName,
            quantity: i.quantity, cost_price: i.costPrice, total: i.total
          }));
          await supabase.from('order_items').insert(items);
        }
      }
      else if (action.type === "UPDATE_ORDER_STATUS") {
        const { error } = await supabase.from('orders').update({ status: 'received' }).eq('id', action.payload.orderId);
        if (!error) {
           // update stock for each item
           const order = state.orders.find((o: any) => o.id === action.payload.orderId);
           if (order) {
              for (const item of order.items) {
                const prod = state.products.find((p: any) => p.id === item.productId);
                if (prod) {
                   await supabase.from('products').update({ stock: prod.stock + item.quantity }).eq('id', prod.id);
                }
              }
           }
        }
      }
      else if (action.type === "ADD_EXPENSE") {
        const e = action.payload;
        const { error } = await supabase.from('expenses').insert([{ store_id: activeStore.id, 
           id: e.id, date: e.date, category: e.category, description: e.description, amount: e.amount
        }]);
        if (error) console.error("Supabase Add Expense Error:", error);
      }
      else if (action.type === "UPDATE_EXPENSE") {
        const e = action.payload;
        const { error } = await supabase.from('expenses').update({
           date: e.date, category: e.category, description: e.description, amount: e.amount
        }).eq('id', e.id);
        if (error) console.error("Supabase Update Expense Error:", error);
      }
      else if (action.type === "DELETE_EXPENSE") {
        const { error } = await supabase.from('expenses').delete().eq('id', action.payload);
        if (error) console.error("Supabase Delete Expense Error:", error);
      }
      else if (action.type === "ADD_INVENTORY_SESSION") {
        const s = action.payload;
        const { error } = await supabase.from('inventory_sessions').insert([{ store_id: activeStore.id, 
           id: s.id, date: s.date, total_variance_value: s.totalVarianceValue, notes: s.notes
        }]);
        if (!error && s.items && s.items.length > 0) {
           const items = s.items.map((i: any) => ({
              id: 'iv' + Math.random().toString(36).substring(7),
              session_id: s.id, product_id: i.productId, product_name: i.productName,
              expected_stock: i.expectedStock, actual_stock: i.actualStock, 
              variance: i.variance, cost_price: i.costPrice
           }));
           await supabase.from('inventory_items').insert(items);
           // Update stock
           for (const item of s.items) {
               await supabase.from('products').update({ stock: item.actualStock }).eq('id', item.productId);
           }
        }
      }
      
      // Update local state immediately for fast UI
      dispatchBase(action);

    } catch (err) {
      console.error("Action error:", err);
      dispatchBase(action); // fallback update
    }
  };

  // Computed values
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " " + state.settings.currency;
  };

  const lowStockProducts = (state.products || []).filter((p) => p && p.stock <= p.minStock);

  const totalRevenue = (state.sales || []).reduce((sum, s) => sum + (s?.total || 0), 0);

  const today = new Date().toISOString().split("T")[0];
  const todaySales = (state.sales || []).filter((s) => s?.createdAt && s.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s?.total || 0), 0);
  const totalOrders = (state.sales || []).length;
  const todayOrders = todaySales.length;
  const averageBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const totalExpenses = state.expenses ? state.expenses.reduce((sum, e) => sum + Number(e.amount), 0) : 0;
  
  let totalCOGS = 0;
  (state.sales || []).forEach(sale => {
    if (!sale) return;
    (sale.items || []).forEach(item => {
      if (!item) return;
      const product = (state.products || []).find(p => p.id === item.productId);
      if (product) {
        totalCOGS += (product.cost * item.quantity);
      }
    });
  });

  const netProfit = totalRevenue - totalCOGS - totalExpenses;

  // Dettes, Crédits & Trésorerie Encaissée
  const creditSales = (state.sales || []).filter(
    (s) => s && (s.paymentMethod === "credit" || (s.remainingAmount !== undefined && s.remainingAmount > 0))
  );

  const totalCreditSales = creditSales.reduce((sum, s) => sum + (s?.total || 0), 0);

  const totalRecoveredAmount = creditSales.reduce(
    (sum, s) => sum + (s?.amountPaid ?? (s?.paymentStatus === "paid" ? s.total : 0)),
    0
  );

  const totalCollectedRevenue = Math.max(0, totalRevenue - totalDebtsAmount);

  const recoveryRate = totalCreditSales > 0
    ? Math.min(100, Math.round((totalRecoveredAmount / totalCreditSales) * 100))
    : 100;

  const now = new Date();
  const overdueDebtsCount = (unpaidDebts || []).filter(
    (s) => s && s.dueDate && new Date(s.dueDate) < now
  ).length;

  const collectedNetProfit = totalCollectedRevenue - totalCOGS - totalExpenses;

  const categorySales: Record<string, number> = {};
  (state.sales || []).forEach((sale) => {
    if (!sale) return;
    const discountRatio = sale.subtotal > 0 ? (sale.total / sale.subtotal) : 1;
    (sale.items || []).forEach((item) => {
      if (!item) return;
      const product = (state.products || []).find((p) => p.id === item.productId);
      if (product) {
        const netItemTotal = Math.round(item.total * discountRatio);
        categorySales[product.category] = (categorySales[product.category] || 0) + netItemTotal;
      }
    });
  });

  const categoryNames = state.categories.map((c) => c.name);

  const openCashSession = async (openingAmount: number, cashierName?: string): Promise<CashSession> => {
    const openedAt = new Date().toISOString();
    const tempSession: CashSession = {
      id: "cs_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      storeId: activeStore?.id || "",
      userId: user?.id || "",
      cashierName: cashierName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Caissier",
      openingAmount: openingAmount,
      expectedAmount: openingAmount,
      totalCashSales: 0,
      totalMobileMoneySales: 0,
      totalCardSales: 0,
      totalSalesCount: 0,
      totalSalesAmount: 0,
      openedAt,
      status: "open",
    };

    // Prendre en compte les ventes déjà faites aujourd'hui avant ouverture
    const priorSales = getSalesForSession(tempSession, state.sales, state.cashSessions);
    const priorCash = priorSales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0);
    const priorMM = priorSales.filter((s) => s.paymentMethod === "mobile_money").reduce((sum, s) => sum + s.total, 0);
    const priorCard = priorSales.filter((s) => s.paymentMethod === "card").reduce((sum, s) => sum + s.total, 0);
    const priorTotal = priorSales.reduce((sum, s) => sum + s.total, 0);

    const session: CashSession = {
      ...tempSession,
      totalCashSales: priorCash,
      totalMobileMoneySales: priorMM,
      totalCardSales: priorCard,
      totalSalesCount: priorSales.length,
      totalSalesAmount: priorTotal,
      expectedAmount: openingAmount + priorCash,
    };

    if (activeStore?.id) {
      try {
        await supabase.from("cash_sessions").insert([{
          id: session.id,
          store_id: activeStore.id,
          user_id: user?.id,
          cashier_name: session.cashierName,
          opening_amount: session.openingAmount,
          expected_amount: session.expectedAmount,
          total_cash_sales: session.totalCashSales,
          total_mobile_money_sales: session.totalMobileMoneySales,
          total_card_sales: session.totalCardSales,
          total_sales_count: session.totalSalesCount,
          total_sales_amount: session.totalSalesAmount,
          status: "open",
          opened_at: session.openedAt
        }]);
      } catch (e) {
        console.warn("Supabase cash_sessions insert notice:", e);
      }
    }

    dispatchBase({ type: "OPEN_CASH_SESSION", payload: session });
    return session;
  };

  const closeCashSession = async (closingAmount: number, notes?: string): Promise<CashSession | null> => {
    if (!state.activeCashSession) return null;
    const cur = state.activeCashSession;

    // Recalculer dynamiquement depuis state.sales pour garantir l'exactitude absolue
    const sessionSales = getSalesForSession(cur, state.sales, state.cashSessions);
    const cashSales = sessionSales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0);
    const mmSales = sessionSales.filter((s) => s.paymentMethod === "mobile_money").reduce((sum, s) => sum + s.total, 0);
    const cardSales = sessionSales.filter((s) => s.paymentMethod === "card").reduce((sum, s) => sum + s.total, 0);
    const totalAmount = sessionSales.reduce((sum, s) => sum + s.total, 0);
    const count = sessionSales.length;

    const expected = cur.openingAmount + cashSales;
    const diff = closingAmount - expected;
    const closedAt = new Date().toISOString();

    const closedSession: CashSession = {
      ...cur,
      closingAmount,
      expectedAmount: expected,
      difference: diff,
      totalCashSales: cashSales,
      totalMobileMoneySales: mmSales,
      totalCardSales: cardSales,
      totalSalesCount: count,
      totalSalesAmount: totalAmount,
      status: "closed",
      closedAt,
      notes: notes || undefined
    };

    if (activeStore?.id) {
      try {
        await supabase.from("cash_sessions").update({
          closing_amount: closingAmount,
          expected_amount: expected,
          difference: diff,
          total_cash_sales: cashSales,
          total_mobile_money_sales: mmSales,
          total_card_sales: cardSales,
          total_sales_count: count,
          total_sales_amount: totalAmount,
          status: "closed",
          closed_at: closedAt,
          notes: notes || null
        }).eq("id", cur.id);
      } catch (e) {
        console.warn("Supabase cash_sessions update notice:", e);
      }
    }

    dispatchBase({ type: "CLOSE_CASH_SESSION", payload: closedSession });
    return closedSession;
  };

  return (
    <StoreContext.Provider value={{ 
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
      openCashSession,
      closeCashSession,
      isOnline,
      pendingSyncCount,
      isSyncing,
      syncOfflineSales,
      isRealtimeActive,
      unpaidDebts,
      totalDebtsAmount,
      totalCreditSales,
      totalRecoveredAmount,
      totalCollectedRevenue,
      recoveryRate,
      overdueDebtsCount,
      collectedNetProfit,
      recordDebtPayment,
      createDirectDebt
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
}
