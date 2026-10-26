"use client";

import React, { useState, useMemo } from "react";
import { useStore, Product, ProductUnit } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { resolveModuleStatus } from "@/types/modules";
import { ProductAvatar } from "@/components/ui/ProductAvatar";
import { exportInventoryValuation } from "@/lib/accountingExport";
import { FileSpreadsheet, Download, Upload } from "lucide-react";
import ProductExcelImportModal from "@/components/products/ProductExcelImportModal";
import {
  Package,
  Plus,
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
  Check
} from "lucide-react";
import { ProductBatch, PriceHistoryEntry } from "@/context/StoreContext";
import { TrendingUp, TrendingDown, History, ArrowRight, DollarSign } from "lucide-react";

export default function ProductsPage() {
  const { role, activeStore, tier, isModuleActive } = useAuth();
  const { state, dispatch, formatPrice } = useStore();
  const isMultiUnitsEnabled = useMemo(() => {
    if (role === 'admin') return true;
    if (!activeStore) return true;
    return isModuleActive ? isModuleActive('multi_units') : true;
  }, [activeStore, isModuleActive, role]);

  const [formUnits, setFormUnits] = useState<{ id?: string; name: string; multiplier: number; price: string | number; barcode: string }[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "ok">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Product Import Modal
  const [showImportModal, setShowImportModal] = useState(false);

  // Product Modal
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const emptyForm = { name: "", sku: "", category: "Vêtements", price: 0, cost: 0, stock: 0, minStock: 5, image: "📦" };
  const [form, setForm] = useState(emptyForm);
  const [initialBatch, setInitialBatch] = useState<{ batchNumber: string; expiryDate: string }>({ batchNumber: '', expiryDate: '' });
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "soon">("all");
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
          } else if (expiryFilter === "soon") {
            matchExpiry = diffDays >= 0 && diffDays <= 30;
          }
        }
      }

      return matchSearch && matchCategory && matchStock && matchExpiry;
    });
  }, [state.products, state.batches, search, categoryFilter, stockFilter, expiryFilter]);

  const openCreate = () => {
    setEditProduct(null);
    setForm({ ...emptyForm, category: state.categories[0]?.name || "Divers" });
    setFormUnits([]);
    setInitialBatch({ batchNumber: '', expiryDate: '' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: p.price,
      cost: role === "admin" ? p.cost : 0,
      stock: p.stock,
      minStock: p.minStock,
      image: p.image
    });
    setFormUnits(
      (p.units || []).map((u) => ({
        id: u.id,
        name: u.name,
        multiplier: u.multiplier,
        price: u.price !== null && u.price !== undefined ? u.price : "",
        barcode: u.barcode || "",
      }))
    );
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
    const costToSave = role === "admin" ? (Number(form.cost) || 0) : 0;

    const parsedUnits: ProductUnit[] = formUnits
      .filter((u) => u.name.trim().length > 0 && Number(u.multiplier) > 0)
      .map((u) => ({
        id: u.id || ("pu_" + Math.random().toString(36).substring(7)),
        storeId: activeStore?.id || "",
        productId: editProduct ? editProduct.id : "",
        name: u.name.trim(),
        multiplier: Number(u.multiplier),
        price: (u.price !== "" && u.price !== null && u.price !== undefined && Number(u.price) > 0) ? Number(u.price) : null,
        barcode: u.barcode.trim() || null,
        isReference: false,
      }));

    const newProdId = "p" + Date.now();
    if (editProduct) {
      parsedUnits.forEach((u) => (u.productId = editProduct.id));
      dispatch({ type: "UPDATE_PRODUCT", payload: { ...editProduct, ...form, cost: costToSave, sku: finalSku, units: parsedUnits } });
    } else {
      parsedUnits.forEach((u) => (u.productId = newProdId));
      const newProduct: Product = {
        id: newProdId,
        ...form,
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
            onChange={(e) => setExpiryFilter(e.target.value as "all" | "expired" | "soon")}
            className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Toutes dates</option>
            <option value="expired">🚨 Produits périmés</option>
            <option value="soon">⚠️ Expire &lt; 30j</option>
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
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400">
                          <Layers className="h-2.5 w-2.5" /> {p.units.length + 1} formats ({p.units.map((u) => u.name).join(', ')})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-primary">{formatPrice(p.price)}</p>
                    {role === "admin" && <p className="text-[10px] text-muted-foreground">Coût: {formatPrice(p.cost)}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${p.stock <= p.minStock ? "text-destructive" : "text-foreground"}`}>
                      {p.stock}
                    </p>
                    <p className="text-[10px] text-muted-foreground">en stock</p>
                  </div>
                </div>

                                {/* Badges de Péremption & Lots */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const prodBatches = (state.batches || [])
                      .filter((b) => b.productId === p.id && b.currentQuantity > 0)
                      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

                    if (prodBatches.length === 0) return null;

                    const nearest = prodBatches[0];
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const exp = new Date(nearest.expiryDate);
                    exp.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) {
                      return (
                        <span className="rounded-full bg-red-600/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-600 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="h-2.5 w-2.5" /> Périmé ({nearest.batchNumber})
                        </span>
                      );
                    }
                    if (diffDays <= 30) {
                      return (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> Périme dans {diffDays}j
                        </span>
                      );
                    }
                    return (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                        DLC: {new Date(nearest.expiryDate).toLocaleDateString("fr-FR")}
                      </span>
                    );
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
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatPrice(p.price)}</td>
                  {role === "admin" && <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatPrice(p.cost)}</td>}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold ${p.stock < 0 ? "text-red-600 font-bold" : p.stock <= p.minStock ? "text-destructive" : ""}`}>
                      {p.stock}
                    </span>
                    {(() => {
                      const prodBatches = (state.batches || [])
                        .filter((b) => b.productId === p.id && b.currentQuantity > 0)
                        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                      if (prodBatches.length === 0) return null;
                      const nearest = prodBatches[0];
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      const exp = new Date(nearest.expiryDate);
                      exp.setHours(0, 0, 0, 0);
                      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <div className="mt-0.5 flex justify-end">
                          {diffDays < 0 ? (
                            <span className="text-[9px] text-red-600 font-bold">Périmé ({nearest.batchNumber})</span>
                          ) : diffDays <= 30 ? (
                            <span className="text-[9px] text-amber-600 font-bold">Expire dans {diffDays}j</span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">DLC: {new Date(nearest.expiryDate).toLocaleDateString("fr-FR")}</span>
                          )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Prix de vente (FCFA)</label>
                  <input
                    type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {role === 'admin' && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Coût d&apos;achat (FCFA)</label>
                    <input
                      type="number" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                      className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock initial</label>
                  <input
                    type="number" step="any" min="0" value={form.stock !== undefined ? form.stock : ""} onChange={(e) => setForm({ ...form, stock: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock minimum</label>
                  <input
                    type="number" step="any" min="0" value={form.minStock !== undefined ? form.minStock : ""} onChange={(e) => setForm({ ...form, minStock: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Section Unités & Conditionnements Multiples */}
              {isMultiUnitsEnabled && (
                <div className="border border-border/60 rounded-xl p-3.5 bg-secondary/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        Conditionnements & Unités Multiples
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Vendez au carton, pack ou demi-portion tout en décomptant le stock unitaire de base.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormUnits([...formUnits, { name: "", multiplier: 1, price: "", barcode: "" }])}
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Ajouter
                    </button>
                  </div>

                  {formUnits.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic py-1">
                      Aucun conditionnement secondaire (vendu uniquement à l'unité de base).
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {formUnits.map((u, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-card p-2 rounded-lg border border-border/50 text-xs">
                          <div className="col-span-4">
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Nom</label>
                            <input
                              type="text"
                              placeholder="Ex: Carton (24)"
                              value={u.name}
                              onChange={(e) => {
                                const next = [...formUnits];
                                next[idx].name = e.target.value;
                                setFormUnits(next);
                              }}
                              className="w-full bg-secondary/30 border border-border/50 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Coeff.</label>
                            <input
                              type="number"
                              placeholder="24"
                              min="0.001"
                              step="any"
                              value={u.multiplier || ""}
                              onChange={(e) => {
                                const next = [...formUnits];
                                next[idx].multiplier = Number(e.target.value);
                                setFormUnits(next);
                              }}
                              className="w-full bg-secondary/30 border border-border/50 rounded px-1.5 py-1 text-xs text-center font-medium"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Prix (Optionnel)</label>
                            <input
                              type="number"
                              placeholder={form.price && u.multiplier ? String(form.price * u.multiplier) : "Prorata"}
                              value={u.price || ""}
                              onChange={(e) => {
                                const next = [...formUnits];
                                next[idx].price = e.target.value;
                                setFormUnits(next);
                              }}
                              className="w-full bg-secondary/30 border border-border/50 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Code-barres</label>
                            <input
                              type="text"
                              placeholder="Optionnel"
                              value={u.barcode || ""}
                              onChange={(e) => {
                                const next = [...formUnits];
                                next[idx].barcode = e.target.value;
                                setFormUnits(next);
                              }}
                              className="w-full bg-secondary/30 border border-border/50 rounded px-1.5 py-1 text-[11px]"
                            />
                          </div>
                          <div className="col-span-1 flex justify-center pt-3">
                            <button
                              type="button"
                              onClick={() => setFormUnits(formUnits.filter((_, i) => i !== idx))}
                              className="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section Traçabilité & Date de Péremption (DLC / Lots) */}
              <div className="border border-border/60 rounded-xl p-3.5 bg-secondary/15 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    Date de Péremption & N° de Lot (Optionnel)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Idéal pour épicerie, boissons, parapharmacie, cosmétique et articles périssables.
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1 font-medium">N° de Lot *</label>
                      <input
                        type="text"
                        placeholder="Ex: LOT-2026-A"
                        value={newBatchForm.batchNumber}
                        onChange={(e) => setNewBatchForm({ ...newBatchForm, batchNumber: e.target.value })}
                        className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1 font-medium">Date de Péremption *</label>
                      <input
                        type="date"
                        value={newBatchForm.expiryDate}
                        onChange={(e) => setNewBatchForm({ ...newBatchForm, expiryDate: e.target.value })}
                        className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1 font-medium">Quantité d&apos;unités *</label>
                      <input
                        type="number"
                        min="1"
                        value={newBatchForm.quantity}
                        onChange={(e) => setNewBatchForm({ ...newBatchForm, quantity: Math.max(1, Number(e.target.value)) })}
                        className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
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
                            initialQuantity: newBatchForm.quantity,
                            currentQuantity: newBatchForm.quantity,
                            createdAt: new Date().toISOString()
                          };
                          dispatch({ type: "ADD_BATCH", payload: newB });
                          setNewBatchForm({ batchNumber: "", expiryDate: "", quantity: 1 });
                        } finally {
                          setIsAddingBatch(false);
                        }
                      }}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="h-3.5 w-3.5" /> Enregistrer ce lot
                    </button>
                  </div>
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
