"use client";

import React, { useState, useMemo, useRef } from "react";
import { useStore, Sale, CashSession, getSalesForSession, getSessionStats, SessionStats, DebtPayment } from "@/context/StoreContext";
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
  BookOpen,
  Phone,
  Printer,
  X,
  Check,
  Percent,
  User,
  ChevronDown,
  FileText,
  Download,
  Loader2,
  Lock,
  Unlock,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { exportElementToPdf } from "@/lib/pdf";

const paymentMethods = [
  { id: "cash" as const, label: "Espèces", icon: Banknote, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  { id: "mobile_money" as const, label: "Mobile Money", icon: Smartphone, color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  { id: "card" as const, label: "Carte", icon: CreditCard, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { id: "credit" as const, label: "Dette / Crédit", icon: BookOpen, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
];

export default function POSPage() {
  const { 
    state, 
    dispatch, 
    formatPrice, 
    activeCashSession, 
    cashSessions, 
    openCashSession, 
    closeCashSession,
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncOfflineSales,
    isRealtimeActive
  } = useStore();
  const { user, role, subscription } = useAuth();

  // Cash Session States
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showRapportXModal, setShowRapportXModal] = useState(false);
  const [showRapportZModal, setShowRapportZModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedZSession, setSelectedZSession] = useState<CashSession | null>(null);
  
  const [openingAmountInput, setOpeningAmountInput] = useState<number | "">(0);
  const [closingAmountInput, setClosingAmountInput] = useState<number | "">("");
  const [closingNotesInput, setClosingNotesInput] = useState("");
  const [isClosingSubmitting, setIsClosingSubmitting] = useState(false);
  const rapportZRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<number | "">("");
  const [amountGiven, setAmountGiven] = useState<number | "">("");
  const [payMethod, setPayMethod] = useState<"cash" | "mobile_money" | "card" | "credit">("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [downPayment, setDownPayment] = useState<number | "">("");
  const [dueDate, setDueDate] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isDownloadingRapportZ, setIsDownloadingRapportZ] = useState(false);

  const allCategories = ["Tous", ...state.categories.map(c => c.name)];

  const filteredProducts = useMemo(() => {
    return state.products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "Tous" || p.category === categoryFilter;
      return matchSearch && matchCategory && p.stock > 0;
    });
  }, [state.products, search, categoryFilter]);

  const cart = (state.cart || []).filter((c) => c && c.product);
  const subtotal = cart.reduce((sum, c) => sum + (c.product?.price || 0) * (c.quantity || 1), 0);
  const taxAmount = 0; // TVA Supprimée
  
  // Calcul dynamique de la remise (priorité au pourcentage déduit du coût total)
  const discountAmount = useMemo(() => {
    if (!discountValue || Number(discountValue) <= 0) return 0;
    const val = Number(discountValue);
    if (discountType === "percent") {
      return Math.round((subtotal * Math.min(100, Math.max(0, val))) / 100);
    }
    return Math.min(subtotal, Math.max(0, val));
  }, [discountValue, discountType, subtotal]);

  const total = Math.max(0, subtotal - discountAmount);

  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    if (!activeCashSession) {
      alert("⚠️ La caisse est actuellement fermée. Veuillez d'abord ouvrir la caisse avec votre fond de caisse initial pour commencer les encaissements.");
      setOpeningAmountInput("");
      setShowOpenModal(true);
      return;
    }

    if (payMethod === "credit" && !customerName.trim()) {
      alert("⚠️ Le nom du client est obligatoire pour enregistrer une vente à crédit.");
      return;
    }

    const finalAmountGiven = payMethod === "cash" && amountGiven ? Number(amountGiven) : undefined;
    const change = finalAmountGiven ? Math.max(0, finalAmountGiven - total) : undefined;

    const isCredit = payMethod === "credit";
    const deposit = isCredit ? (downPayment !== "" ? Number(downPayment) : 0) : total;
    const remaining = isCredit ? Math.max(0, total - deposit) : 0;
    const status = isCredit ? (remaining === 0 ? "paid" : (deposit > 0 ? "partial" : "unpaid")) : "paid";
    const now = new Date().toISOString();
    const saleId = "s" + Date.now();

    const initialPayments: DebtPayment[] = (isCredit && deposit > 0) ? [{
      id: "init-" + Date.now(),
      saleId,
      amount: deposit,
      paymentMethod: "cash",
      paidAt: now,
      note: "Acompte initial à la caisse",
      cashierName: user?.email?.split("@")[0] || "Caissier",
    }] : [];

    const sale: Sale = {
      id: saleId,
      items: cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        quantity: c.quantity,
        unitPrice: c.product.price,
        total: c.product.price * c.quantity,
      })),
      subtotal,
      tax: taxAmount,
      discount: discountAmount,
      total,
      paymentMethod: payMethod,
      amountGiven: finalAmountGiven,
      change: change,
      customerName: customerName.trim() || (isCredit ? "Client Crédit" : undefined),
      customerPhone: customerPhone.trim() || undefined,
      dueDate: isCredit && dueDate ? dueDate : undefined,
      amountPaid: deposit,
      remainingAmount: remaining,
      paymentStatus: status,
      payments: initialPayments,
      createdAt: now,
      userId: user?.id,
    };

    if (subscription?.isExpired) {
      alert("L'abonnement de votre boutique est expiré. L'encaissement est bloqué jusqu'au renouvellement.");
      return;
    }
    dispatch({ type: "COMPLETE_SALE", payload: sale });
    setLastSale(sale);
    setDiscountValue("");
    setDiscountType("percent");
    setAmountGiven("");
    setCustomerName("");
    setCustomerPhone("");
    setDownPayment("");
    setDueDate("");
    setShowSuccess(true);
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 300);
  };

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current || !lastSale || isDownloadingReceipt) return;
    setIsDownloadingReceipt(true);
    try {
      await exportElementToPdf(receiptRef.current, {
        filename: `recu_${lastSale.id}.pdf`,
        widthPx: 300,
        pdfFormat: [80, 200],
        scale: 1.5,
      });
    } catch (e) {
      console.error("Erreur génération PDF reçu:", e);
      alert("La génération du PDF du reçu a échoué. Vous pouvez utiliser le bouton Imprimer.");
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceRef.current || !lastSale || isDownloadingInvoice) return;
    setIsDownloadingInvoice(true);
    try {
      await exportElementToPdf(invoiceRef.current, {
        filename: `facture_${lastSale.id}.pdf`,
        widthPx: 794,
        pdfFormat: "a4",
        scale: 1.5,
      });
    } catch (e) {
      console.error("Erreur génération PDF facture:", e);
      alert("La génération du PDF de la facture a échoué. Vous pouvez utiliser le bouton Imprimer la Facture.");
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleStartSession = async () => {
    const val = Number(openingAmountInput) || 0;
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Caissier";
    await openCashSession(val, name);
    setShowOpenModal(false);
  };

  const handleConfirmClose = async () => {
    if (closingAmountInput === "") return;
    setIsClosingSubmitting(true);
    try {
      const realAmount = Number(closingAmountInput);
      const closed = await closeCashSession(realAmount, closingNotesInput);
      if (closed) {
        setSelectedZSession(closed);
        setShowCloseModal(false);
        setShowRapportZModal(true);
        setClosingAmountInput("");
        setClosingNotesInput("");
      }
    } finally {
      setIsClosingSubmitting(false);
    }
  };

  const handleDownloadRapportZ = async () => {
    if (!rapportZRef.current || !selectedZSession || isDownloadingRapportZ) return;
    setIsDownloadingRapportZ(true);
    try {
      await exportElementToPdf(rapportZRef.current, {
        filename: `rapport_Z_${selectedZSession.id}.pdf`,
        widthPx: 320,
        pdfFormat: [80, 260],
        scale: 1.5,
      });
      // Fermeture automatique du rapport après téléchargement réussi
      setTimeout(() => {
        setShowRapportZModal(false);
      }, 600);
    } catch (e) {
      console.error("Erreur PDF Rapport Z:", e);
      alert("La génération du PDF du rapport a échoué. Vous pouvez utiliser le bouton Imprimer.");
    } finally {
      setIsDownloadingRapportZ(false);
    }
  };

  // Calcul dynamique en direct des ventes de la session / journée
  const currentSessionSales = useMemo(() => {
    if (!activeCashSession) return [];
    return getSalesForSession(activeCashSession, state?.sales || [], cashSessions || []);
  }, [activeCashSession, state?.sales, cashSessions]);

  const currentSessionStats = useMemo(() => {
    return getSessionStats(activeCashSession, state?.sales || [], cashSessions || []);
  }, [activeCashSession, state?.sales, cashSessions]);

  const selectedZStats = useMemo(() => {
    if (!selectedZSession) return null;
    return getSessionStats(selectedZSession, state?.sales || [], cashSessions || []);
  }, [selectedZSession, state?.sales, cashSessions]);

  const calculatedDifference = useMemo(() => {
    if (!activeCashSession || closingAmountInput === "") return 0;
    return Number(closingAmountInput) - currentSessionStats.expectedCashInDrawer;
  }, [activeCashSession, closingAmountInput, currentSessionStats.expectedCashInDrawer]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Cash Session Status Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/50 bg-card/90 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          {activeCashSession ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Caisse Active : {activeCashSession.cashierName || "En cours"}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                Fond initial : <strong className="text-foreground font-semibold">{formatPrice(currentSessionStats.opening)}</strong>
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                Espèces tiroir : <strong className="text-foreground font-semibold">{formatPrice(currentSessionStats.expectedCashInDrawer)}</strong>
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Total Ventes : <strong className="text-primary font-semibold">{formatPrice(currentSessionStats.total)} ({currentSessionStats.count} v.)</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-bold">Caisse Clôturée — Compteur à 0 (Prêt pour prochaine ouverture)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Indicateur Réseau & File d'attente Hors-Ligne */}
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold animate-pulse">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>Hors-Ligne</span>
              {pendingSyncCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] ml-1">
                  {pendingSyncCount} attente
                </span>
              )}
            </div>
          ) : pendingSyncCount > 0 ? (
            <button
              type="button"
              onClick={() => syncOfflineSales()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all shadow-xs"
              title="Cliquer pour synchroniser les ventes enregistrées hors-ligne"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Synchronisation..." : `${pendingSyncCount} en attente • Sync`}</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20" title="Synchronisation temps réel WebSocket active pour votre boutique">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>En direct (Realtime)</span>
            </div>
          )}

          {activeCashSession ? (
            <>
              <button
                type="button"
                onClick={() => setShowRapportXModal(true)}
                className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-secondary text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Consulter le récapitulatif provisoire"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Point d&apos;étape (Rapport X)
              </button>
              <button
                type="button"
                onClick={() => {
                  setClosingAmountInput("");
                  setClosingNotesInput("");
                  setShowCloseModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                Clôturer la caisse (Rapport Z)
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpeningAmountInput(0);
                setShowOpenModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Unlock className="h-3.5 w-3.5" />
              Ouvrir la caisse
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            title="Consulter les clôtures passées"
          >
            <History className="h-3.5 w-3.5" />
            Historique Z
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-12.5rem)] min-h-[560px]">
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
      <div className="w-full lg:w-[410px] xl:w-[430px] shrink-0 flex flex-col rounded-2xl border border-border/40 bg-card h-full max-h-full overflow-hidden shadow-sm">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-sm font-bold">Panier</h2>
            {cart.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                {cart.reduce((s, c) => s + c.quantity, 0)} {cart.reduce((s, c) => s + c.quantity, 0) > 1 ? "articles" : "article"}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => dispatch({ type: "CLEAR_CART" })}
              className="text-xs text-destructive hover:underline font-medium"
            >
              Vider le panier
            </button>
          )}
        </div>

        {/* Cart Items - Zone avec hauteur garantie et défilement fluide */}
        <div className="flex-1 min-h-[140px] overflow-y-auto px-4 py-2.5 space-y-2 no-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground text-center">
              <ShoppingCart className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-xs font-semibold">Votre panier est vide</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">Cliquez sur un article à gauche pour l'ajouter</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-2.5 rounded-xl bg-secondary/30 p-2.5 border border-border/30 hover:border-border/60 transition-colors animate-scale-in"
              >
                <ProductAvatar name={item.product.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-foreground">{item.product.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatPrice(item.product.price)} / unité</p>
                </div>

                {/* Contrôles de quantité : Moins, Saisie directe au clavier, Plus */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "UPDATE_CART_QTY", payload: { productId: item.product.id, quantity: item.quantity - 1 } })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors active:scale-95"
                    title="Diminuer la quantité (-1)"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>

                  {/* Saisie directe du nombre d'articles */}
                  <input
                    type="number"
                    min="1"
                    max={item.product.stock}
                    value={item.quantity}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const val = parseInt(raw, 10);
                      if (!isNaN(val)) {
                        const finalQty = Math.min(item.product.stock, Math.max(1, val));
                        dispatch({ type: "UPDATE_CART_QTY", payload: { productId: item.product.id, quantity: finalQty } });
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-12 h-7 text-center text-xs font-bold rounded-lg border border-border/80 bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                    title="Cliquez pour taper directement la quantité à acheter"
                  />

                  <button
                    type="button"
                    onClick={() => dispatch({ type: "UPDATE_CART_QTY", payload: { productId: item.product.id, quantity: item.quantity + 1 } })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    disabled={item.quantity >= item.product.stock}
                    title={item.quantity >= item.product.stock ? "Stock maximum atteint" : "Augmenter la quantité (+1)"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="text-right ml-1 shrink-0">
                  <p className="text-xs font-bold text-primary">{formatPrice(item.product.price * item.quantity)}</p>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "REMOVE_FROM_CART", payload: item.product.id })}
                    className="mt-0.5 inline-flex p-1 hover:bg-destructive/10 rounded transition-colors"
                    title="Retirer cet article du panier"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Section Encaissement & Finalisation (Toujours visible si le panier contient des articles) */}
        {cart.length > 0 && (
          <div className="flex flex-col border-t border-border/40 bg-secondary/5 shrink-0">
            {/* Options intermédiaires compactes et défilantes si petit écran */}
            <div className="max-h-[220px] overflow-y-auto px-4 py-2.5 space-y-2.5 no-scrollbar">
              {/* Nom du client (optionnel) */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={payMethod === "credit" ? "Nom du client (Obligatoire pour crédit) *" : "Nom du client (optionnel)"}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-background pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Remise commerciale compacte */}
              <div className="space-y-1.5 rounded-xl bg-secondary/30 p-2 border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3 text-primary" /> Remise commerciale
                  </span>
                  <div className="flex rounded-md border border-border/60 bg-background overflow-hidden p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("percent");
                        setDiscountValue("");
                      }}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${
                        discountType === "percent"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      % Pourcentage
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("fixed");
                        setDiscountValue("");
                      }}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${
                        discountType === "fixed"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      FCFA Montant
                    </button>
                  </div>
                </div>

                {/* Saisie de la remise et raccourcis */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      {discountType === "percent" ? "%" : state.settings.currency}
                    </span>
                    <input
                      type="number"
                      placeholder={discountType === "percent" ? "Taux (ex: 10)" : "Montant (ex: 2000)"}
                      value={discountValue}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setDiscountValue("");
                        } else {
                          const num = Number(raw);
                          if (discountType === "percent") {
                            setDiscountValue(Math.min(100, Math.max(0, num)));
                          } else {
                            setDiscountValue(Math.min(subtotal, Math.max(0, num)));
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-border/40 bg-background pl-7 pr-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {discountType === "percent" && (
                    <div className="flex items-center gap-1 shrink-0">
                      {[5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountValue(pct)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                            discountValue === pct
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border/60 bg-background hover:bg-secondary text-muted-foreground"
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {discountAmount > 0 && (
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-0.5">
                    <span>Déduction calculée :</span>
                    <span>-{formatPrice(discountAmount)} {discountType === "percent" ? `(-${discountValue}%)` : ""}</span>
                  </p>
                )}
              </div>

              {/* Modes de paiement compacts */}
              <div className="grid grid-cols-4 gap-1.5">
                {paymentMethods.map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPayMethod(pm.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-1 text-center transition-all ${
                        payMethod === pm.id
                          ? `${pm.color} border-current shadow-xs`
                          : "border-border/40 text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-[10px] font-semibold truncate">{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Espèces perçues avec bouton Raccourci 'Montant Exact' */}
              {payMethod === "cash" && (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <div className="relative flex-1">
                    <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="number"
                      placeholder="Espèces reçues..."
                      value={amountGiven}
                      onChange={(e) => setAmountGiven(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-lg border border-border/40 bg-background pl-8 pr-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmountGiven(total)}
                    className="px-2.5 py-1.5 rounded-lg border border-border/60 bg-background hover:bg-secondary text-[10px] font-bold text-primary shrink-0 transition-colors"
                    title="Remplir directement avec le montant exact à payer"
                  >
                    Montant exact
                  </button>
                </div>
              )}

              {/* Vente à Crédit / Dette Client : Acompte & Téléphone */}
              {payMethod === "credit" && (
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-400">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      Vente à Crédit (Dette Client)
                    </span>
                    <span className="text-[10px] uppercase font-extrabold bg-purple-200 dark:bg-purple-900/60 px-1.5 py-0.5 rounded">
                      Carnet de dettes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        type="tel"
                        placeholder="N° Téléphone / WhatsApp"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full rounded-lg border border-border/50 bg-background pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Acompte versé (FCFA)..."
                        value={downPayment}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDownPayment(v === "" ? "" : Math.min(total, Math.max(0, Number(v))));
                        }}
                        className="w-full rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-semibold"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        title="Échéance remboursement (optionnel)"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-medium text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-purple-500/20 text-purple-900 dark:text-purple-300">
                    <span>Reste dû par le client :</span>
                    <span className="text-sm font-black text-purple-700 dark:text-purple-400">
                      {formatPrice(Math.max(0, total - (downPayment !== "" ? Number(downPayment) : 0)))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Pied de Panier Fixe (Totaux & Bouton Valider : Toujours visible sans défilement) */}
            <div className="border-t border-border/40 px-4 py-3 bg-card space-y-2.5 shadow-sm">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Sous-total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                    <span>Remise {discountType === "percent" ? `(${discountValue}%)` : ""}</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>TVA (0%)</span>
                  <span>0 {state.settings.currency}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold pt-0.5 text-foreground">
                  <span>Total TTC à Payer</span>
                  <span className="text-primary text-lg">{formatPrice(total)}</span>
                </div>

                {payMethod === "cash" && amountGiven !== "" && Number(amountGiven) > 0 && (
                  <div className="flex justify-between text-xs font-bold pt-0.5 border-t border-border/20">
                    <span className="text-muted-foreground">Reliquat (Monnaie à rendre) :</span>
                    <span className={Number(amountGiven) >= total ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-destructive"}>
                      {Number(amountGiven) >= total ? formatPrice(Number(amountGiven) - total) : `Manque ${formatPrice(total - Number(amountGiven))}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Bouton Valider la vente (Encaisser) : Grand, proéminent et toujours accessible */}
              <button
                type="button"
                onClick={handleCompleteSale}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-white hover:opacity-95 transition-all shadow-md glow-primary active:scale-[0.99]"
              >
                <Check className="h-5 w-5" />
                <span>Valider la vente — {formatPrice(total)}</span>
              </button>
            </div>
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

      {/* Receipt Modal (Ticket de Caisse 80mm — Modèle Professionnel Identique à la capture) */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowReceipt(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white text-black p-5 shadow-2xl animate-scale-in max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 overflow-y-auto pr-1">
              <div ref={receiptRef} className="receipt-printable bg-white text-black font-mono text-[11px] leading-relaxed p-4 border border-gray-200 rounded-xl shadow-xs">
                {/* Entête Boutique Centrée */}
                <div className="text-center pb-2">
                  {state.settings.logo && (
                    <img src={state.settings.logo} alt="Logo" crossOrigin="anonymous" className="w-12 h-12 object-contain mx-auto mb-1.5 rounded" />
                  )}
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-black">{state.settings.name || "BOUTIQUE"}</h2>
                  {(state.settings.city || state.settings.country) && (
                    <p className="text-[10px] text-gray-700 font-medium">
                      {state.settings.city}{state.settings.country ? `, ${state.settings.country}` : ""}
                    </p>
                  )}
                  {state.settings.phone && (
                    <p className="text-[10px] text-gray-700 font-medium">Tél : {state.settings.phone}</p>
                  )}
                  {state.settings.email && (
                    <p className="text-[9px] text-gray-600">{state.settings.email}</p>
                  )}
                </div>

                {/* Séparateur pointillé */}
                <div className="border-t border-dashed border-gray-400 my-2"></div>

                {/* Métadonnées du Ticket (Ticket n°, Date, Caissier, Client) */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Ticket n°</span>
                    <span className="font-bold text-black">BTQ-{lastSale.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Date</span>
                    <span className="font-medium text-black">
                      {new Date(lastSale.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
                      {new Date(lastSale.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Caissier</span>
                    <span className="font-medium text-black">
                      {activeCashSession?.cashierName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Caissier"}
                    </span>
                  </div>
                  {lastSale.customerName && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Client</span>
                      <span className="font-semibold text-black">{lastSale.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Séparateur pointillé */}
                <div className="border-t border-dashed border-gray-400 my-2"></div>

                {/* Tableau des Articles (Article, Qté, P.U., Total) */}
                <table className="w-full text-[10px] my-1">
                  <thead>
                    <tr className="border-b border-dashed border-gray-400 text-gray-800 font-bold">
                      <th className="text-left py-1 w-5/12 font-bold">Article</th>
                      <th className="text-center py-1 w-2/12 font-bold">Qté</th>
                      <th className="text-right py-1 w-2/12 font-bold">P.U.</th>
                      <th className="text-right py-1 w-3/12 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSale.items.map((item, i) => (
                      <tr key={i} className="border-b border-dotted border-gray-200">
                        <td className="text-left py-1.5 font-medium text-black truncate max-w-[110px]" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="text-center py-1.5 text-black font-semibold">{item.quantity}</td>
                        <td className="text-right py-1.5 text-gray-700">{new Intl.NumberFormat("fr-FR").format(item.unitPrice)}</td>
                        <td className="text-right py-1.5 font-bold text-black">{new Intl.NumberFormat("fr-FR").format(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Séparateur pointillé */}
                <div className="border-t border-dashed border-gray-400 my-2"></div>

                {/* Totaux & Remise */}
                <div className="space-y-1 text-[10px]">
                  {lastSale.discount > 0 && (
                    <>
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Sous-total</span>
                        <span>{new Intl.NumberFormat("fr-FR").format(lastSale.subtotal)} {state.settings.currency}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-700 font-semibold">
                        <span>Remise</span>
                        <span>-{new Intl.NumberFormat("fr-FR").format(lastSale.discount)} {state.settings.currency}</span>
                      </div>
                      <div className="border-t border-dashed border-gray-300 my-1"></div>
                    </>
                  )}

                  <div className="flex justify-between items-center text-gray-700">
                    <span>TVA (0%)</span>
                    <span>0 {state.settings.currency}</span>
                  </div>

                  <div className="border-t border-dashed border-gray-300 my-1"></div>

                  <div className="flex justify-between items-baseline text-xs font-black text-black py-0.5">
                    <span className="tracking-wider">TOTAL TTC</span>
                    <span className="text-sm font-extrabold">{new Intl.NumberFormat("fr-FR").format(lastSale.total)} {state.settings.currency}</span>
                  </div>
                </div>

                {/* Séparateur pointillé */}
                <div className="border-t border-dashed border-gray-400 my-2"></div>

                {/* Détails Paiement (Paiement, Reçu, Monnaie rendue) */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Paiement</span>
                    <span className="font-semibold text-black">
                      {paymentMethods.find(p => p.id === lastSale.paymentMethod)?.label || "Espèces"}
                    </span>
                  </div>

                  {lastSale.paymentMethod === "credit" && (
                    <div className="mt-1.5 p-2 rounded-lg bg-purple-50 border border-purple-300 text-purple-900 font-bold space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>Acompte versé :</span>
                        <span>{new Intl.NumberFormat("fr-FR").format(lastSale.amountPaid || 0)} {state.settings.currency}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-black text-purple-950 pt-1 border-t border-purple-200">
                        <span>RESTE À DEVOIR :</span>
                        <span>{new Intl.NumberFormat("fr-FR").format(lastSale.remainingAmount ?? 0)} {state.settings.currency}</span>
                      </div>
                    </div>
                  )}

                  {lastSale.paymentMethod === "cash" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Reçu</span>
                        <span className="font-semibold text-black">
                          {new Intl.NumberFormat("fr-FR").format(lastSale.amountGiven && lastSale.amountGiven > 0 ? lastSale.amountGiven : lastSale.total)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center font-bold text-black">
                        <span>Monnaie rendue</span>
                        <span>
                          {new Intl.NumberFormat("fr-FR").format(lastSale.amountGiven && lastSale.amountGiven > lastSale.total ? lastSale.amountGiven - lastSale.total : 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Séparateur pointillé */}
                <div className="border-t border-dashed border-gray-400 my-2"></div>

                {/* Message de fin centré */}
                <div className="text-center pt-2 space-y-1">
                  <p className="text-[11px] font-bold text-black">Merci de votre visite</p>
                  <p className="text-[9px] text-gray-500">À bientôt !</p>
                  <p className="text-[8px] text-gray-400 pt-1 border-t border-gray-100">MaBoutiquePro • Caisse Enregistreuse</p>
                </div>
              </div>
            </div>

            {/* Actions du Modal */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 print:hidden shrink-0">
              <button
                type="button"
                onClick={() => setShowReceipt(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={isDownloadingReceipt}
                onClick={handleDownloadReceipt}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloadingReceipt ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-700" />
                    <span>Patientez...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Télécharger PDF</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-white py-2.5 text-xs font-bold hover:opacity-90 transition-opacity shadow-md"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal (Facture A4 — Modèle Corporate & Professionnel) */}
      {showInvoice && lastSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 sm:p-8" onClick={() => setShowInvoice(false)}>
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white text-black shadow-2xl animate-scale-in flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 overflow-y-auto p-8 sm:p-12">
              <div ref={invoiceRef} className="invoice-printable bg-white text-gray-900 font-sans">
                {/* Entête Facture A4 avec badge et coordonnées */}
                <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-primary/20 pb-6 mb-8 gap-4">
                  <div className="flex items-start gap-4">
                    {state.settings.logo ? (
                      <img src={state.settings.logo} alt="Logo" crossOrigin="anonymous" className="w-16 h-16 object-contain rounded-xl border border-gray-100 p-1" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-primary text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-sm">
                        {state.settings.name ? state.settings.name.slice(0, 2).toUpperCase() : "BP"}
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">{state.settings.name || "MABOUTIQUEPRO"}</h2>
                      <p className="text-xs text-gray-600 mt-1 font-medium">
                        {state.settings.city}{state.settings.country ? `, ${state.settings.country}` : ""}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">
                        Tél : {state.settings.phone || "—"} {state.settings.email ? `• ${state.settings.email}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Bloc Numéro et Date de Facture */}
                  <div className="text-left sm:text-right">
                    <div className="flex flex-col sm:items-end gap-1 mb-2">
                      <div className="inline-block px-3 py-1 rounded-full bg-gray-900 text-white text-[11px] font-black tracking-wider uppercase">
                        FACTURE ACQUITTÉE
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        RÉGIME : TVA 0% (FRANCHISE EN BASE)
                      </span>
                    </div>
                    <p className="text-lg font-black text-gray-900">N° FAC-{lastSale.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Date : <span className="font-semibold text-gray-900">{new Date(lastSale.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Heure : {new Date(lastSale.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Informations Client & Vendeur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 mb-8">
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Client / Destinataire</h3>
                    <p className="text-sm font-extrabold text-gray-900">{lastSale.customerName || "Client au comptoir (Particulier)"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Vente directe au comptoir</p>
                  </div>
                  <div className="sm:text-right">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Règlement & Émission</h3>
                    <p className="text-sm font-bold text-gray-900">
                      Mode : <span className="text-primary font-extrabold">{paymentMethods.find(p => p.id === lastSale.paymentMethod)?.label || "Espèces"}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Caissier : {activeCashSession?.cashierName || user?.user_metadata?.full_name || "Agent de caisse"}
                    </p>
                  </div>
                </div>

                {/* Tableau Pro des Articles avec colonnes explicites HT, TVA et TTC */}
                <div className="border border-gray-300 rounded-xl overflow-hidden mb-8 shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-800 font-extrabold border-b border-gray-300 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">#</th>
                        <th className="py-3 px-4">Désignation de l'article</th>
                        <th className="py-3 px-3 text-center w-16">Qté</th>
                        <th className="py-3 px-4 text-right w-28">P.U. (HT)</th>
                        <th className="py-3 px-3 text-center w-20">TVA</th>
                        <th className="py-3 px-4 text-right w-32">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-900">
                      {lastSale.items.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-gray-400">{i + 1}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{item.productName}</td>
                          <td className="py-3 px-3 text-center font-bold text-gray-900">{item.quantity}</td>
                          <td className="py-3 px-4 text-right text-gray-700 font-medium">
                            {new Intl.NumberFormat("fr-FR").format(item.unitPrice)} {state.settings.currency}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">0%</td>
                          <td className="py-3 px-4 text-right font-black text-gray-900">
                            {new Intl.NumberFormat("fr-FR").format(item.total)} {state.settings.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bloc Totaux & Signature */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start mb-8">
                  {/* Cadre Cachet & Signature */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center text-xs text-gray-600 h-44 flex flex-col justify-between bg-gray-50/40">
                    <p className="font-extrabold text-gray-800 uppercase tracking-wide">Cachet & Signature de la boutique</p>
                    <div className="py-2 text-[11px] text-gray-400 italic">Mention : Pour acquit et conformité</div>
                    <p className="text-[10px] text-gray-500 font-medium border-t border-gray-200 pt-2">Vente certifiée • MaBoutiquePro</p>
                  </div>

                  {/* Totaux financiers avec TVA 0 F et Total TTC ultra visibles */}
                  <div className="bg-gray-50 rounded-xl p-5 border-2 border-gray-200 space-y-3">
                    <div className="flex justify-between text-xs text-gray-700 font-semibold">
                      <span>Montant Total Brut (HT) :</span>
                      <span className="font-bold text-gray-900">{new Intl.NumberFormat("fr-FR").format(lastSale.subtotal)} {state.settings.currency}</span>
                    </div>

                    {lastSale.discount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-700 font-bold">
                        <span>Remise commerciale accordée :</span>
                        <span>-{new Intl.NumberFormat("fr-FR").format(lastSale.discount)} {state.settings.currency}</span>
                      </div>
                    )}

                    {/* LIGNE TVA (0%) : 0 FCFA TRÈS CLAIRE ET ENCADRÉE */}
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800 bg-white p-2.5 rounded-lg border border-gray-300 shadow-xs">
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                        TVA (0%) :
                      </span>
                      <span className="font-black text-gray-900">0 {state.settings.currency}</span>
                    </div>

                    {/* LIGNE TOTAL TTC EN GRAND ET ENCADRÉ NOIR CONTRASTÉ */}
                    <div className="pt-2">
                      <div className="bg-gray-900 text-white rounded-xl p-3.5 flex justify-between items-center shadow-sm">
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-wider block text-gray-200">TOTAL TTC À PAYER</span>
                          <span className="text-[9px] text-gray-400">Toutes Taxes Comprises</span>
                        </div>
                        <span className="text-xl sm:text-2xl font-black text-white">
                          {new Intl.NumberFormat("fr-FR").format(lastSale.total)} {state.settings.currency}
                        </span>
                      </div>
                    </div>

                    {lastSale.paymentMethod === "credit" && (
                      <div className="pt-2 border-t-2 border-purple-200 text-xs text-purple-900 space-y-1.5 bg-purple-50/70 p-3 rounded-xl border border-purple-200">
                        <div className="flex justify-between font-bold">
                          <span>Modalité de règlement :</span>
                          <span className="uppercase text-purple-800">Vente à Crédit (Dette Client)</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>Acompte réglé ce jour :</span>
                          <span className="font-semibold">{new Intl.NumberFormat("fr-FR").format(lastSale.amountPaid || 0)} {state.settings.currency}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-purple-950 pt-1 border-t border-purple-200">
                          <span>Reste dû par le client :</span>
                          <span>{new Intl.NumberFormat("fr-FR").format(lastSale.remainingAmount ?? 0)} {state.settings.currency}</span>
                        </div>
                        {lastSale.customerPhone && (
                          <div className="text-[10px] text-purple-700 font-medium pt-0.5">
                            Contact client : {lastSale.customerPhone}
                          </div>
                        )}
                      </div>
                    )}

                    {lastSale.paymentMethod === "cash" && lastSale.amountGiven !== undefined && lastSale.amountGiven > 0 && (
                      <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Espèces reçues :</span>
                          <span className="font-semibold">{new Intl.NumberFormat("fr-FR").format(lastSale.amountGiven)} {state.settings.currency}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>Monnaie rendue :</span>
                          <span className="text-emerald-700">{new Intl.NumberFormat("fr-FR").format(Math.max(0, lastSale.amountGiven - lastSale.total))} {state.settings.currency}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bas de page légal */}
                <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500 space-y-1">
                  <p className="font-semibold text-gray-700">Merci de votre confiance ! Les marchandises vendues ne sont ni reprises ni échangées.</p>
                  <p className="text-[10px] text-gray-400">Document certifié par MaBoutiquePro — maboutiquepro.app</p>
                </div>
              </div>
            </div>

            {/* Actions du Modal Facture */}
            <div className="flex gap-3 px-8 py-4 print:hidden border-t border-gray-200 bg-gray-50 shrink-0">
              <button
                type="button"
                onClick={() => setShowInvoice(false)}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={isDownloadingInvoice}
                onClick={handleDownloadInvoice}
                className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-gray-200 py-3 text-xs font-bold text-gray-800 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloadingInvoice ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-gray-800" />
                    <span>Génération PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Télécharger PDF (A4)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-3 text-xs font-bold hover:opacity-90 transition-opacity shadow-lg glow-primary"
              >
                <Printer className="h-4 w-4" />
                Imprimer la Facture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1 : OUVERTURE DE CAISSE                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border/60 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Unlock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Ouverture de caisse</h3>
                  <p className="text-xs text-muted-foreground">Initialisation du fond de tiroir</p>
                </div>
              </div>
              <button 
                onClick={() => setShowOpenModal(false)}
                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Caissier en service
                </label>
                <div className="p-3 rounded-xl bg-secondary/40 border border-border/40 text-sm font-bold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  {user?.user_metadata?.full_name || user?.email || "Caissier"}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Fond de caisse initial ({state.settings.currency})
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={openingAmountInput}
                  onChange={(e) => setOpeningAmountInput(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full text-xl font-bold bg-secondary/50 border border-border/60 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                  autoFocus
                />
                
                {/* Raccourcis rapides */}
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  {[0, 5000, 10000, 20000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningAmountInput(amt)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                        openingAmountInput === amt 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "border-border/60 hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {amt === 0 ? "0 F" : formatPrice(amt)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleStartSession}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all shadow-md"
              >
                Valider l&apos;ouverture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2 : CLÔTURE DE CAISSE (COMPTAGE & CALCUL D'ÉCART)        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCloseModal && activeCashSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card border border-border/60 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Clôture de Caisse (Rapport Z)</h3>
                  <p className="text-xs text-muted-foreground">Comptage physique et certification de fin de shift</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCloseModal(false)}
                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Récapitulatif attendu */}
            <div className="rounded-2xl bg-secondary/30 border border-border/40 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Fond de caisse initial</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.opening)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ventes Espèces (Comptant)</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.cashSalesOnly)}</span>
              </div>
              {currentSessionStats.creditDeposits > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                  <span>Acomptes Ventes à Crédit (Espèces)</span>
                  <span className="font-bold">+{formatPrice(currentSessionStats.creditDeposits)}</span>
                </div>
              )}
              {currentSessionStats.debtRecoveries > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Recouvrements Dettes (Espèces)</span>
                  <span className="font-bold">+{formatPrice(currentSessionStats.debtRecoveries)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground font-semibold pt-1 border-t border-border/20">
                <span>Total Espèces Encaissées au Tiroir</span>
                <span className="font-bold text-foreground">+{formatPrice(currentSessionStats.cash)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ventes Mobile Money</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.mm)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ventes Carte</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.card)}</span>
              </div>
              {currentSessionStats.creditRemaining > 0 && (
                <div className="flex justify-between text-purple-600 dark:text-purple-400 text-[11px] pt-1 border-t border-border/20">
                  <span>Crédits en attente (Reste dû non perçu)</span>
                  <span className="font-bold">{formatPrice(currentSessionStats.creditRemaining)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-border/40 flex justify-between font-bold text-sm">
                <span>Espèces Théoriques Attendues dans le tiroir</span>
                <span className="text-primary font-black">
                  {formatPrice(currentSessionStats.expectedCashInDrawer)}
                </span>
              </div>
            </div>

            {/* Saisie montant réel */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Espèces réelles comptées dans le tiroir ({state.settings.currency})</span>
                <span className="text-[10px] text-muted-foreground font-normal">Comptez vos billets et pièces</span>
              </label>
              <input
                type="number"
                placeholder="Ex: 50000"
                value={closingAmountInput}
                onChange={(e) => setClosingAmountInput(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full text-2xl font-black bg-secondary/50 border border-border/60 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                autoFocus
              />

              {/* Indicateur d'Écart en temps réel */}
              {closingAmountInput !== "" && (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  calculatedDifference === 0 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : calculatedDifference > 0
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}>
                  <div className="flex items-center gap-2">
                    {calculatedDifference === 0 ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : calculatedDifference > 0 ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    <div>
                      <p className="text-xs font-bold">
                        {calculatedDifference === 0 
                          ? "Caisse Juste (Aucun écart)" 
                          : calculatedDifference > 0 
                          ? "Excédent de caisse" 
                          : "Déficit de caisse (Manquant)"}
                      </p>
                      <p className="text-[10px] opacity-80">
                        {calculatedDifference === 0 
                          ? "Les montants théorique et réel correspondent exactement."
                          : calculatedDifference > 0 
                          ? "Le tiroir contient plus d'argent que prévu."
                          : "Attention : il manque de l'argent par rapport aux ventes saisies."}
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-black">
                    {calculatedDifference > 0 ? "+" : ""}{formatPrice(calculatedDifference)}
                  </span>
                </div>
              )}
            </div>

            {/* Notes / Remarques */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Remarques / Observations (facultatif)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Monnaie manquante de 500 F due à une erreur de rendu..."
                value={closingNotesInput}
                onChange={(e) => setClosingNotesInput(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-none"
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-border/40">
              <button
                type="button"
                disabled={isClosingSubmitting}
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={closingAmountInput === "" || isClosingSubmitting}
                onClick={handleConfirmClose}
                className="flex-[1.5] py-2.5 rounded-xl bg-destructive text-white hover:opacity-90 disabled:opacity-50 text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                {isClosingSubmitting ? "Clôture en cours..." : "Valider la Clôture & Voir Z"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3 : RAPPORT Z OFFICIEL D'IMPRESSION (TICKET THERMIQUE) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRapportZModal && selectedZSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white text-gray-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden my-8 animate-scale-in">
            {/* Header d'actions */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 print:hidden">
              <h3 className="text-sm font-bold text-gray-800">Rapport Z de Clôture</h3>
              <button 
                onClick={() => setShowRapportZModal(false)}
                className="h-8 w-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Document imprimable 80mm */}
            <div ref={rapportZRef} className="p-6 bg-white font-mono text-xs leading-relaxed">
              <div className="text-center pb-4 border-b border-dashed border-gray-400">
                <h2 className="text-base font-black uppercase tracking-wider">{state.settings.name}</h2>
                {state.settings.city && <p className="text-[11px] text-gray-600">{state.settings.city}, {state.settings.country}</p>}
                {state.settings.phone && <p className="text-[11px] text-gray-600">Tél: {state.settings.phone}</p>}
                <div className="mt-3 py-1 bg-gray-100 rounded text-center">
                  <p className="font-black text-sm uppercase tracking-widest">RAPPORT Z DE CLÔTURE</p>
                  <p className="text-[10px] text-gray-500">Document Officiel de Caisse</p>
                </div>
              </div>

              {/* Infos session */}
              <div className="py-3 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Caissier :</span>
                  <span className="font-bold">{selectedZSession.cashierName || "Caissier"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ouverture :</span>
                  <span>{new Date(selectedZSession.openedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clôture :</span>
                  <span>{selectedZSession.closedAt ? new Date(selectedZSession.closedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nombre Ventes :</span>
                  <span className="font-bold">{selectedZSession.totalSalesCount} transactions</span>
                </div>
              </div>

              {/* Détail financier */}
              <div className="py-3 border-b border-dashed border-gray-400 space-y-1.5 text-[11px]">
                <p className="font-bold text-[10px] uppercase text-gray-500">Recettes par Mode :</p>
                <div className="flex justify-between">
                  <span>Espèces (Comptant) :</span>
                  <span className="font-bold">{formatPrice(selectedZStats ? selectedZStats.cashSalesOnly : selectedZSession.totalCashSales)}</span>
                </div>
                {selectedZStats && selectedZStats.creditDeposits > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>Acomptes Crédits (Espèces) :</span>
                    <span className="font-bold">+{formatPrice(selectedZStats.creditDeposits)}</span>
                  </div>
                )}
                {selectedZStats && selectedZStats.debtRecoveries > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Recouvrements Dettes :</span>
                    <span className="font-bold">+{formatPrice(selectedZStats.debtRecoveries)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total Espèces Tiroir :</span>
                  <span className="font-black">{formatPrice(selectedZSession.totalCashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mobile Money :</span>
                  <span className="font-bold">{formatPrice(selectedZSession.totalMobileMoneySales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Carte Bancaire :</span>
                  <span className="font-bold">{formatPrice(selectedZSession.totalCardSales)}</span>
                </div>
                {selectedZStats && selectedZStats.creditTotal > 0 && (
                  <div className="flex justify-between text-purple-700 text-[10px]">
                    <span>Ventes à Crédit (Total) :</span>
                    <span className="font-semibold">{formatPrice(selectedZStats.creditTotal)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-gray-200 flex justify-between font-black text-sm">
                  <span>TOTAL VENTES :</span>
                  <span>{formatPrice(selectedZSession.totalSalesAmount)}</span>
                </div>
                {selectedZStats && (
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>Total Réellement Encaissé :</span>
                    <span className="font-bold">{formatPrice(selectedZStats.totalCollected)}</span>
                  </div>
                )}
              </div>

              {/* Rapprochement de caisse */}
              <div className="py-3 border-b border-dashed border-gray-400 space-y-1.5 text-[11px]">
                <p className="font-bold text-[10px] uppercase text-gray-500">Contrôle Espèces :</p>
                <div className="flex justify-between">
                  <span>Fond initial :</span>
                  <span>{formatPrice(selectedZSession.openingAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Total Espèces encaissées :</span>
                  <span>{formatPrice(selectedZSession.totalCashSales)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>= Espèces attendues :</span>
                  <span>{formatPrice(selectedZSession.expectedAmount || 0)}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-gray-200">
                  <span>Espèces réelles :</span>
                  <span>{formatPrice(selectedZSession.closingAmount || 0)}</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1">
                  <span>ÉCART DE CAISSE :</span>
                  <span className={`${
                    (selectedZSession.difference || 0) === 0 ? "text-gray-900" : (selectedZSession.difference || 0) > 0 ? "text-green-700" : "text-red-700"
                  }`}>
                    {(selectedZSession.difference || 0) > 0 ? "+" : ""}{formatPrice(selectedZSession.difference || 0)}
                  </span>
                </div>
              </div>

              {/* Remarques */}
              {selectedZSession.notes && (
                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] text-gray-600">
                  <p className="font-bold text-gray-700">Observations :</p>
                  <p className="italic">{selectedZSession.notes}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-6 pb-2 grid grid-cols-2 gap-4 text-[10px] text-center text-gray-600">
                <div>
                  <p className="border-t border-gray-400 pt-1 font-bold">Visa Caissier</p>
                </div>
                <div>
                  <p className="border-t border-gray-400 pt-1 font-bold">Visa Gérant</p>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 print:hidden">
              <button
                type="button"
                disabled={isDownloadingRapportZ}
                onClick={handleDownloadRapportZ}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloadingRapportZ ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-700" />
                    <span>Téléchargement...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity shadow-md"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer
              </button>
              <button
                type="button"
                onClick={() => setShowRapportZModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <X className="h-3.5 w-3.5" />
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 4 : RAPPORT X PROVISOIRE (POINT EN COURS DE JOURNÉE)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRapportXModal && activeCashSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card border border-border/60 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Rapport X (Point d&apos;étape)</h3>
                  <p className="text-xs text-muted-foreground">Consultation provisoire sans fermeture de caisse</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRapportXModal(false)}
                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-secondary/30 border border-border/40 p-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caissier :</span>
                <span className="font-bold text-foreground">{activeCashSession.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ouverture le :</span>
                <span className="font-medium text-foreground">
                  {new Date(activeCashSession.openedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="pt-2 border-t border-border/40 flex justify-between">
                <span className="text-muted-foreground">Fond initial :</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.opening)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ventes Espèces (Comptant) :</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.cashSalesOnly)}</span>
              </div>
              {currentSessionStats.creditDeposits > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                  <span>Acomptes Crédits (Espèces) :</span>
                  <span className="font-bold">+{formatPrice(currentSessionStats.creditDeposits)}</span>
                </div>
              )}
              {currentSessionStats.debtRecoveries > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Recouvrements Dettes :</span>
                  <span className="font-bold">+{formatPrice(currentSessionStats.debtRecoveries)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/20">
                <span>Total Espèces Tiroir :</span>
                <span className="font-bold text-primary">+{formatPrice(currentSessionStats.cash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ventes Mobile Money :</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.mm)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ventes Carte :</span>
                <span className="font-semibold text-foreground">{formatPrice(currentSessionStats.card)}</span>
              </div>
              {currentSessionStats.creditTotal > 0 && (
                <div className="flex justify-between text-purple-600 dark:text-purple-400 text-xs">
                  <span>Ventes à Crédit (Total facturé) :</span>
                  <span className="font-semibold">{formatPrice(currentSessionStats.creditTotal)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-border/40 flex justify-between font-bold text-sm">
                <span>Total Chiffre d'Affaires ({currentSessionStats.count} ventes) :</span>
                <span className="text-primary font-black">{formatPrice(currentSessionStats.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Total Réellement Encaissé :</span>
                <span className="font-bold text-foreground">{formatPrice(currentSessionStats.totalCollected)}</span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Espèces théoriques dans le tiroir :</span>
                <span className="text-base">{formatPrice(currentSessionStats.expectedCashInDrawer)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowRapportXModal(false)}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Continuer le service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 5 : HISTORIQUE DES RAPPORTS Z                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card border border-border/60 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5 animate-scale-in my-8 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Historique des Clôtures (Rapports Z)</h3>
                  <p className="text-xs text-muted-foreground">Consultez et réimprimez les shifts passés</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {cashSessions.filter(cs => cs.status === "closed").length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucune clôture de caisse enregistrée pour le moment.
                </div>
              ) : (
                cashSessions
                  .filter(cs => cs.status === "closed")
                  .map((cs) => (
                    <div 
                      key={cs.id}
                      className="p-4 rounded-2xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{cs.cashierName || "Caissier"}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary font-medium text-muted-foreground">
                            {cs.totalSalesCount} ventes
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(cs.openedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          {" • "}
                          {new Date(cs.openedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {" → "}
                          {cs.closedAt ? new Date(cs.closedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "N/A"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-foreground text-sm">{formatPrice(cs.totalSalesAmount)}</p>
                          <p className={`text-[10px] font-bold ${
                            (cs.difference || 0) === 0 ? "text-emerald-600" : (cs.difference || 0) > 0 ? "text-blue-600" : "text-destructive"
                          }`}>
                            Écart: {(cs.difference || 0) > 0 ? "+" : ""}{formatPrice(cs.difference || 0)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedZSession(cs);
                            setShowHistoryModal(false);
                            setShowRapportZModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-colors shrink-0"
                        >
                          Voir Z
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-border/40 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
