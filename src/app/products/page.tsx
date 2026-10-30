"use client";

import React, { useState, useMemo } from "react";
import { useStore, Product, ProductUnit } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { resolveModuleStatus } from "@/types/modules";
import { ProductAvatar } from "@/components/ui/ProductAvatar";
import { formatDecomposedStock } from "@/lib/stockDisplay";
import { exportInventoryValuation } from "@/lib/accountingExport";
import { FileSpreadsheet, Download, Upload } from "lucide-react";
import ProductExcelImportModal from "@/components/products/ProductExcelImportModal";
import {
  Package,
  Plus,
  Calculator,
  Search,
  Filter,
  Grid3X3,
  List,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
  Save,
  Tag,
  Layers,
  Clock,
  Calendar,
  ShieldCheck,
  Check,
  Sparkles,
  ShoppingBag,
  HelpCircle
} from "lucide-react";
import { ProductBatch, PriceHistoryEntry } from "@/context/StoreContext";
import { TrendingUp, TrendingDown, History, ArrowRight, DollarSign } from "lucide-react";

const BASE_UNITS = [
  { id: 'piece', label: 'Pièce / Unité', icon: '📦', presets: ['Carton (24)', 'Pack (6)', 'Carton (12)'] },
  { id: 'litre', label: 'Litre (L)', icon: '🥛', presets: ['Bidon de 25 L', 'Bidon de 10 L', 'Bidon de 5 L', 'Bouteille 1.5 L'] },
  { id: 'kg', label: 'Kilogramme (kg)', icon: '⚖️', presets: ['Sac de 50 kg', 'Sac de 25 kg', 'Sac de 10 kg', 'Sachet 500 g'] },
  { id: 'metre', label: 'Mètre (m)', icon: '📏', presets: ['Rouleau de 100 m', 'Rouleau de 50 m', 'Rouleau de 25 m'] },
  { id: 'sachet', label: 'Sachet / Paquet', icon: '🍬', presets: ['Carton de 50', 'Carton de 20', 'Paquet de 10'] },
  { id: 'boite', label: 'Boîte / Conserve', icon: '🥫', presets: ['Carton (24)', 'Carton (12)', 'Pack (6)'] },
];

const MARKET_WHOLESALE_PRESETS = [
  { name: 'Bidon de 25 L', multiplier: 25, unit: 'Litre (L)', icon: '🥛' },
  { name: 'Carton de 24', multiplier: 24, unit: 'Pièce / Unité', icon: '📦' },
  { name: 'Sac de 50 kg', multiplier: 50, unit: 'Kilogramme (kg)', icon: '⚖️' },
  { name: 'Carton de 50 boîtes', multiplier: 50, unit: 'Boîte / Conserve', icon: '🥫' },
  { name: 'Carton de 50 sachets', multiplier: 50, unit: 'Sachet / Paquet', icon: '🍬' },
  { name: 'Pack de 12 bouteilles', multiplier: 12, unit: 'Pièce / Unité', icon: '🥤' },
  { name: 'Pack de 6 bouteilles', multiplier: 6, unit: 'Pièce / Unité', icon: '🧃' },
  { name: 'Bidon de 10 L', multiplier: 10, unit: 'Litre (L)', icon: '🛢️' },
  { name: 'Sac de 25 kg', multiplier: 25, unit: 'Kilogramme (kg)', icon: '🌾' },
];

const renderExpiryBadge = (nearestBatch: ProductBatch) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(nearestBatch.expiryDate);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="rounded-full bg-red-600/15 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-600 flex items-center gap-1 animate-pulse" title={`Périmé depuis le ${new Date(nearestBatch.expiryDate).toLocaleDateString('fr-FR')}`}>
        <AlertTriangle className="h-3 w-3" />
        <span>Périmé (${Math.abs(diffDays)}j) • ${nearestBatch.batchNumber}</span>
      </span>
    );
  }
  if (diffDays === 0) {
    return (
      <span className="rounded-full bg-red-600/15 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-600 flex items-center gap-1 animate-pulse" title="Expire aujourd'hui">
        <AlertTriangle className="h-3 w-3" />
        <span>Expire AUJOURD'HUI !</span>
      </span>
    );
  }
  if (diffDays <= 3) {
    return (
      <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-600 flex items-center gap-1" title="Derniers jours avant péremption">
        <Clock className="h-3 w-3 text-red-500" />
        <span>Expire dans ${diffDays}j (Urgent)</span>
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="rounded-full bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-600 flex items-center gap-1" title="Expire dans la semaine">
        <Clock className="h-3 w-3 text-orange-500" />
        <span>Expire dans ${diffDays}j (1 sem.)</span>
      </span>
    );
  }
  if (diffDays <= 30) {
    return (
      <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 flex items-center gap-1" title="Expire sous 1 mois">
        <Clock className="h-3 w-3 text-amber-500" />
        <span>Expire sous 1 mois (${diffDays}j)</span>
      </span>
    );
  }
  if (diffDays <= 60) {
    return (
      <span className="rounded-full bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1" title="Expire sous 2 mois">
        <Calendar className="h-3 w-3 text-yellow-600" />
        <span>Expire sous 2 mois (${diffDays}j)</span>
      </span>
    );
  }
  if (diffDays <= 90) {
    return (
      <span className="rounded-full bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1" title="Alerte précoce à 3 mois">
        <Calendar className="h-3 w-3 text-blue-500" />
        <span>Expire sous 3 mois (${diffDays}j)</span>
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-600 flex items-center gap-1">
      <Check className="h-2.5 w-2.5" />
      <span>DLC: ${new Date(nearestBatch.expiryDate).toLocaleDateString('fr-FR')}</span>
    </span>
  );
};

