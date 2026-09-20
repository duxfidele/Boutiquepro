"use client";

import React, { useState, useMemo } from "react";
import { useStore, Product } from "@/context/StoreContext";
import { ProductAvatar } from "@/components/ui/ProductAvatar";
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
} from "lucide-react";

export default function ProductsPage() {
  const { state, dispatch, formatPrice } = useStore();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "ok">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Product Modal
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const emptyForm = { name: "", sku: "", category: "Vêtements", price: 0, cost: 0, stock: 0, minStock: 5, image: "📦" };
  const [form, setForm] = useState(emptyForm);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", icon: "📦", color: "#6343EA" });

  const filtered = useMemo(() => {
    return state.products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "Tous" || p.category === categoryFilter;
      const matchStock = stockFilter === "all" || (stockFilter === "low" ? p.stock <= p.minStock : p.stock > p.minStock);
      return matchSearch && matchCategory && matchStock;
    });
  }, [state.products, search, categoryFilter, stockFilter]);

  const openCreate = () => {
    setEditProduct(null);
    setForm({ ...emptyForm, category: state.categories[0]?.name || "Divers" });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, category: p.category, price: p.price, cost: p.cost, stock: p.stock, minStock: p.minStock, image: p.image });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name) return;
    
    const finalSku = form.sku.trim() || (form.name.substring(0, 3).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000));

    if (editProduct) {
      dispatch({ type: "UPDATE_PRODUCT", payload: { ...editProduct, ...form, sku: finalSku } });
    } else {
      const newProduct: Product = {
        id: "p" + Date.now(),
        ...form,
        sku: finalSku,
        createdAt: new Date().toISOString().split("T")[0],
      };
      dispatch({ type: "ADD_PRODUCT", payload: newProduct });
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
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouveau produit
        </button>
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
              <button 
                onClick={(e) => handleDeleteCategory(e, cat.id)} 
                className="hidden group-hover:flex absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 z-10 shadow-sm hover:scale-110 transition-transform"
                title="Supprimer la catégorie"
              >
                 <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowCategoryModal(true)}
            className="whitespace-nowrap rounded-full border border-dashed border-primary/50 px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-all flex items-center gap-1 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Catégorie
          </button>
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
              {p.stock <= p.minStock && (
                <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-bold text-white badge-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  Stock bas
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.sku} • {p.category}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-primary">{formatPrice(p.price)}</p>
                    <p className="text-[10px] text-muted-foreground">Coût: {formatPrice(p.cost)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${p.stock <= p.minStock ? "text-destructive" : "text-foreground"}`}>
                      {p.stock}
                    </p>
                    <p className="text-[10px] text-muted-foreground">en stock</p>
                  </div>
                </div>

                {/* Margin badge */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    Marge: {p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%
                  </span>
                </div>

                {/* Actions (visible on hover) */}
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
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Coût</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Marge</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
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
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatPrice(p.cost)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold ${p.stock <= p.minStock ? "text-destructive" : ""}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-accent font-medium">{p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                        <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Aucun produit trouvé</p>
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
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Coût d'achat (FCFA)</label>
                  <input
                    type="number" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock initial</label>
                  <input
                    type="number" value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock minimum</label>
                  <input
                    type="number" value={form.minStock || ""} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Preview */}
              {form.name && (
                <div className="rounded-xl bg-secondary/30 p-3 flex items-center gap-3">
                  <ProductAvatar name={form.name} size="md" />
                  <div>
                    <p className="text-sm font-medium">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.sku} • {formatPrice(form.price)}</p>
                    {form.price > 0 && form.cost > 0 && (
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
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Couleur d'accentuation</label>
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
    </div>
  );
}
