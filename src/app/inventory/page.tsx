"use client";

import React, { useState, useMemo } from "react";
import { useStore, InventorySession, InventoryItem } from "@/context/StoreContext";
import { ClipboardList, Plus, Search, Check, FileText, Printer, ArrowLeft, ArrowRight, Save, Trash2, Calendar, X } from "lucide-react";
import { ProductAvatar } from "@/components/ui/ProductAvatar";

export default function InventoryPage() {
  const { state, dispatch, formatPrice } = useStore();
  
  const [isDrafting, setIsDrafting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftItems, setDraftItems] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [selectedSession, setSelectedSession] = useState<InventorySession | null>(null);

  // Alphabetical sorting from the base products list
  const sortedProducts = useMemo(() => {
    return [...state.products].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products]);

  // Filtered products for the search bar during drafting
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return sortedProducts;
    return sortedProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedProducts, searchQuery]);

  const startInventory = () => {
    const initialDraft: Record<string, number> = {};
    sortedProducts.forEach(p => {
      initialDraft[p.id] = p.stock;
    });
    setDraftItems(initialDraft);
    setIsDrafting(true);
    setSearchQuery("");
    setNotes("");
  };

  const handleUpdateStock = (productId: string, value: number) => {
    setDraftItems(prev => ({
      ...prev,
      [productId]: isNaN(value) ? 0 : value
    }));
  };

  const validateInventory = () => {
    if (!confirm("Voulez-vous valider cet inventaire ? Les stocks seront mis à jour définitivement.")) return;
    
    let totalVarianceValue = 0;
    const items: InventoryItem[] = [];

    sortedProducts.forEach(p => {
      const expected = p.stock;
      const actual = draftItems[p.id] ?? 0;
      const variance = actual - expected;
      
      if (variance !== 0) {
        totalVarianceValue += (variance * p.cost);
      }
      
      items.push({
        productId: p.id,
        productName: p.name,
        expectedStock: expected,
        actualStock: actual,
        variance,
        costPrice: p.cost
      });
    });

    const session: InventorySession = {
      id: "inv_" + Date.now(),
      date: new Date().toISOString(),
      items,
      totalVarianceValue,
      notes
    };

    dispatch({ type: "ADD_INVENTORY_SESSION", payload: session });
    setIsDrafting(false);
  };

  const totalVariances = useMemo(() => {
    let diff = 0;
    let cost = 0;
    sortedProducts.forEach(p => {
      const actual = draftItems[p.id] ?? p.stock;
      const expected = p.stock;
      if (actual !== expected) {
        diff += (actual - expected);
        cost += ((actual - expected) * p.cost);
      }
    });
    return { count: diff, cost };
  }, [draftItems, sortedProducts]);

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inventaire Physique</h1>
            <p className="text-muted-foreground mt-1">Gérez le comptage de votre stock réel.</p>
          </div>
          {!isDrafting && (
            <button 
              onClick={startInventory}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity glow-primary"
            >
              <Plus className="h-4 w-4" />
              Nouvel inventaire
            </button>
          )}
        </div>

        {isDrafting ? (
          <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden animate-fade-in flex flex-col h-[calc(100vh-200px)]">
            <div className="p-4 sm:p-6 border-b border-border/40 bg-secondary/10 flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button onClick={() => setIsDrafting(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 pl-9 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider">Écart constaté</p>
                  <p className={`text-sm sm:text-base font-bold ${totalVariances.cost < 0 ? "text-destructive" : totalVariances.cost > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                    {totalVariances.cost > 0 ? "+" : ""}{formatPrice(totalVariances.cost)}
                  </p>
                </div>
                <button 
                  onClick={validateInventory}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-md hover:opacity-90 transition-all"
                >
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">Valider</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {filteredProducts.map(p => {
                const expected = p.stock;
                const actual = draftItems[p.id] ?? 0;
                const variance = actual - expected;

                return (
                  <div key={p.id} className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${variance !== 0 ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card hover:bg-secondary/10"}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <ProductAvatar name={p.name} size="md" />
                      <div>
                        <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between xl:justify-end gap-4 sm:gap-8 shrink-0 mt-2 xl:mt-0 bg-white/50 p-3 xl:p-0 rounded-lg xl:bg-transparent border xl:border-none border-border/40">
                      {/* Théorique */}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Théorique</span>
                        <div className="px-4 py-1.5 bg-secondary/50 rounded-lg border border-border/60 font-mono text-sm font-semibold text-muted-foreground shadow-inner">
                          {expected}
                        </div>
                      </div>

                      {/* Physique */}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">Physique</span>
                        <div className="w-24">
                          <input
                            type="number"
                            min="0"
                            value={actual.toString()}
                            onChange={(e) => handleUpdateStock(p.id, parseInt(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            className="w-full rounded-lg border-2 border-primary/40 bg-white px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Écart */}
                      <div className="flex flex-col items-center w-16">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Écart</span>
                        <span className={`text-lg font-black ${variance > 0 ? "text-green-600" : variance < 0 ? "text-destructive" : "text-muted-foreground/30"}`}>
                          {variance > 0 ? "+" : ""}{variance}
                        </span>
                      </div>

                      {/* Valeur Écart */}
                      <div className="flex flex-col items-center sm:items-end w-20 sm:w-24">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Valeur Écart</span>
                        <span className={`text-sm sm:text-base font-bold ${variance > 0 ? "text-green-600" : variance < 0 ? "text-destructive" : "text-muted-foreground/30"}`}>
                          {variance !== 0 ? formatPrice(variance * p.cost) : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <Search className="h-8 w-8 mb-3 opacity-20" />
                  <p>Aucun produit ne correspond à votre recherche.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border/40 bg-secondary/10 shrink-0">
               <input 
                 type="text" 
                 placeholder="Notes sur cet inventaire (optionnel)..." 
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 className="w-full bg-white border border-border/60 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
               />
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
            {state.inventorySessions && state.inventorySessions.length > 0 ? (
              <div className="overflow-x-auto w-full no-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                  <thead className="bg-secondary/30 text-xs text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Produits comptés</th>
                      <th className="px-6 py-4 font-medium">Notes</th>
                      <th className="px-6 py-4 font-medium text-right">Perte / Gain</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {state.inventorySessions.map(session => {
                      const countedProducts = session.items.filter(i => i.variance !== 0).length;
                      return (
                        <tr key={session.id} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-6 py-4 font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(session.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute:"2-digit" })}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {session.items.length} (dont {countedProducts} corrigés)
                          </td>
                          <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">
                            {session.notes || "-"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-bold ${session.totalVarianceValue < 0 ? "text-destructive bg-destructive/10 px-2 py-1 rounded-md" : session.totalVarianceValue > 0 ? "text-green-600 bg-green-600/10 px-2 py-1 rounded-md" : "text-muted-foreground"}`}>
                              {session.totalVarianceValue > 0 ? "+" : ""}{formatPrice(session.totalVarianceValue)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setSelectedSession(session)} className="p-2 hover:bg-secondary rounded-lg text-primary transition-colors">
                              <FileText className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                  <ClipboardList className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">Aucun inventaire</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Faites régulièrement des inventaires pour vous assurer que votre stock théorique correspond à votre stock réel.
                </p>
                <button 
                  onClick={startInventory}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                  Faire mon premier inventaire
                </button>
              </div>
            )}
          </div>
        )}

        {/* Session Details Modal */}
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setSelectedSession(null)}>
            <div id="inventory-modal-content" className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between p-6 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-4">
                  {state.settings.logo && (
                    <img src={state.settings.logo} alt="Logo" className="w-12 h-12 object-cover rounded-xl" />
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{state.settings.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {state.settings.city && state.settings.country ? `${state.settings.city}, ${state.settings.country}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {state.settings.email} {state.settings.phone ? ` • ${state.settings.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-primary">Rapport d&apos;Inventaire</h3>
                  <p className="text-sm text-muted-foreground mt-1">{new Date(selectedSession.date).toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-muted-foreground">Réf: {selectedSession.id.substring(0, 8)}</p>
                </div>
              </div>
              

              
              <div className="p-6 border-b border-border/40 bg-secondary/10 shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Bilan de la démarque (écarts)</span>
                  <span className={`font-bold text-lg ${selectedSession.totalVarianceValue < 0 ? "text-destructive" : selectedSession.totalVarianceValue > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                    {selectedSession.totalVarianceValue > 0 ? "+" : ""}{formatPrice(selectedSession.totalVarianceValue)}
                  </span>
                </div>
                {selectedSession.notes && (
                  <p className="text-sm text-muted-foreground bg-white p-3 rounded-lg border border-border/40 mt-3">{selectedSession.notes}</p>
                )}
              </div>

              <div id="inventory-table-container" className="flex-1 overflow-y-auto p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Tous les produits comptés</h3>
                <div className="overflow-x-auto w-full border border-border/40 rounded-xl bg-white">
                  <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-secondary/30 text-xs text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="px-4 py-3 font-medium">Produit</th>
                        <th className="px-4 py-3 font-medium text-center">Théorique</th>
                        <th className="px-4 py-3 font-medium text-center">Physique</th>
                        <th className="px-4 py-3 font-medium text-center">Écart</th>
                        <th className="px-4 py-3 font-medium text-right">Valeur Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {selectedSession.items.map((item) => (
                        <tr key={item.productId} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-4 py-3 font-medium">{item.productName}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{item.expectedStock}</td>
                          <td className="px-4 py-3 text-center font-bold">{item.actualStock}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block font-bold px-2 py-1 rounded-md text-xs ${item.variance < 0 ? "bg-destructive/10 text-destructive" : item.variance > 0 ? "bg-green-600/10 text-green-600" : "bg-secondary text-muted-foreground"}`}>
                              {item.variance > 0 ? "+" : ""}{item.variance}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${item.variance < 0 ? "text-destructive" : item.variance > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                              {item.variance !== 0 ? formatPrice(item.variance * item.costPrice) : "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div id="pdf-exclude-buttons" className="flex justify-end gap-3 p-4 border-t border-border/40 bg-gray-50 rounded-b-2xl shrink-0 print:hidden">
                  <button onClick={() => setSelectedSession(null)} className="px-5 py-2.5 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors text-sm font-medium">
                    Fermer
                  </button>
                  <button onClick={async () => {
                    const html2pdf = (await import('html2pdf.js')).default;
                    const element = document.getElementById('inventory-modal-content');
                    const tableContainer = document.getElementById('inventory-table-container');
                    const buttonsContainer = document.getElementById('pdf-exclude-buttons');
                    
                    if (element && tableContainer) {
                      element.style.maxHeight = 'none';
                      tableContainer.style.overflow = 'visible';
                      if (buttonsContainer) buttonsContainer.style.display = 'none';
                      
                      const opt = {
                        margin: 10,
                        filename: `inventaire_${selectedSession.id}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, windowWidth: 1000 },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                      };
                      
                      html2pdf().set(opt).from(element).save().then(() => {
                        element.style.maxHeight = '90vh';
                        tableContainer.style.overflow = 'auto';
                        if (buttonsContainer) buttonsContainer.style.display = 'flex';
                      });
                    }
                  }} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white hover:opacity-90 rounded-xl transition-opacity text-sm font-bold shadow-lg glow-primary">
                    <Printer className="h-4 w-4" />
                    Télécharger PDF
                  </button>
                </div>
            </div>
          </div>
        )}
      </div>

      </>
  );
}