export default function ProductsPage() {
  const { role, activeStore, tier, isModuleActive } = useAuth();
  const { state, dispatch, formatPrice } = useStore();
  const isMultiUnitsEnabled = useMemo(() => {
    if (role === 'admin') return true;
    if (!activeStore) return true;
    return isModuleActive ? isModuleActive('multi_units') : true;
  }, [activeStore, isModuleActive, role]);

  const [formUnits, setFormUnits] = useState<{ id?: string; name: string; multiplier: number; price: string | number; cost?: string | number; barcode: string }[]>([]);
  const [purchaseMode, setPurchaseMode] = useState<"wholesale" | "retail">("wholesale");
  const [wholesaleName, setWholesaleName] = useState("");
  const [wholesaleMultiplier, setWholesaleMultiplier] = useState<number | "">("");
  const [wholesalePurchaseCost, setWholesalePurchaseCost] = useState<number | "">("");
  const [wholesaleSellingPrice, setWholesaleSellingPrice] = useState<number | "">("");
  const [wholesaleStockPacks, setWholesaleStockPacks] = useState<number | "">("");
  const [retailExtraStock, setRetailExtraStock] = useState<number | "">("");
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  const [calcCartonPrice, setCalcCartonPrice] = useState("");
  const [calcCartonUnits, setCalcCartonUnits] = useState("");
  const [selectedUnitForBatchId, setSelectedUnitForBatchId] = useState<string>("ref");
  const [batchSyncProductStock, setBatchSyncProductStock] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "ok">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Product Import Modal
  const [showImportModal, setShowImportModal] = useState(false);

  // Product Modal
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const emptyForm = { name: "", sku: "", category: "Alimentation", unit: "Pièce / Unité", price: 0, cost: 0, stock: 0, minStock: 5, image: "📦" };
  const [form, setForm] = useState(emptyForm);
  const [initialBatch, setInitialBatch] = useState<{ batchNumber: string; expiryDate: string }>({ batchNumber: '', expiryDate: '' });
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "critical" | "30d" | "60d" | "90d">("all");
  const [selectedProductForBatches, setSelectedProductForBatches] = useState<Product | null>(null);
  const [newBatchForm, setNewBatchForm] = useState({ batchNumber: "", expiryDate: "", quantity: 1 });
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [selectedProductForPriceHistory, setSelectedProductForPriceHistory] = useState<Product | null>(null);
  const [priceHistoryTab, setPriceHistoryTab] = useState<"all" | "selling" | "cost">("all");


  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", icon: "📦", color: "#6343EA" });

  const filtered = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return state.products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "Tous" || p.category === categoryFilter;
      const matchStock = stockFilter === "all" || (stockFilter === "low" ? p.stock <= p.minStock : p.stock > p.minStock);

      let matchExpiry = true;
      if (expiryFilter !== "all") {
        const prodBatches = (state.batches || [])
          .filter((b) => b.productId === p.id && b.currentQuantity > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        if (prodBatches.length === 0) {
          matchExpiry = false;
        } else {
          const nearest = prodBatches[0];
          const exp = new Date(nearest.expiryDate);
          exp.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (expiryFilter === "expired") {
            matchExpiry = diffDays < 0;
          } else if (expiryFilter === "critical") {
            matchExpiry = diffDays >= 0 && diffDays <= 7;
          } else if (expiryFilter === "30d") {
            matchExpiry = diffDays >= 0 && diffDays <= 30;
          } else if (expiryFilter === "60d") {
            matchExpiry = diffDays >= 0 && diffDays <= 60;
          } else if (expiryFilter === "90d") {
            matchExpiry = diffDays >= 0 && diffDays <= 90;
          }
        }
      }

      return matchSearch && matchCategory && matchStock && matchExpiry;
    });
  }, [state.products, state.batches, search, categoryFilter, stockFilter, expiryFilter]);

  const openCreate = () => {
    setEditProduct(null);
    setForm({ ...emptyForm, category: state.categories[0]?.name || "Divers", unit: "Pièce / Unité" });
    setFormUnits([]);
    setPurchaseMode("wholesale");
    setWholesaleName("Carton de 24");
    setWholesaleMultiplier(24);
    setWholesalePurchaseCost("");
    setWholesaleSellingPrice("");
    setWholesaleStockPacks("");
    setRetailExtraStock("");
    setShowCostCalculator(false);
    setCalcCartonPrice("");
    setCalcCartonUnits("");
    setInitialBatch({ batchNumber: '', expiryDate: '' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.unit || "Pièce / Unité",
      price: p.price,
      cost: role === "admin" ? p.cost : 0,
      stock: p.stock,
      minStock: p.minStock,
      image: p.image
    });

    const existingWholesale = (p.units || []).find((u) => Number(u.multiplier) > 1);
    if (existingWholesale) {
      setPurchaseMode("wholesale");
      setWholesaleName(existingWholesale.name);
      setWholesaleMultiplier(existingWholesale.multiplier);
      setWholesalePurchaseCost(existingWholesale.cost !== null && existingWholesale.cost !== undefined ? existingWholesale.cost : "");
      setWholesaleSellingPrice(existingWholesale.price !== null && existingWholesale.price !== undefined ? existingWholesale.price : "");
      const mult = Number(existingWholesale.multiplier) || 1;
      const packs = Math.floor((p.stock || 0) / mult);
      const rem = Math.round(((p.stock || 0) % mult) * 1000) / 1000;
      setWholesaleStockPacks(packs > 0 ? packs : "");
      setRetailExtraStock(rem > 0 ? rem : "");
      setFormUnits(
        (p.units || [])
          .filter((u) => u.id !== existingWholesale.id)
          .map((u) => ({
            id: u.id,
            name: u.name,
            multiplier: u.multiplier,
            price: u.price !== null && u.price !== undefined ? u.price : "",
            cost: u.cost !== null && u.cost !== undefined ? u.cost : "",
            barcode: u.barcode || "",
          }))
      );
    } else {
      setPurchaseMode("retail");
      setWholesaleName("");
      setWholesaleMultiplier("");
      setWholesalePurchaseCost("");
      setWholesaleSellingPrice("");
      setWholesaleStockPacks("");
      setRetailExtraStock("");
      setFormUnits(
        (p.units || []).map((u) => ({
          id: u.id,
          name: u.name,
          multiplier: u.multiplier,
          price: u.price !== null && u.price !== undefined ? u.price : "",
          cost: u.cost !== null && u.cost !== undefined ? u.cost : "",
          barcode: u.barcode || "",
        }))
      );
    }

    setShowCostCalculator(false);
    setCalcCartonPrice("");
    setCalcCartonUnits("");
    const existingBatch = (state.batches || []).find((b) => b.productId === p.id && b.currentQuantity > 0);
    if (existingBatch) {
      setInitialBatch({ batchNumber: existingBatch.batchNumber, expiryDate: existingBatch.expiryDate });
    } else {
      setInitialBatch({ batchNumber: '', expiryDate: '' });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name) return;
    
    const finalSku = form.sku.trim() || (form.name.substring(0, 3).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000));
    
    // Si achat en gros, dériver le coût unitaire et le stock physique total
    let effectiveCost = role === "admin" ? (Number(form.cost) || 0) : 0;
    let effectiveStock = Number(form.stock) || 0;

    const allUnitsList = [...formUnits];

    if (purchaseMode === "wholesale" && wholesaleName.trim() && Number(wholesaleMultiplier) > 0) {
      const mult = Number(wholesaleMultiplier);
      const wCost = wholesalePurchaseCost !== "" ? Number(wholesalePurchaseCost) : null;
      const wPrice = wholesaleSellingPrice !== "" ? Number(wholesaleSellingPrice) : null;

      if (wCost !== null && wCost > 0 && mult > 0 && role === "admin") {
        effectiveCost = Math.round((wCost / mult) * 100) / 100;
      }

      const packs = Number(wholesaleStockPacks) || 0;
      const extra = Number(retailExtraStock) || 0;
      effectiveStock = Math.round((packs * mult + extra) * 1000) / 1000;

      allUnitsList.unshift({
        id: editProduct?.units?.find(u => u.name === wholesaleName.trim())?.id,
        name: wholesaleName.trim(),
        multiplier: mult,
        price: wPrice !== null ? wPrice : "",
        cost: wCost !== null ? wCost : "",
        barcode: "",
      });
    }

    const costToSave = role === "admin" ? effectiveCost : 0;

    const parsedUnits: ProductUnit[] = allUnitsList
      .filter((u) => u.name.trim().length > 0 && Number(u.multiplier) > 0)
      .map((u) => ({
        id: u.id || ("pu_" + Math.random().toString(36).substring(7)),
        storeId: activeStore?.id || "",
        productId: editProduct ? editProduct.id : "",
        name: u.name.trim(),
        multiplier: Number(u.multiplier),
        price: (u.price !== "" && u.price !== null && u.price !== undefined && Number(u.price) > 0) ? Number(u.price) : null,
        cost: (u.cost !== "" && u.cost !== null && u.cost !== undefined && Number(u.cost) > 0) ? Number(u.cost) : null,
        barcode: u.barcode ? u.barcode.trim() : null,
        isReference: false,
      }));

    const newProdId = "p" + Date.now();
    if (editProduct) {
      parsedUnits.forEach((u) => (u.productId = editProduct.id));
      dispatch({ 
        type: "UPDATE_PRODUCT", 
        payload: { 
          ...editProduct, 
          ...form, 
          stock: effectiveStock, 
          unit: form.unit, 
          cost: costToSave, 
          sku: finalSku, 
          units: parsedUnits 
        } 
      });
    } else {
      parsedUnits.forEach((u) => (u.productId = newProdId));
      const newProduct: Product = {
        id: newProdId,
        ...form,
        stock: effectiveStock,
        unit: form.unit,
        cost: costToSave,
        sku: finalSku,
        createdAt: new Date().toISOString().split("T")[0],
        units: parsedUnits,
      };
      dispatch({ type: "ADD_PRODUCT", payload: newProduct });
    }

    if (initialBatch.expiryDate && initialBatch.expiryDate.trim()) {
      const targetProdId = editProduct ? editProduct.id : newProdId;
      const existingBatches = (state.batches || []).filter((b) => b.productId === targetProdId);
      const alreadyExists = existingBatches.some((b) => b.expiryDate === initialBatch.expiryDate);
      if (!alreadyExists) {
        const newBatch: ProductBatch = {
          id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(7),
          storeId: activeStore?.id || '',
          productId: targetProdId,
          batchNumber: initialBatch.batchNumber.trim() || ('LOT-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900)),
          expiryDate: initialBatch.expiryDate,
          initialQuantity: Number(form.stock) > 0 ? Number(form.stock) : 1,
          currentQuantity: Number(form.stock) > 0 ? Number(form.stock) : 1,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_BATCH', payload: newBatch });
      }
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    dispatch({ type: "DELETE_PRODUCT", payload: id });
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name) return;
    dispatch({ 
      type: "ADD_CATEGORY", 
      payload: { 
        id: "cat" + Date.now(), 
        name: categoryForm.name, 
        icon: categoryForm.icon, 
        color: categoryForm.color 
      } 
    });
    setShowCategoryModal(false);
    setCategoryForm({ name: "", icon: "📦", color: "#6343EA" });
  };

  const handleDeleteCategory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(confirm("Supprimer cette catégorie ?")) {
      dispatch({ type: "DELETE_CATEGORY", payload: id });
      setCategoryFilter("Tous");
    }
  };

  const emojiOptions = ["📦", "👕", "👖", "👗", "👟", "👜", "⌚", "🧢", "🕶️", "🧴", "💍", "🎒", "🧣", "🧤", "👔", "📱", "💻", "🎮", "🍔", "🍕", "🍎"];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Produits & Stock
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {state.products.length} produits • {state.products.filter((p) => p.stock <= p.minStock).length} en alerte
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bouton IMPORTER EXCEL (Admin uniquement) */}
          {role === "admin" && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
              title="Importer votre catalogue depuis un fichier Excel ou CSV"
            >
              <Upload className="h-4 w-4" />
              <span>Importer Excel</span>
            </button>
          )}

          {/* Bouton Nouveau Produit Manuel */}
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau produit</span>
          </button>

          {/* Bouton Exporter le stock (Admin uniquement) */}
          {role === "admin" && (
            <button
              type="button"
              onClick={() => exportInventoryValuation(state.products, state.settings.currency, "excel")}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 hover:bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all shadow-xs"
              title="Télécharger l'inventaire complet actuel en Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Exporter le stock</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-secondary/30 py-2.5 pl-10 pr-4 text-base sm:text-sm placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full">
          <button
            onClick={() => setCategoryFilter("Tous")}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              categoryFilter === "Tous"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            Tous
          </button>
          {state.categories.map((cat) => (
            <div key={cat.id} className="group relative flex items-center">
              <button
                onClick={() => setCategoryFilter(cat.name)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                  categoryFilter === cat.name
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span>{cat.icon}</span> {cat.name}
              </button>
              {role === "admin" && (
                <button 
                  onClick={(e) => handleDeleteCategory(e, cat.id)} 
                  className="hidden group-hover:flex absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 z-10 shadow-sm hover:scale-110 transition-transform"
                  title="Supprimer la catégorie"
                >
                   <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {role === "admin" && (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="whitespace-nowrap rounded-full border border-dashed border-primary/50 px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-all flex items-center gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Catégorie
            </button>
          )}
        </div>

        {/* Stock filter & view toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as "all" | "low" | "ok")}
            className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tous les stocks</option>
            <option value="low">Stock faible</option>
            <option value="ok">Stock OK</option>
          </select>
                    <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as any)}
            className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
          >
            <option value="all">Toutes dates</option>
            <option value="expired">🚨 Déjà périmés</option>
            <option value="critical">🔴 Critique (≤ 7 jours)</option>
            <option value="30d">🟠 Court terme (≤ 1 mois / 30j)</option>
            <option value="60d">🟡 Moyen terme (≤ 2 mois / 60j)</option>
            <option value="90d">🔵 Alerte précoce (≤ 3 mois / 90j)</option>
          </select>
          <div className="flex rounded-xl border border-border/60 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
          {filtered.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card hover-lift">
              {/* Image area */}
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-secondary/50 to-secondary/20">
                <ProductAvatar name={p.name} className="w-20 h-20 text-3xl shadow-sm" />
              </div>

              {/* Stock badge */}
              {p.stock < 0 ? (
                <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white badge-pulse shadow-sm">
                  <AlertTriangle className="h-3 w-3" />
                  Stock négatif ({p.stock})
                </div>
              ) : p.stock === 0 ? (
                <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <AlertTriangle className="h-3 w-3" />
                  Rupture (0)
                </div>
              ) : p.stock <= p.minStock ? (
                <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-bold text-white badge-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  Stock bas
                </div>
              ) : null}

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.sku} • {p.category}</p>
                    {p.units && p.units.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {p.units.map((u) => {
                          const uPrice = u.price ?? (p.price * u.multiplier);
                          return (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1 rounded-md bg-secondary/80 border border-border/50 px-1.5 py-0.5 text-[9px] font-medium text-foreground"
                              title={`Format ${u.name} (x${u.multiplier} ${p.unit || 'u'}) : ${formatPrice(uPrice)}`}
                            >
                              <span className="font-semibold text-primary">{u.name}</span>: {formatPrice(uPrice)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-primary">{formatPrice(p.price)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      / {p.unit || "unité"}
                      {role === "admin" && p.cost > 0 && ` • Coût: ${formatPrice(p.cost)}`}
                    </p>
                  </div>
                  {(() => {
                    const decomp = formatDecomposedStock(p.stock, p.unit, p.units);
                    return (
                      <div className="text-right">
                        <p className={`text-sm font-bold ${p.stock <= p.minStock ? "text-destructive" : "text-foreground"}`}>
                          {p.stock.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} <span className="text-xs font-normal text-muted-foreground">{p.unit || "u"}</span>
                        </p>
                        {decomp.hasWholesaleFormat && decomp.wholesalePacks > 0 ? (
                          <p className="text-[10px] font-semibold text-primary" title={decomp.fullSummary}>
                            {decomp.decomposedText}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">en stock</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                                {/* Badges de Péremption & Lots */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const prodBatches = (state.batches || [])
                      .filter((b) => b.productId === p.id && b.currentQuantity > 0)
                      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

                    if (prodBatches.length === 0) return null;
                    return renderExpiryBadge(prodBatches[0]);
                  })()}
                  <button
                    onClick={() => {
                      setSelectedProductForBatches(p);
                      setNewBatchForm({ batchNumber: "", expiryDate: "", quantity: 1 });
                    }}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1 ${
                      (state.batches || []).filter(b => b.productId === p.id).length > 0
                        ? 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    <Package className="h-3 w-3" />
                    {(state.batches || []).filter(b => b.productId === p.id).length > 0
                      ? `${(state.batches || []).filter(b => b.productId === p.id).length} lot(s)`
                      : '+ DLC / Lot'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProductForPriceHistory(p);
                      setPriceHistoryTab("all");
                    }}
                    className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1"
                    title="Historique des variations de prix"
                  >
                    <TrendingUp className="h-3 w-3" />
                    <span>{(state.priceHistory || []).filter(h => h.productId === p.id).length} var.</span>
                  </button>
                </div>

                {/* Margin badge */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    {role === "admin" ? `Marge: ${p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%` : ""}
                  </span>
                </div>

                {/* Actions (visible on hover) uniquement pour le gérant */}
                {role === "admin" && (
                  <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-secondary py-1.5 text-xs font-medium hover:bg-secondary/80 transition-colors"
                    >
                      <Edit3 className="h-3 w-3" /> Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="flex items-center justify-center rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Produit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Catégorie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Prix</th>
                {role === "admin" && <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Coût</th>}
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Stock</th>
                {role === "admin" && <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Marge</th>}
                {role === "admin" && <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProductAvatar name={p.name} size="sm" />
                      <div>
                        <span className="text-sm font-medium block">{p.name}</span>
                        {p.units && p.units.length > 0 && (
                          <span className="text-[10px] text-muted-foreground block truncate max-w-xs">
                            Formats : {p.units.map(u => `${u.name} (${formatPrice(u.price ?? (p.price * u.multiplier))})`).join(" • ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">{formatPrice(p.price)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">/{p.unit || "u"}</span>
                  </td>
                  {role === "admin" && <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatPrice(p.cost)}</td>}
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const decomp = formatDecomposedStock(p.stock, p.unit, p.units);
                      return (
                        <div>
                          <div className="flex items-baseline justify-end gap-1">
                            <span className={`text-sm font-semibold ${p.stock < 0 ? "text-red-600 font-bold" : p.stock <= p.minStock ? "text-destructive" : ""}`}>
                              {p.stock.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{p.unit || "u"}</span>
                          </div>
                          {decomp.hasWholesaleFormat && decomp.wholesalePacks > 0 && (
                            <p className="text-[9px] text-primary font-medium text-right mt-0.5" title={decomp.fullSummary}>
                              {decomp.decomposedText}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {(() => {
                      const prodBatches = (state.batches || [])
                        .filter((b) => b.productId === p.id && b.currentQuantity > 0)
                        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                      if (prodBatches.length === 0) return null;
                      return (
                        <div className="mt-1 flex justify-end">
                          {renderExpiryBadge(prodBatches[0])}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {role === "admin" && <span className="text-xs text-accent font-medium">{p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%</span>}
                  </td>
                  {role === "admin" && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedProductForBatches(p);
                            setNewBatchForm({ batchNumber: "", expiryDate: "", quantity: 1 });
                          }}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                          title="Traçabilité & Lots"
                        >
                          <Package className="h-3.5 w-3.5 text-primary" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProductForPriceHistory(p);
                            setPriceHistoryTab("all");
                          }}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-blue-500"
                          title="Historique des variations de prix"
                        >
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                        </button>
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                          <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun produit trouvé</p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-700 transition-all"
            >
              <Upload className="h-4 w-4" />
              <span>Importer un fichier Excel</span>
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-90 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Créer manuellement</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Create/Edit Product */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{editProduct ? "Modifier le produit" : "Nouveau produit"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom du produit *</label>
                  <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="T-Shirt Premium"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">SKU (Optionnel)</label>
                  <input
                    type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="TSH-001"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Catégorie</label>
                <select
                  value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* SECTION 2 : MODE D'APPROVISIONNEMENT & ACHATS (Gros d'abord vs Pièce) */}
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 via-secondary/15 to-transparent p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-primary" />
                      1. Mode d'achat fournisseur (Comment achetez-vous ce produit ?)
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Privilégiez l'achat en gros ou carton pour les supérettes, boutiques et grossistes.
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl bg-secondary/80 p-1 border border-border/60 self-start sm:self-auto shrink-0 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setPurchaseMode("wholesale")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        purchaseMode === "wholesale"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>📦 Achat en Gros / Carton (Privilégié)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchaseMode("retail")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        purchaseMode === "retail"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>🛍️ Achat à la Pièce</span>
                    </button>
                  </div>
                </div>

                {/* SÉLECTEUR DE L'UNITÉ DE MESURE DE BASE (RÉFÉRENCE DÉTAIL) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span>Unité physique de base (au détail) :</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">Ex: Litre, Kilogramme, Boîte...</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BASE_UNITS.map((u) => {
                      const isSelected = form.unit === u.label;
                      return (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => {
                            setForm({ ...form, unit: u.label });
                            if (purchaseMode === "wholesale" && (!wholesaleName || wholesaleName === "Carton de 24")) {
                              const matchPreset = MARKET_WHOLESALE_PRESETS.find(p => p.unit === u.label);
                              if (matchPreset) {
                                setWholesaleName(matchPreset.name);
                                setWholesaleMultiplier(matchPreset.multiplier);
                              }
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card hover:bg-secondary text-muted-foreground hover:text-foreground border-border/60"
                          }`}
                        >
                          <span>{u.icon}</span>
                          <span>{u.label}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const custom = prompt("Entrez l'unité personnalisée (ex: Barre, Portion, Tasse, Botte) :", form.unit);
                        if (custom && custom.trim()) {
                          setForm({ ...form, unit: custom.trim() });
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                        !BASE_UNITS.some((u) => u.label === form.unit) && form.unit
                          ? "bg-primary text-primary-foreground border-primary font-bold"
                          : "bg-card text-muted-foreground border-border/60 hover:bg-secondary"
                      }`}
                      title="Saisir une autre unité"
                    >
                      <span>✏️</span>
                      <span>{!BASE_UNITS.some((u) => u.label === form.unit) && form.unit ? form.unit : "Autre..."}</span>
                    </button>
                  </div>
                </div>

                {/* SOUS-PANNEAU ACHAT EN GROS (PRIVILÉGIÉ PAR DÉFAUT) */}
                {purchaseMode === "wholesale" ? (
                  <div className="rounded-xl border border-primary/25 bg-card/80 p-3.5 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-border/40">
                      <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        Formats fréquents sur le marché :
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {MARKET_WHOLESALE_PRESETS.filter(p => !form.unit || p.unit === form.unit).slice(0, 5).map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setWholesaleName(p.name);
                              setWholesaleMultiplier(p.multiplier);
                              setForm({ ...form, unit: p.unit });
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-primary/10 hover:text-primary text-foreground border border-border/50 font-medium transition-all"
                          >
                            {p.icon} {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          Nom du format d'achat gros *
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Bidon de 25 L, Carton de 50"
                          value={wholesaleName}
                          onChange={(e) => setWholesaleName(e.target.value)}
                          className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs font-semibold focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1" title="Nombre d'unités contenues">
                          Contenance ({form.unit ? `${form.unit}s` : 'unités'}) *
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 25"
                          min="0.001"
                          step="any"
                          value={wholesaleMultiplier}
                          onChange={(e) => setWholesaleMultiplier(e.target.value === "" ? "" : parseFloat(e.target.value))}
                          className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-center font-bold text-primary focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      {role === "admin" && (
                        <div className="sm:col-span-5">
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1" title="Prix total payé au fournisseur pour ce format">
                            Prix d'achat payé au fournisseur (FCFA) *
                          </label>
                          <input
                            type="number"
                            placeholder="Ex: 17500"
                            min="0"
                            value={wholesalePurchaseCost}
                            onChange={(e) => {
                              const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                              setWholesalePurchaseCost(val);
                              if (val && Number(val) > 0 && wholesaleMultiplier && Number(wholesaleMultiplier) > 0) {
                                const uCost = Math.round((Number(val) / Number(wholesaleMultiplier)) * 100) / 100;
                                setForm({ ...form, cost: uCost });
                              }
                            }}
                            className="w-full rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      )}
                    </div>

                    {/* Aperçu financier du coût de revient dérivé */}
                    {role === "admin" && wholesalePurchaseCost && wholesaleMultiplier && Number(wholesaleMultiplier) > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          ⚡ <strong className="text-foreground">Coût unitaire équivalent :</strong> 
                          <span>{wholesalePurchaseCost} FCFA ÷ {wholesaleMultiplier} {form.unit || 'u'} =</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                            {formatPrice(Math.round((Number(wholesalePurchaseCost) / Number(wholesaleMultiplier)) * 100) / 100)} / {form.unit || 'unité'}
                          </span>
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          ✓ Appliqué automatiquement au stock
                        </span>
                      </div>
                    )}

                    {/* Stock initial saisi en cartons / bidons */}
                    <div className="pt-2 border-t border-border/40">
                      <label className="text-xs font-bold text-foreground block mb-1">
                        📦 Stock initial disponible à la boutique :
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                            Nombre de {wholesaleName || 'cartons / bidons'} complets
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Ex: 10"
                            value={wholesaleStockPacks}
                            onChange={(e) => {
                              const packs = e.target.value === "" ? "" : parseFloat(e.target.value);
                              setWholesaleStockPacks(packs);
                              const mult = Number(wholesaleMultiplier) || 1;
                              const extra = Number(retailExtraStock) || 0;
                              const totalUnits = (Number(packs) || 0) * mult + extra;
                              setForm({ ...form, stock: totalUnits });
                            }}
                            className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs font-bold text-primary focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                            + Restes entamés au détail ({form.unit ? `${form.unit}s` : 'unités'})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Ex: 5"
                            value={retailExtraStock}
                            onChange={(e) => {
                              const extra = e.target.value === "" ? "" : parseFloat(e.target.value);
                              setRetailExtraStock(extra);
                              const mult = Number(wholesaleMultiplier) || 1;
                              const packs = Number(wholesaleStockPacks) || 0;
                              const totalUnits = packs * mult + (Number(extra) || 0);
                              setForm({ ...form, stock: totalUnits });
                            }}
                            className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs font-medium focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                      {(Number(wholesaleStockPacks) > 0 || Number(retailExtraStock) > 0) && (
                        <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          📦 Total stock physique unique enregistré : <strong>{(Number(wholesaleStockPacks) || 0) * (Number(wholesaleMultiplier) || 1) + (Number(retailExtraStock) || 0)} {form.unit ? `${form.unit}s` : 'unités'}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* SOUS-PANNEAU ACHAT À LA PIÈCE / UNITÉ DIRECTE */
                  <div className="rounded-xl border border-border/60 bg-card/80 p-3.5 space-y-3 shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {role === "admin" && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Coût d'achat par {form.unit || 'unité'} (FCFA) *
                          </label>
                          <input
                            type="number"
                            placeholder="Ex: 700"
                            value={form.cost || ""}
                            onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                            className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs font-semibold focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Stock initial en {form.unit ? `${form.unit}s` : 'unités'} *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Ex: 50"
                          value={form.stock !== undefined ? form.stock : ""}
                          onChange={(e) => setForm({ ...form, stock: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                          className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs font-semibold focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stock d'alerte minimum */}
                <div className="max-w-xs">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Seuil d'alerte stock faible (en <span className="font-bold text-foreground">{form.unit ? `${form.unit}s` : 'unités'}</span>)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Ex: 10"
                    value={form.minStock !== undefined ? form.minStock : ""}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs font-medium focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* SECTION 3 : TARIFS DE REVENTE (Gros & Détail 100% Indépendants) */}
              <div className="rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 via-secondary/15 to-transparent p-4 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    2. Prix de revente (Gros & Détail selon vos convenances)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Fixez librement vos prix. Le prix au détail n'est pas obligatoirement égal à la division du carton.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Prix de vente au détail par unité de base */}
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5 shadow-xs">
                    <label className="text-xs font-bold text-foreground block">
                      🛍️ Vente au DÉTAIL par <span className="text-primary font-extrabold">{form.unit || 'unité'}</span> (FCFA) *
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 1000"
                      value={form.price || ""}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                      className="w-full rounded-xl border border-primary/40 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-extrabold text-foreground"
                    />
                    {role === "admin" && form.price > 0 && form.cost > 0 && (
                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-muted-foreground">Marge détail :</span>
                        <span className="font-bold text-emerald-600">
                          +{formatPrice(form.price - form.cost)} ({Math.round(((form.price - form.cost) / form.price) * 100)}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prix de vente en gros du carton/bidon */}
                  {purchaseMode === "wholesale" && wholesaleName ? (
                    <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5 shadow-xs">
                      <label className="text-xs font-bold text-foreground block">
                        📦 Vente en GROS par <span className="text-amber-600 dark:text-amber-400 font-extrabold">{wholesaleName}</span> (FCFA)
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 22500"
                        value={wholesaleSellingPrice}
                        onChange={(e) => setWholesaleSellingPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="w-full rounded-xl border border-amber-500/40 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-extrabold text-foreground"
                      />
                      {role === "admin" && wholesaleSellingPrice && wholesalePurchaseCost && (
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="text-muted-foreground">Marge gros :</span>
                          <span className="font-bold text-amber-600">
                            +{formatPrice(Number(wholesaleSellingPrice) - Number(wholesalePurchaseCost))} ({Math.round(((Number(wholesaleSellingPrice) - Number(wholesalePurchaseCost)) / Number(wholesaleSellingPrice)) * 100)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-secondary/20 border border-dashed border-border/60 flex flex-col justify-center items-center text-center">
                      <span className="text-xs font-medium text-muted-foreground">Aucun format gros principal</span>
                      <span className="text-[10px] text-muted-foreground/70">Passez en mode "Achat en Gros" ci-dessus pour configurer un carton.</span>
                    </div>
                  )}
                </div>

                {/* Formats de vente supplémentaires libres (ex: Demi-litre, Quart, Pack de 6, etc.) */}
                {isMultiUnitsEnabled && (
                  <div className="pt-3 border-t border-border/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          Autres conditionnements & fractions libres
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Exemple : Demi-litre (0.5 L à 550 FCFA), Quart de litre, Pack intermédiaire...
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormUnits([...formUnits, { name: "", multiplier: 1, price: "", cost: "", barcode: "" }])}
                        className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Ajouter un format
                      </button>
                    </div>

                    {formUnits.length > 0 && (
                      <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                        {formUnits.map((u, idx) => {
                          const mult = Number(u.multiplier) || 1;
                          const autoSaleProrata = form.price && mult ? Number(form.price) * mult : 0;
                          const autoCostProrata = form.cost && mult ? Number(form.cost) * mult : 0;
                          const effectivePrice = (u.price !== "" && u.price !== undefined && u.price !== null && Number(u.price) > 0)
                            ? Number(u.price)
                            : autoSaleProrata;
                          const effectiveCost = (u.cost !== "" && u.cost !== undefined && u.cost !== null && Number(u.cost) > 0)
                            ? Number(u.cost)
                            : autoCostProrata;

                          return (
                            <div key={idx} className="p-2.5 rounded-xl bg-card border border-border/60 text-xs space-y-2 shadow-xs">
                              <div className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-12 sm:col-span-4">
                                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Nom du format</label>
                                  <input
                                    type="text"
                                    placeholder="Ex: Demi-litre, Pack de 6"
                                    value={u.name}
                                    onChange={(e) => {
                                      const next = [...formUnits];
                                      next[idx].name = e.target.value;
                                      setFormUnits(next);
                                    }}
                                    className="w-full bg-secondary/30 border border-border/60 rounded-lg px-2 py-1 text-xs font-medium"
                                  />
                                </div>
                                <div className="col-span-4 sm:col-span-2">
                                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Contenance ({form.unit || 'u'})</label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.001"
                                    placeholder="0.5"
                                    value={u.multiplier || ""}
                                    onChange={(e) => {
                                      const next = [...formUnits];
                                      next[idx].multiplier = Number(e.target.value);
                                      setFormUnits(next);
                                    }}
                                    className="w-full bg-secondary/30 border border-border/60 rounded-lg px-2 py-1 text-xs font-bold text-center text-primary"
                                  />
                                </div>
                                <div className="col-span-4 sm:col-span-3">
                                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Prix de vente libre (FCFA)</label>
                                  <input
                                    type="number"
                                    placeholder="Ex: 550"
                                    value={u.price || ""}
                                    onChange={(e) => {
                                      const next = [...formUnits];
                                      next[idx].price = e.target.value;
                                      setFormUnits(next);
                                    }}
                                    className="w-full bg-secondary/30 border border-border/60 rounded-lg px-2 py-1 text-xs font-bold"
                                  />
                                </div>
                                <div className="col-span-3 sm:col-span-2">
                                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Code-barres</label>
                                  <input
                                    type="text"
                                    placeholder="Optionnel"
                                    value={u.barcode || ""}
                                    onChange={(e) => {
                                      const next = [...formUnits];
                                      next[idx].barcode = e.target.value;
                                      setFormUnits(next);
                                    }}
                                    className="w-full bg-secondary/30 border border-border/60 rounded-lg px-2 py-1 text-[11px] font-mono"
                                  />
                                </div>
                                <div className="col-span-1 flex justify-center pt-3">
                                  <button
                                    type="button"
                                    onClick={() => setFormUnits(formUnits.filter((_, i) => i !== idx))}
                                    className="text-destructive/70 hover:text-destructive p-1 rounded-lg hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section Traçabilité & Date de Péremption (DLC / Lots) */}
              <div className="border border-border/60 rounded-xl p-3.5 bg-secondary/15 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    Date de Péremption & N° de Lot (Optionnel)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Alertes automatiques progressives à 3 mois (90j), 2 mois (60j), 1 mois (30j), 1 semaine et derniers jours.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                      Date Limite (DLC / DLUO)
                    </label>
                    <input
                      type="date"
                      value={initialBatch.expiryDate}
                      onChange={(e) => setInitialBatch({ ...initialBatch, expiryDate: e.target.value })}
                      className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                      N° de Lot (Batch)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: LOT-2026-01 (auto si vide)"
                      value={initialBatch.batchNumber}
                      onChange={(e) => setInitialBatch({ ...initialBatch, batchNumber: e.target.value })}
                      className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

                            {/* Preview */}
              {form.name && (
                <div className="rounded-xl bg-secondary/30 p-3 flex items-center gap-3">
                  <ProductAvatar name={form.name} size="md" />
                  <div>
                    <p className="text-sm font-medium">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.sku} • {formatPrice(form.price)}</p>
                    {role === 'admin' && form.price > 0 && form.cost > 0 && (
                      <p className="text-[10px] text-accent">Marge: {Math.round(((form.price - form.cost) / form.price) * 100)}%</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-border/60 py-2.5 text-sm font-medium hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={!form.name.trim()} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="h-4 w-4" />
                {editProduct ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ProductExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowCategoryModal(false)}>
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Nouvelle catégorie</h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Icône</label>
                <div className="flex gap-2 flex-wrap">
                  {emojiOptions.slice(0, 10).map((e) => (
                    <button
                      key={e}
                      onClick={() => setCategoryForm({ ...categoryForm, icon: e })}
                      className={`text-2xl p-1.5 rounded-lg transition-all ${categoryForm.icon === e ? "bg-primary/10 ring-2 ring-primary scale-110" : "hover:bg-secondary"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom de la catégorie *</label>
                <input
                  type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Électronique"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Couleur d&apos;accentuation</label>
                <input
                  type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="h-10 w-full rounded-xl border border-border/60 bg-secondary/30 p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCategoryModal(false)} className="flex-1 rounded-xl border border-border/60 py-2.5 text-sm font-medium hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button 
                onClick={handleSaveCategory} 
                disabled={!categoryForm.name}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Traçabilité & Gestion des Lots */}
      {selectedProductForBatches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setSelectedProductForBatches(null)}>
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in overflow-hidden border border-border/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/50 bg-secondary/10">
              <div className="flex items-center gap-3">
                <ProductAvatar name={selectedProductForBatches.name} size="md" />
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <span>Lots &amp; Traçabilité</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">{selectedProductForBatches.sku}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{selectedProductForBatches.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProductForBatches(null)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5 no-scrollbar">
              {/* Formulaire d'ajout rapide d'un lot */}
              {role === "admin" && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Enregistrer un nouveau lot en rayon
                  </h3>
                  {(() => {
                    const batchUnit = selectedUnitForBatchId === "ref"
                      ? undefined
                      : selectedProductForBatches.units?.find((u) => u.id === selectedUnitForBatchId);
                    const batchMult = batchUnit ? batchUnit.multiplier : 1;
                    const totalBaseUnits = Math.round(newBatchForm.quantity * batchMult * 1000) / 1000;

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-4">
                            <label className="text-xs text-muted-foreground block mb-1 font-medium">N° de Lot (Traçabilité) *</label>
                            <input
                              type="text"
                              placeholder="Ex: LOT-2026-A"
                              value={newBatchForm.batchNumber}
                              onChange={(e) => setNewBatchForm({ ...newBatchForm, batchNumber: e.target.value })}
                              className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="text-xs text-muted-foreground block mb-1 font-medium">Date de Péremption *</label>
                            <input
                              type="date"
                              value={newBatchForm.expiryDate}
                              onChange={(e) => setNewBatchForm({ ...newBatchForm, expiryDate: e.target.value })}
                              className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>

                          {selectedProductForBatches.units && selectedProductForBatches.units.length > 0 && (
                            <div className="sm:col-span-3">
                              <label className="text-xs text-muted-foreground block mb-1 font-medium">Conditionnement reçu</label>
                              <select
                                value={selectedUnitForBatchId}
                                onChange={(e) => setSelectedUnitForBatchId(e.target.value)}
                                className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                              >
                                <option value="ref">Unité de base ({selectedProductForBatches.unit || "Pièce"}) (x1)</option>
                                {selectedProductForBatches.units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} (x{u.multiplier} {selectedProductForBatches.unit || 'unités'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className={selectedProductForBatches.units && selectedProductForBatches.units.length > 0 ? "sm:col-span-2" : "sm:col-span-5"}>
                            <label className="text-xs text-muted-foreground block mb-1 font-medium">
                              Qté {batchUnit ? `(${batchUnit.name})` : `(${selectedProductForBatches.unit || 'Unités'})`} *
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={newBatchForm.quantity}
                              onChange={(e) => setNewBatchForm({ ...newBatchForm, quantity: Math.max(0.01, Number(e.target.value)) })}
                              className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-primary"
                            />
                          </div>
                        </div>

                        {batchMult > 1 && (
                          <div className="text-[11px] bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-lg flex items-center justify-between">
                            <span>
                              📦 Réception en gros : <b>{newBatchForm.quantity} {batchUnit?.name}</b> = <b>{totalBaseUnits} {selectedProductForBatches.unit || 'unités'}</b> en stock.
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={batchSyncProductStock}
                              onChange={(e) => setBatchSyncProductStock(e.target.checked)}
                              className="rounded border-border text-primary focus:ring-primary/20"
                            />
                            <span>Ajouter automatiquement cette quantité au stock global de l&apos;article (+{totalBaseUnits})</span>
                          </label>

                          <button
                            type="button"
                            disabled={isAddingBatch || !newBatchForm.batchNumber.trim() || !newBatchForm.expiryDate}
                            onClick={async () => {
                              setIsAddingBatch(true);
                              try {
                                const newB: ProductBatch = {
                                  id: "batch_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
                                  storeId: activeStore?.id || "",
                                  productId: selectedProductForBatches.id,
                                  batchNumber: newBatchForm.batchNumber.trim(),
                                  expiryDate: newBatchForm.expiryDate,
                                  initialQuantity: totalBaseUnits,
                                  currentQuantity: totalBaseUnits,
                                  createdAt: new Date().toISOString()
                                };
                                dispatch({ type: "ADD_BATCH", payload: newB });
                                if (batchSyncProductStock) {
                                  dispatch({
                                    type: "UPDATE_PRODUCT",
                                    payload: {
                                      ...selectedProductForBatches,
                                      stock: Number(selectedProductForBatches.stock) + totalBaseUnits,
                                    }
                                  });
                                }
                                setNewBatchForm({ batchNumber: "", expiryDate: "", quantity: 1 });
                                setSelectedUnitForBatchId("ref");
                              } finally {
                                setIsAddingBatch(false);
                              }
                            }}
                            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm ml-auto"
                          >
                            <Check className="h-3.5 w-3.5" /> Enregistrer ce lot ({totalBaseUnits} {selectedProductForBatches.unit || 'u'})
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Liste des lots existants pour ce produit */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Lots enregistrés pour cet article</h3>
                {(() => {
                  const batches = (state.batches || []).filter(b => b.productId === selectedProductForBatches.id);
                  if (batches.length === 0) {
                    return (
                      <div className="py-8 text-center text-muted-foreground text-xs bg-secondary/20 rounded-xl border border-border/40">
                        Aucun lot enregistré pour le moment. Vous pouvez enregistrer un lot ci-dessus ou lors de la réception d&apos;une commande fournisseur.
                      </div>
                    );
                  }
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);

                  return batches.map((b) => {
                    const exp = new Date(b.expiryDate);
                    exp.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = diffDays < 0;
                    const isSoon = diffDays >= 0 && diffDays <= 30;

                    return (
                      <div key={b.id} className="p-3.5 rounded-xl border border-border/50 bg-secondary/10 flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-foreground">{b.batchNumber}</span>
                            {isExpired ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600/10 text-red-600 border border-red-500/30">
                                🚨 Périmé
                              </span>
                            ) : isSoon ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                                ⚠️ Expire dans {diffDays}j
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                ✓ Valide
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span>DLC: <strong>{new Date(b.expiryDate).toLocaleDateString("fr-FR")}</strong></span>
                            <span>Initial: {b.initialQuantity}</span>
                            <span>Restant: <strong className="text-foreground">{b.currentQuantity}</strong></span>
                          </div>
                        </div>

                        {role === "admin" && (
                          <button
                            onClick={() => {
                              if (confirm("Supprimer ce lot de traçabilité ?")) {
                                dispatch({ type: "DELETE_BATCH", payload: b.id });
                              }
                            }}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                            title="Supprimer ce lot"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="p-4 border-t border-border/50 bg-secondary/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProductForBatches(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-secondary/80 text-foreground"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Modal Historique des Fluctuations de Prix */}
      {selectedProductForPriceHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setSelectedProductForPriceHistory(null)}>
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in overflow-hidden border border-border/50" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/50 bg-secondary/10">
              <div className="flex items-center gap-3">
                <ProductAvatar name={selectedProductForPriceHistory.name} size="md" />
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    Historique des Fluctuations de Prix
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">{selectedProductForPriceHistory.sku}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{selectedProductForPriceHistory.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProductForPriceHistory(null)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5 no-scrollbar">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Prix de Vente Actuel</p>
                  <p className="text-lg font-bold text-foreground mt-1">{formatPrice(selectedProductForPriceHistory.price)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tarif public en caisse</p>
                </div>

                {role === "admin" && (
                  <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Coût d'Achat Actuel</p>
                    <p className="text-lg font-bold text-foreground mt-1">{formatPrice(selectedProductForPriceHistory.cost)}</p>
                    <p className="text-[10px] text-accent font-medium mt-0.5">
                      Marge : {selectedProductForPriceHistory.price > 0 ? Math.round(((selectedProductForPriceHistory.price - selectedProductForPriceHistory.cost) / selectedProductForPriceHistory.price) * 100) : 0}%
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Révisions Journalisées</p>
                  <p className="text-lg font-bold text-primary mt-1">
                    {(state.priceHistory || []).filter(h => h.productId === selectedProductForPriceHistory.id).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Évolution au fil du temps</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/50 gap-2">
                <button
                  type="button"
                  onClick={() => setPriceHistoryTab("all")}
                  className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                    priceHistoryTab === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Toutes les variations
                </button>
                <button
                  type="button"
                  onClick={() => setPriceHistoryTab("selling")}
                  className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                    priceHistoryTab === "selling" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Prix de vente
                </button>
                {role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setPriceHistoryTab("cost")}
                    className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      priceHistoryTab === "cost" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Coût d'achat fournisseur
                  </button>
                )}
              </div>

              {/* Timeline List */}
              <div className="space-y-3">
                {(() => {
                  const items = (state.priceHistory || [])
                    .filter(h => h.productId === selectedProductForPriceHistory.id)
                    .filter(h => {
                      if (priceHistoryTab === "selling") return h.priceType === "selling" || h.priceType === "unit_selling";
                      if (priceHistoryTab === "cost") return h.priceType === "cost";
                      return true;
                    })
                    .filter(h => role === "admin" || h.priceType !== "cost")
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                  if (items.length === 0) {
                    return (
                      <div className="text-center py-10 rounded-xl border border-dashed border-border/60 p-6">
                        <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-foreground">Aucune variation enregistrée</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          Les modifications futures apportées au prix de vente ou au coût d'achat (via le catalogue ou les réceptions de commandes) apparaîtront automatiquement ici.
                        </p>
                      </div>
                    );
                  }

                  return items.map((item) => {
                    const diff = item.newPrice - item.oldPrice;
                    const pct = item.oldPrice > 0 ? ((diff / item.oldPrice) * 100).toFixed(1) : "0";
                    const isSelling = item.priceType === "selling" || item.priceType === "unit_selling";
                    const isIncrease = diff > 0;

                    // Badges colors
                    let badgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                    let typeLabel = "Prix de vente";
                    if (item.priceType === "cost") {
                      badgeClass = "bg-purple-500/10 text-purple-600 border-purple-500/20";
                      typeLabel = "Coût d'achat";
                    } else if (item.priceType === "unit_selling") {
                      badgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                      typeLabel = "Unité : " + (item.unitName || "Secondaire");
                    }

                    // Diff badge color
                    let diffBadgeClass = "bg-muted text-muted-foreground";
                    if (isSelling) {
                      diffBadgeClass = isIncrease ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600";
                    } else {
                      // Pour un coût d'achat, une hausse est un surcoût (amber/rose) et une baisse est une économie (emerald)
                      diffBadgeClass = isIncrease ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600";
                    }

                    return (
                      <div key={item.id} className="p-3.5 rounded-xl border border-border/60 bg-card hover:bg-secondary/10 transition-colors space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                              {typeLabel}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            Par <span className="font-medium text-foreground">{item.userName || "Admin"}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-muted-foreground line-through">
                              {formatPrice(item.oldPrice)}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-bold text-foreground">
                              {formatPrice(item.newPrice)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 ${diffBadgeClass}`}>
                              {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isIncrease ? "+" : ""}{formatPrice(diff)} ({isIncrease ? "+" : ""}{pct}%)
                            </span>
                          </div>
                        </div>

                        {item.changeReason && (
                          <p className="text-[11px] text-muted-foreground/80 italic pt-0.5 border-t border-border/30">
                            Motif : {item.changeReason}
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/50 bg-secondary/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProductForPriceHistory(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-secondary/80 text-foreground"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
