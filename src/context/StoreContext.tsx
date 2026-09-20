"use client";

import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode } from "react";
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


export interface Order {
  id: string;
  supplierName: string;
  items: { productId: string; productName: string; quantity: number; costPrice: number; total: number }[];
  totalCost: number;
  status: "pending" | "received";
  createdAt: string;
  expectedAt?: string;
}

export interface Sale {
  id: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: "cash" | "mobile_money" | "card";
  customerName?: string;
  createdAt: string;
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

export interface StoreState {
  products: Product[];
  sales: Sale[];
  orders: Order[];
  customers: Customer[];
  cart: CartItem[];
  categories: Category[];
  inventorySessions: InventorySession[];
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
  | { type: "ADD_CUSTOMER"; payload: Customer }
  | { type: "ADD_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "UPDATE_SETTINGS"; payload: Partial<StoreSettings> }
    | { type: "ADD_ORDER"; payload: Order }
  | { type: "UPDATE_ORDER_STATUS"; payload: { orderId: string; status: "received" } }
  | { type: "DELETE_ORDER"; payload: string }
  | { type: "ADD_INVENTORY_SESSION"; payload: InventorySession }
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
  customers: demoCustomers,
  cart: [],
  categories: demoCategories,
  inventorySessions: [],
  settings: { name: "BoutiquePro", currency: "FCFA", taxRate: 0, city: "Dakar", country: "Sénégal", email: "contact@boutiquepro.com", phone: "+221 77 000 00 00" },
};

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
      return { ...state, sales: [action.payload, ...state.sales], products: updatedProducts, cart: [] };
    }
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
    case "LOAD_STATE":
      return { 
        ...action.payload, 
        products: [...(action.payload.products || [])].sort((a, b) => a.name.localeCompare(b.name)),
        categories: action.payload.categories || demoCategories,
        orders: action.payload.orders || [],
        cart: action.payload.cart || [],
        inventorySessions: action.payload.inventorySessions || []
      };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
interface StoreContextType {
  state: StoreState;
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
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatchBase] = useReducer(storeReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: settings, error: settingsError } = await supabase.from('settings').select('*').single();
        const { data: categories } = await supabase.from('categories').select('*');
        const { data: products } = await supabase.from('products').select('*');

        // Toujours initialiser avec un payload par défaut complet
        const payload: any = {
          sales: [],
          inventorySessions: [],
          orders: [],
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

        // Récupérer le reste depuis localStorage
        const saved = localStorage.getItem("boutiquepro-state");
        if (saved) {
          const localData = JSON.parse(saved);
          if (localData.sales) payload.sales = localData.sales;
          if (localData.inventorySessions) payload.inventorySessions = localData.inventorySessions;
          if (localData.orders) payload.orders = localData.orders;
          if (localData.customers) payload.customers = localData.customers;
          if (localData.cart) payload.cart = localData.cart;
        }

        dispatchBase({ type: "LOAD_STATE", payload });
      } catch (err) {
        console.error("Error loading data from Supabase:", err);
        // Fallback to initial state to prevent crash
        dispatchBase({ type: "LOAD_STATE", payload: initialState });
      } finally {
        setIsInitialized(true);
      }
    }
    loadData();
  }, []);

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
        const { error } = await supabase.from('products').insert([{
          id: p.id, name: p.name, sku: p.sku, category: p.category, 
          price: p.price, cost: p.cost, stock: p.stock, 
          min_stock: p.minStock, image: p.image
        }]);
        if (error) console.error("Supabase Add Product Error:", error);
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
          const { error } = await supabase.from('settings').update(updates).eq('id', 1);
          if (error) console.error("Supabase Update Settings Error:", error);
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

  const lowStockProducts = state.products.filter((p) => p.stock <= p.minStock);

  const totalRevenue = state.sales.reduce((sum, s) => sum + s.total, 0);

  const today = new Date().toISOString().split("T")[0];
  const todaySales = state.sales.filter((s) => s.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalOrders = state.sales.length;
  const todayOrders = todaySales.length;
  const averageBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const categorySales: Record<string, number> = {};
  state.sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = state.products.find((p) => p.id === item.productId);
      if (product) {
        categorySales[product.category] = (categorySales[product.category] || 0) + item.total;
      }
    });
  });

  const categoryNames = state.categories.map((c) => c.name);

  return (
    <StoreContext.Provider value={{ state, dispatch, formatPrice, lowStockProducts, totalRevenue, todayRevenue, totalOrders, todayOrders, averageBasket, categorySales, categoryNames }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
}
