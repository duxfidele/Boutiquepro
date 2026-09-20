"use client";

import React, { useState, useMemo } from "react";
import { useStore, Order, Product } from "@/context/StoreContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Truck,
  Plus,
  Search,
  Check,
  X,
  Package,
  Calendar,
  AlertTriangle,
  Clock,
  Trash2,
  Download,
  Sparkles
} from "lucide-react";
import { ProductAvatar } from "@/components/ui/ProductAvatar";

export default function OrdersPage() {
  const { state, dispatch, formatPrice, lowStockProducts } = useStore();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "received">("all");

  const [form, setForm] = useState({
    supplierName: "",
    expectedAt: "",
    items: [] as { product: Product; quantity: number; costPrice: number }[]
  });
  const [searchProduct, setSearchProduct] = useState("");

  const filteredOrders = useMemo(() => {
    return state.orders.filter(o => {
      const matchSearch = o.supplierName.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [state.orders, search, statusFilter]);

  const filteredProducts = useMemo(() => {
    if (!searchProduct) return [];
    return state.products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()) || p.sku.toLowerCase().includes(searchProduct.toLowerCase()));
  }, [state.products, searchProduct]);

  const handleAddProduct = (product: Product) => {
    setSearchProduct("");
    if (form.items.find(i => i.product.id === product.id)) return;
    setForm({
      ...form,
      items: [...form.items, { product, quantity: 1, costPrice: product.cost }]
    });
  };

  const handleUpdateItem = (productId: string, field: "quantity" | "costPrice", value: number) => {
    setForm({
      ...form,
      items: form.items.map(i => i.product.id === productId ? { ...i, [field]: value } : i)
    });
  };

  const handleRemoveItem = (productId: string) => {
    setForm({ ...form, items: form.items.filter(i => i.product.id !== productId) });
  };

  const handleSaveOrder = () => {
    if (form.items.length === 0) return;

    const totalCost = form.items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);

    const newOrder: Order = {
      id: "CMD-" + Date.now().toString().slice(-6),
      supplierName: form.supplierName || "Fournisseur divers",
      items: form.items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        costPrice: i.costPrice,
        total: i.quantity * i.costPrice
      })),
      totalCost,
      status: "pending",
      createdAt: new Date().toISOString(),
      expectedAt: form.expectedAt || undefined
    };

    dispatch({ type: "ADD_ORDER", payload: newOrder });
    setShowModal(false);
    setForm({ supplierName: "", expectedAt: "", items: [] });
  };

  const handleDownloadGlobalPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(state.settings.name, 14, 22);
    doc.setFontSize(14);
    doc.text("Liste de tous les produits commandés", 14, 30);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le : ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 14, 36);

    const tableData: any[][] = [];
    let grandTotal = 0;

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        tableData.push([
          item.productName,
          item.quantity.toString(),
          formatPrice(item.costPrice).replace(/[  ]/g, " "),
          formatPrice(item.total).replace(/[  ]/g, " ")
        ]);
        grandTotal += item.total;
      });
    });

    autoTable(doc, {
      startY: 45,
      head: [["Produit", "Quantité", "Coût Unitaire", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [99, 67, 234] },
      margin: { top: 40 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GLOBAL : ${formatPrice(grandTotal).replace(/[  ]/g, " ")}`, 14, finalY + 10);

    doc.save("Liste_Produits_Commandes.pdf");
  };

  const handleDeleteOrder = (orderId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.")) {
      dispatch({ type: "DELETE_ORDER", payload: orderId });
    }
  };


  const handleSmartSuggestion = () => {
    if (lowStockProducts.length === 0) {
      alert("Vos stocks sont suffisants ! Aucune suggestion de réapprovisionnement pour le moment.");
      return;
    }
    
    const suggestedItems = lowStockProducts.map(p => {
      // Suggère une quantité pour atteindre au moins le double du stock minimum, avec un minimum absolu de 5 unités
      const targetStock = Math.max(p.minStock * 3, 10);
      const suggestedQty = Math.max(targetStock - p.stock, 5);
      
      return { product: p, quantity: suggestedQty, costPrice: p.cost };
    });

    setForm({
      supplierName: "Fournisseur Principal (Auto)",
      expectedAt: "",
      items: suggestedItems
    });
    setShowModal(true);
  };

  const handleReceiveOrder = (orderId: string) => {
    if (confirm("Confirmez-vous la réception de cette commande ? Les stocks seront automatiquement mis à jour.")) {
      dispatch({ type: "UPDATE_ORDER_STATUS", payload: { orderId, status: "received" } });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commandes Fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez vos réapprovisionnements.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSmartSuggestion}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-white px-4 py-2 text-sm font-bold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Suggestion intelligente
          </button>
          <button
            onClick={handleDownloadGlobalPDF}
            className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary/80 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Exporter la liste
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm glow-primary"
          >
            <Plus className="h-4 w-4" />
            Nouvelle commande
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-2xl border border-border/40 bg-card p-2 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-transparent py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex w-full sm:w-auto p-1 bg-secondary/50 rounded-xl">
          {(["all", "pending", "received"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${statusFilter === status ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {status === "all" ? "Toutes" : status === "pending" ? "En attente" : "Reçues"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.map(order => (
          <div key={order.id} className="flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden hover-lift">
            <div className="flex items-start justify-between p-5 border-b border-border/40 bg-secondary/10">
              <div className="flex-1">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-bold text-foreground truncate">{order.supplierName}</h3>
                  <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors ml-2" title="Supprimer la commande">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Réf: {order.id}</p>
              </div>
            </div>
            <div className="px-5 pt-3 flex justify-end">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === "received" ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600"}`}>
                {order.status === "received" ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {order.status === "received" ? "Reçue" : "En attente"}
              </span>
            </div>
            <div className="p-5 flex-1 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Date</span>
                <span className="font-medium">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
              {order.expectedAt && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Truck className="h-4 w-4" /> Livraison</span>
                  <span className="font-medium">{new Date(order.expectedAt).toLocaleDateString("fr-FR")}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm border-t border-border/40 pt-4">
                <span className="text-muted-foreground flex items-center gap-1.5"><Package className="h-4 w-4" /> Articles</span>
                <span className="font-bold">{order.items.reduce((acc, i) => acc + i.quantity, 0)} unités</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t border-border/40 pt-4 text-primary">
                <span>Total</span>
                <span>{formatPrice(order.totalCost)}</span>
              </div>
            </div>
            {order.status === "pending" && (
              <div className="p-4 bg-secondary/20">
                <button
                  onClick={() => handleReceiveOrder(order.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-500/10 text-green-600 px-4 py-2.5 text-base sm:text-sm font-bold hover:bg-green-500/20 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Marquer comme Reçue
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Truck className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-sm">Aucune commande trouvée.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-lg font-bold">Nouvelle commande fournisseur</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom du fournisseur (Optionnel)</label>
                  <input
                    type="text" value={form.supplierName} onChange={e => setForm({...form, supplierName: e.target.value})}
                    placeholder="Ex: Fournisseur Central"
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date de livraison prévue</label>
                  <input
                    type="date" value={form.expectedAt} onChange={e => setForm({...form, expectedAt: e.target.value})}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-base sm:text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ajouter un produit</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text" value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                    placeholder="Rechercher par nom ou SKU..."
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 pl-9 pr-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {searchProduct && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border/50 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-secondary flex justify-between items-center"
                      >
                        <span className="flex items-center gap-2"><ProductAvatar name={p.name} size="sm" className="w-6 h-6 text-[10px]" /> {p.name}</span>
                        <span className="text-xs text-muted-foreground">Stock actuel: {p.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.items.length > 0 && (
                <div className="space-y-3">
                  {form.items.map(item => (
                    <div key={item.product.id} className="p-4 border border-border/50 rounded-xl flex flex-col gap-3 bg-card shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-sm line-clamp-2">{item.product.name}</span>
                        <button onClick={() => handleRemoveItem(item.product.id)} className="p-2 hover:bg-destructive/10 bg-destructive/5 rounded-xl text-destructive shrink-0 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Quantité</label>
                          <input
                            type="number" min="1" value={item.quantity}
                            onChange={e => handleUpdateItem(item.product.id, "quantity", Number(e.target.value))}
                            className="w-full rounded-xl border border-border/60 px-3 py-2 text-base sm:text-sm focus:outline-none bg-secondary/30 focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Coût unitaire</label>
                          <input
                            type="number" min="0" value={item.costPrice}
                            onChange={e => handleUpdateItem(item.product.id, "costPrice", Number(e.target.value))}
                            className="w-full rounded-xl border border-border/60 px-3 py-2 text-base sm:text-sm focus:outline-none bg-secondary/30 focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-3 border-t border-border/40">
                        <span className="text-xs text-muted-foreground font-medium">Total ligne</span>
                        <span className="font-bold text-primary text-base whitespace-nowrap">{formatPrice(item.quantity * item.costPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-border/50 bg-secondary/10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Coût total estimé</p>
                <p className="text-xl font-bold text-primary">
                  {formatPrice(form.items.reduce((s, i) => s + (i.quantity * i.costPrice), 0))}
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                <button onClick={() => setShowModal(false)} className="w-full sm:w-auto px-5 py-2.5 text-base sm:text-sm font-medium rounded-xl hover:bg-secondary text-center">Annuler</button>
                <button
                  onClick={handleSaveOrder}
                  disabled={form.items.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-base sm:text-sm font-bold text-white bg-primary rounded-xl shadow-md glow-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-4 w-4" />
                  Valider la commande
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
