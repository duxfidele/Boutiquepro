"use client";

import React, { useState, useMemo, useRef } from "react";
import { useStore, Sale } from "@/context/StoreContext";
import { ProductAvatar } from "@/components/ui/ProductAvatar";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  Printer,
  X,
  Check,
  Percent,
  User,
  ChevronDown,
  FileText,
  Download,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const paymentMethods = [
  { id: "cash" as const, label: "Espèces", icon: Banknote, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  { id: "mobile_money" as const, label: "Mobile Money", icon: Smartphone, color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  { id: "card" as const, label: "Carte Bancaire", icon: CreditCard, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
];

export default function POSPage() {
  const { state, dispatch, formatPrice } = useStore();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [discount, setDiscount] = useState(0);
  const [amountGiven, setAmountGiven] = useState<number | "">("");
  const [payMethod, setPayMethod] = useState<"cash" | "mobile_money" | "card">("cash");
  const [customerName, setCustomerName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const allCategories = ["Tous", ...state.categories.map(c => c.name)];

  const filteredProducts = useMemo(() => {
    return state.products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "Tous" || p.category === categoryFilter;
      return matchSearch && matchCategory && p.stock > 0;
    });
  }, [state.products, search, categoryFilter]);

  const cart = state.cart;
  const subtotal = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  const taxAmount = 0; // TVA Supprimée
  const total = subtotal - discount;

  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    const finalAmountGiven = payMethod === "cash" && amountGiven ? Number(amountGiven) : undefined;
    const change = finalAmountGiven ? Math.max(0, finalAmountGiven - total) : undefined;

    const sale: Sale = {
      id: "s" + Date.now(),
      items: cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        quantity: c.quantity,
        unitPrice: c.product.price,
        total: c.product.price * c.quantity,
      })),
      subtotal,
      tax: taxAmount,
      discount,
      total,
      paymentMethod: payMethod,
      amountGiven: finalAmountGiven,
      change: change,
      customerName: customerName || undefined,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "COMPLETE_SALE", payload: sale });
    setLastSale(sale);
    setDiscount(0);
    setAmountGiven("");
    setCustomerName("");
    setShowSuccess(true);
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 300);
  };

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current || !lastSale) return;
    try {
      const clone = receiptRef.current.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.width = '300px';
      clone.style.height = 'auto';
      clone.style.maxWidth = 'none';
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, { 
        scale: 2, 
        windowWidth: 300,
        backgroundColor: "#ffffff",
      });
      
      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 200]
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`recu_${lastSale.id}.pdf`);
    } catch (e) {
      console.error("Erreur génération PDF:", e);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceRef.current || !lastSale) return;
    try {
      const clone = invoiceRef.current.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.width = '794px';
      clone.style.height = 'auto';
      clone.style.maxWidth = 'none';
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, { 
        scale: 2,
        windowWidth: 794,
        backgroundColor: "#ffffff",
      });
      
      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`facture_${lastSale.id}.pdf`);
    } catch (e) {
      console.error("Erreur génération PDF:", e);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-7rem)] animate-fade-in">
      {/* Left Panel - Product Selection */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:h-full h-[50vh]">
        {/* Search & Filters */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-secondary/30 py-2.5 pl-10 pr-4 text-base sm:text-sm placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 w-full">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((p) => {
              const inCart = cart.find((c) => c.product.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => dispatch({ type: "ADD_TO_CART", payload: p })}
                  className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all hover-lift ${
                    inCart
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border/40 bg-card hover:border-primary/20"
                  }`}
                >
                  <ProductAvatar name={p.name} size="lg" className="mb-1 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold truncate w-full">{p.name}</p>
                  <p className="text-sm font-bold text-primary">{formatPrice(p.price)}</p>
                  <p className="text-[10px] text-muted-foreground">Stock: {p.stock}</p>
                  {inCart && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Aucun article trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart & Checkout */}
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col rounded-2xl border border-border/40 bg-card overflow-hidden">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Panier</h2>
            {cart.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => dispatch({ type: "CLEAR_CART" })}
              className="text-xs text-destructive hover:underline"
            >
              Vider
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 no-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-xs">Ajoutez des articles</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3 animate-scale-in"
              >
                <ProductAvatar name={item.product.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{item.product.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatPrice(item.product.price)} / unité</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => dispatch({ type: "UPDATE_CART_QTY", payload: { productId: item.product.id, quantity: item.quantity - 1 } })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    onClick={() => dispatch({ type: "UPDATE_CART_QTY", payload: { productId: item.product.id, quantity: item.quantity + 1 } })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    disabled={item.quantity >= item.product.stock}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-right ml-1">
                  <p className="text-xs font-bold">{formatPrice(item.product.price * item.quantity)}</p>
                  <button
                    onClick={() => dispatch({ type: "REMOVE_FROM_CART", payload: item.product.id })}
                    className="mt-0.5"
                  >
                    <Trash2 className="h-3 w-3 text-destructive/60 hover:text-destructive transition-colors" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout section */}
        {cart.length > 0 && (
          <div className="border-t border-border/40 px-5 py-4 space-y-3 bg-secondary/10">
            {/* Customer name */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Nom du patient/client (optionnel)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-border/40 bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Discount */}
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="number"
                placeholder="Remise (FCFA)"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full rounded-lg border border-border/40 bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((pm) => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.id}
                    onClick={() => setPayMethod(pm.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                      payMethod === pm.id
                        ? `${pm.color} border-current shadow-sm`
                        : "border-border/40 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-tight">{pm.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Amount Given (Espèces) */}
            {payMethod === "cash" && (
              <div className="relative animate-fade-in">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="Montant perçu (Espèces)"
                  value={amountGiven}
                  onChange={(e) => setAmountGiven(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-border/40 bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1.5 pt-2 border-t border-border/30">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sous-total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs text-accent">
                  <span>Remise</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-1">
                <span>Total à Payer</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
              
              {payMethod === "cash" && amountGiven !== "" && Number(amountGiven) > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Espèces perçues</span>
                    <span>{formatPrice(Number(amountGiven))}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-accent">
                    <span>Reliquat (Monnaie)</span>
                    <span>{formatPrice(Math.max(0, Number(amountGiven) - total))}</span>
                  </div>
                </>
              )}
            </div>

            {/* Complete sale button */}
            <button
              onClick={handleCompleteSale}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent py-3.5 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg glow-primary"
            >
              <Check className="h-5 w-5" />
              Valider la vente
            </button>
          </div>
        )}
      </div>

      {/* Success toast */}
      {showSuccess && lastSale && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 backdrop-blur-xl px-5 py-4 shadow-soft-lg animate-slide-in-up">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shrink-0">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Vente enregistrée !</p>
            <p className="text-xs text-muted-foreground">{formatPrice(lastSale.total)} — {paymentMethods.find(p => p.id === lastSale.paymentMethod)?.label}</p>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => { setShowReceipt(true); setShowSuccess(false); }}
              className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/30 transition-colors"
            >
              <Receipt className="h-3.5 w-3.5" />
              Reçu
            </button>
            <button
              onClick={() => { setShowInvoice(true); setShowSuccess(false); }}
              className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Facture
            </button>
            <button onClick={() => setShowSuccess(false)} className="p-1 shrink-0">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal (Ticket de Caisse 80mm) */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowReceipt(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white text-black p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div ref={receiptRef} className="receipt-printable">
              {/* Receipt header */}
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4 flex flex-col items-center">
                {state.settings.logo && (
                  <img src={state.settings.logo} alt="Logo" className="w-10 h-10 object-cover rounded-xl mb-2" />
                )}
                <h2 className="text-xl font-bold">{state.settings.name}</h2>
                {(state.settings.city || state.settings.country) && (
                  <p className="text-[10px] text-gray-500 mt-1">{state.settings.city} {state.settings.country ? `- ${state.settings.country}` : ""}</p>
                )}
                {state.settings.phone && (
                  <p className="text-[10px] text-gray-500">{state.settings.phone}</p>
                )}
                <p className="text-xs text-gray-500 mt-3 font-medium border-t border-gray-200 pt-2 inline-block w-full">Reçu de caisse</p>
                <p className="text-xs text-gray-500">
                  {new Date(lastSale.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-gray-400 mt-1">N° {lastSale.id.toUpperCase()}</p>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-4">
                {lastSale.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      <span>{item.productName}</span>
                      <span className="text-gray-400 ml-1">x{item.quantity}</span>
                    </div>
                    <span className="font-medium">{new Intl.NumberFormat("fr-FR").format(item.total)} {state.settings.currency}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Sous-total</span>
                  <span>{new Intl.NumberFormat("fr-FR").format(lastSale.subtotal)} {state.settings.currency}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Remise</span>
                    <span>-{new Intl.NumberFormat("fr-FR").format(lastSale.discount)} {state.settings.currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>TOTAL</span>
                  <span>{new Intl.NumberFormat("fr-FR").format(lastSale.total)} {state.settings.currency}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 pt-1">
                  <span>Paiement</span>
                  <span>{paymentMethods.find(p => p.id === lastSale.paymentMethod)?.label}</span>
                </div>
                
                {lastSale.amountGiven !== undefined && lastSale.amountGiven > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Espèces perçues</span>
                      <span>{new Intl.NumberFormat("fr-FR").format(lastSale.amountGiven)} {state.settings.currency}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-800">
                      <span>Reliquat (Monnaie)</span>
                      <span>{new Intl.NumberFormat("fr-FR").format(lastSale.change || 0)} {state.settings.currency}</span>
                    </div>
                  </>
                )}

                {lastSale.customerName && (
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Patient/Client</span>
                    <span>{lastSale.customerName}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="text-center mt-6 pt-4 border-t-2 border-dashed border-gray-300">
                <p className="text-xs text-gray-400">Merci de votre visite ! 🙏</p>
                <p className="text-[10px] text-gray-300 mt-1">{state.settings.name} — Propulsé par BoutiquePro</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6 print:hidden">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-[0.5] rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={handleDownloadReceipt}
                className="flex-[1.25] flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex-[1.25] flex items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal (Facture A4) */}
      {showInvoice && lastSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in py-10" onClick={() => setShowInvoice(false)}>
          <div className="w-full max-w-3xl max-h-full overflow-y-auto rounded-2xl bg-white text-black shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div ref={invoiceRef} className="invoice-printable bg-white p-10 sm:p-14">
              {/* Facture Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-gray-200 pb-8 mb-8">
                <div className="flex items-start gap-4">
                  {state.settings.logo && (
                    <img src={state.settings.logo} alt="Logo" className="w-16 h-16 object-cover rounded-xl mt-1" />
                  )}
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">{state.settings.name}</h2>
                    <p className="text-gray-500 mt-2 text-sm">
                      {state.settings.city && state.settings.country ? `${state.settings.city}, ${state.settings.country}` : ""}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {state.settings.email} {state.settings.phone ? ` • ${state.settings.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right mt-6 sm:mt-0">
                  <h1 className="text-4xl font-black text-gray-200 uppercase tracking-widest mb-3">Facture</h1>
                  <p className="text-sm font-bold text-gray-700">FA-{lastSale.id.toUpperCase()}</p>
                  <p className="text-sm text-gray-500">Date: {new Date(lastSale.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>

              {/* Client Info */}
              <div className="mb-10">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Facturé à</h3>
                <p className="text-lg font-bold text-gray-800">{lastSale.customerName || "Patient/Client Standard"}</p>
              </div>

              {/* Table */}
              <table className="w-full mb-10">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="py-3 text-left text-sm font-bold text-gray-700">Désignation</th>
                    <th className="py-3 text-center text-sm font-bold text-gray-700">Qté</th>
                    <th className="py-3 text-right text-sm font-bold text-gray-700">Prix unitaire</th>
                    <th className="py-3 text-right text-sm font-bold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-4 text-sm font-medium text-gray-800">{item.productName}</td>
                      <td className="py-4 text-center text-sm text-gray-600">{item.quantity}</td>
                      <td className="py-4 text-right text-sm text-gray-600">{new Intl.NumberFormat("fr-FR").format(item.unitPrice)} {state.settings.currency}</td>
                      <td className="py-4 text-right text-sm font-bold text-gray-800">{new Intl.NumberFormat("fr-FR").format(item.total)} {state.settings.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Box */}
              <div className="flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Sous-total HT</span>
                    <span>{new Intl.NumberFormat("fr-FR").format(lastSale.subtotal)} {state.settings.currency}</span>
                  </div>
                  {lastSale.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Remise</span>
                      <span>-{new Intl.NumberFormat("fr-FR").format(lastSale.discount)} {state.settings.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-gray-800 pt-4 border-t-2 border-gray-800">
                    <span>Net à Payer</span>
                    <span className="text-primary">{new Intl.NumberFormat("fr-FR").format(lastSale.total)} {state.settings.currency}</span>
                  </div>

                  {lastSale.amountGiven !== undefined && lastSale.amountGiven > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-gray-600 pt-2 border-t border-gray-200 mt-2">
                        <span>Montant perçu</span>
                        <span>{new Intl.NumberFormat("fr-FR").format(lastSale.amountGiven)} {state.settings.currency}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-gray-800">
                        <span>Reliquat (Monnaie)</span>
                        <span>{new Intl.NumberFormat("fr-FR").format(lastSale.change || 0)} {state.settings.currency}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-16 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                <p className="font-medium">Moyen de paiement : {paymentMethods.find(p => p.id === lastSale.paymentMethod)?.label}</p>
                <p className="mt-2 text-xs">Merci de votre confiance et à très bientôt ! En cas de question, n'hésitez pas à nous contacter.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-10 pb-10 pt-4 print:hidden border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setShowInvoice(false)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-white transition-colors shadow-sm"
              >
                Fermer
              </button>
              <button
                onClick={handleDownloadInvoice}
                className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-900 hover:bg-gray-200 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" />
                Télécharger PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg glow-primary"
              >
                <Printer className="h-4 w-4" />
                Imprimer (A4)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
