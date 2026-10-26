"use client";

import React, { useState, useMemo, useRef } from "react";
import { useStore, Quote, QuoteItem, Sale, Product } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { getWhatsAppUrl, formatWhatsAppNumber } from "@/lib/whatsapp";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  CheckCircle2,
  ArrowRight,
  Printer,
  Share2,
  Eye,
  Calendar,
  User,
  Phone,
  Check,
  X,
  Clock,
  AlertCircle,
  ShoppingCart,
  Sparkles,
  Download,
  Building,
  CheckCircle,
  HelpCircle
} from "lucide-react";

export default function QuotesPage() {
  const { role, activeStore } = useAuth();
  const { state, dispatch, formatPrice } = useStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card" | "credit">("cash");

  // Formulaire Devis
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [validityDays, setValidityDays] = useState(15);
  const [notes, setNotes] = useState("Offre valable 15 jours. Paiement à réception.");
  const [discount, setDiscount] = useState(0);
  const [formItems, setFormItems] = useState<
    {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
      unitName: string;
      unitMultiplier: number;
    }[]
  >([]);

  // Sélecteur d'article rapide
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedUnitName, setSelectedUnitName] = useState("Unité");
  const [itemQty, setItemQty] = useState(1);
  const [itemCustomPrice, setItemCustomPrice] = useState<number | "">("");

  const printRef = useRef<HTMLDivElement>(null);

  // Filtrage des devis
  const filteredQuotes = useMemo(() => {
    return (state.quotes || []).filter((q) => {
      const matchSearch =
        q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
        q.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (q.customerPhone || "").includes(search);
      const matchStatus = statusFilter === "all" || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [state.quotes, search, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const list = state.quotes || [];
    const totalCount = list.length;
    const pendingTotal = list
      .filter((q) => q.status === "draft" || q.status === "sent" || q.status === "accepted")
      .reduce((sum, q) => sum + q.total, 0);
    const convertedList = list.filter((q) => q.status === "converted");
    const convertedTotal = convertedList.reduce((sum, q) => sum + q.total, 0);
    const conversionRate = totalCount > 0 ? Math.round((convertedList.length / totalCount) * 100) : 0;

    return { totalCount, pendingTotal, convertedTotal, conversionRate };
  }, [state.quotes]);

  // Ajouter un article au devis en cours
  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = state.products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    let unitMultiplier = 1;
    let basePrice = prod.price;

    if (selectedUnitName !== "Unité" && Array.isArray(prod.units)) {
      const u = prod.units.find((unit) => unit.name === selectedUnitName);
      if (u) {
        unitMultiplier = u.multiplier;
        if (u.price && u.price > 0) basePrice = u.price;
        else basePrice = prod.price * u.multiplier;
      }
    }

    const finalUnitPrice = itemCustomPrice !== "" ? Number(itemCustomPrice) : basePrice;
    const lineTotal = finalUnitPrice * itemQty;

    setFormItems([
      ...formItems,
      {
        productId: prod.id,
        productName: prod.name,
        quantity: itemQty,
        unitPrice: finalUnitPrice,
        total: lineTotal,
        unitName: selectedUnitName,
        unitMultiplier,
      },
    ]);

    // Réinitialiser le sélecteur
    setSelectedProductId("");
    setSelectedUnitName("Unité");
    setItemQty(1);
    setItemCustomPrice("");
  };

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const computedSubtotal = useMemo(() => {
    return formItems.reduce((sum, it) => sum + it.total, 0);
  }, [formItems]);

  const computedTotal = useMemo(() => {
    return Math.max(0, computedSubtotal - discount);
  }, [computedSubtotal, discount]);

  // Ouvrir modal création
  const handleOpenCreate = () => {
    setEditingQuote(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setValidityDays(15);
    setNotes("Offre valable 15 jours. Paiement à réception.");
    setDiscount(0);
    setFormItems([]);
    setShowModal(true);
  };

  // Ouvrir modal édition
  const handleOpenEdit = (q: Quote) => {
    setEditingQuote(q);
    setCustomerName(q.customerName);
    setCustomerPhone(q.customerPhone || "");
    setCustomerAddress(q.customerAddress || "");
    setNotes(q.notes || "");
    setDiscount(q.discount);
    setFormItems(
      q.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
        unitName: it.unitName || "Unité",
        unitMultiplier: it.unitMultiplier || 1,
      }))
    );
    setShowModal(true);
  };

  // Sauvegarder devis
  const handleSaveQuote = (statusToSave: "draft" | "sent" = "draft") => {
    if (!customerName.trim()) {
      alert("Veuillez saisir le nom du client.");
      return;
    }
    if (formItems.length === 0) {
      alert("Veuillez ajouter au moins un article au devis.");
      return;
    }

    const now = new Date();
    const validityDate = new Date(now.getTime() + validityDays * 24 * 3600 * 1000).toISOString().split("T")[0];
    const quoteId = editingQuote ? editingQuote.id : "quote_" + Date.now().toString(36);
    const quoteNumber = editingQuote
      ? editingQuote.quoteNumber
      : `DEV-${now.getFullYear()}-${String((state.quotes || []).length + 1).padStart(3, "0")}`;

    const items: QuoteItem[] = formItems.map((it, idx) => ({
      id: `${quoteId}_item_${idx + 1}`,
      quoteId,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.total,
      unitName: it.unitName,
      unitMultiplier: it.unitMultiplier,
    }));

    const quoteToSave: Quote = {
      id: quoteId,
      storeId: activeStore?.id || "",
      userId: null,
      quoteNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      customerAddress: customerAddress.trim() || null,
      subtotal: computedSubtotal,
      tax: 0,
      discount,
      total: computedTotal,
      status: editingQuote ? editingQuote.status : statusToSave,
      validityDate,
      notes: notes.trim() || null,
      saleId: editingQuote ? editingQuote.saleId : null,
      createdAt: editingQuote ? editingQuote.createdAt : now.toISOString(),
      updatedAt: now.toISOString(),
      items,
    };

    if (editingQuote) {
      dispatch({ type: "UPDATE_QUOTE", payload: quoteToSave });
    } else {
      dispatch({ type: "ADD_QUOTE", payload: quoteToSave });
    }

    setShowModal(false);
  };

  // Suppression
  const handleDeleteQuote = (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer ce devis ?")) {
      dispatch({ type: "DELETE_QUOTE", payload: id });
    }
  };

  // Conversion en Vente Directe
  const handleConfirmConvert = () => {
    if (!convertingQuote) return;

    const q = convertingQuote;
    const saleId = "sale_" + Date.now();
    const nowIso = new Date().toISOString();

    const saleItems = q.items.map((it, idx) => ({
      id: `si_${Date.now()}_${idx}`,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.total,
      unitName: it.unitName || "Unité",
      unitMultiplier: it.unitMultiplier || 1,
      quantityReference: it.quantity * (it.unitMultiplier || 1),
    }));

    const isCredit = paymentMethod === "credit";
    const amountPaid = isCredit ? 0 : q.total;
    const remainingAmount = isCredit ? q.total : 0;
    const paymentStatus = isCredit ? "unpaid" : "paid";

    const sale: Sale = {
      id: saleId,
      items: saleItems,
      subtotal: q.subtotal,
      tax: q.tax,
      discount: q.discount,
      total: q.total,
      amountPaid,
      remainingAmount,
      paymentStatus: paymentStatus as any,
      paymentMethod,
      customerName: q.customerName,
      customerPhone: q.customerPhone || undefined,
      createdAt: nowIso,
    };

    dispatch({
      type: "CONVERT_QUOTE_TO_SALE",
      payload: { quoteId: q.id, sale },
    });

    setConvertingQuote(null);
    alert(`Devis ${q.quoteNumber} converti avec succès en Vente directe #${saleId.slice(-6)} !`);
  };

  // Partage WhatsApp
  const handleShareWhatsApp = (q: Quote) => {
    const storeName = state.settings.name || "MaBoutiquePro";
    const lines = [
      `📄 *DEVIS / FACTURE PROFORMA*`,
      `🏬 *${storeName}*`,
      `🔢 *N° Devis :* ${q.quoteNumber}`,
      `👤 *Client :* ${q.customerName}`,
      `📅 *Date :* ${new Date(q.createdAt).toLocaleDateString("fr-FR")}`,
      `⏳ *Validité :* jusqu'au ${q.validityDate ? new Date(q.validityDate).toLocaleDateString("fr-FR") : "30 jours"}`,
      ``,
      `*Détail des articles :*`,
      ...q.items.map(
        (it) => `• ${it.productName} (${it.unitName || "Unité"}) : ${it.quantity} x ${formatPrice(it.unitPrice)} = *${formatPrice(it.total)}*`
      ),
      ``,
      q.discount > 0 ? `💰 *Sous-total :* ${formatPrice(q.subtotal)}\n🎁 *Remise :* -${formatPrice(q.discount)}` : "",
      `💵 *TOTAL NET : ${formatPrice(q.total)}*`,
      ``,
      q.notes ? `📝 *Conditions :* ${q.notes}` : "",
      `📞 Pour confirmer votre commande, contactez-nous au ${state.settings.phone || ""}. Merci de votre confiance !`
    ].filter(Boolean).join("\n");

    const phone = q.customerPhone || "";
    const url = getWhatsAppUrl(phone, lines);
    window.open(url, "_blank");
  };

  const [downloadingQuoteId, setDownloadingQuoteId] = useState<string | null>(null);

  // Téléchargement direct en PDF A4 professionnel
  const handleDownloadPDF = (q: Quote) => {
    try {
      setDownloadingQuoteId(q.id);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Entête Magasin
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(state.settings.name || "MaBoutiquePro", 14, 20);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const location = [state.settings.city || "Lomé", state.settings.country || "Togo"].filter(Boolean).join(" • ");
      doc.text(location, 14, 25);
      if (state.settings.phone) doc.text(`Tél : ${state.settings.phone}`, 14, 29);
      if (state.settings.email) doc.text(`Email : ${state.settings.email}`, 14, 33);

      // Titre Document Facture Proforma & Numéro
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(99, 67, 234); // Teinte violette officielle
      doc.text("FACTURE PROFORMA", 196, 20, { align: "right" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(`N° ${q.quoteNumber}`, 196, 26, { align: "right" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Date : ${new Date(q.createdAt).toLocaleDateString("fr-FR")}`, 196, 31, { align: "right" });
      if (q.validityDate) {
        doc.text(`Validité : ${new Date(q.validityDate).toLocaleDateString("fr-FR")}`, 196, 35, { align: "right" });
      }

      // Encadré Destinataire / Client
      doc.setDrawColor(220, 220, 230);
      doc.setFillColor(248, 248, 252);
      doc.roundedRect(14, 39, 182, 22, 3, 3, "FD");

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.text("DESTINATAIRE / CLIENT :", 18, 45);

      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(q.customerName, 18, 51);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const clientDetails = [
        q.customerPhone ? `Tél : ${q.customerPhone}` : "",
        q.customerAddress ? `Adresse : ${q.customerAddress}` : "",
      ].filter(Boolean).join("  •  ");
      if (clientDetails) {
        doc.text(clientDetails, 18, 56);
      }

      // Tableau des articles
      const tableData = q.items.map((it) => [
        it.productName,
        it.unitName || "Unité",
        it.quantity.toString(),
        formatPrice(it.unitPrice).replace(/[  ]/g, " "),
        formatPrice(it.total).replace(/[  ]/g, " "),
      ]);

      autoTable(doc, {
        startY: 66,
        head: [["Désignation", "Conditionnement", "Quantité", "Prix Unitaire", "Total Net"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [99, 67, 234],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        styles: {
          fontSize: 9,
          cellPadding: 3.5,
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 35 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 27, halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 120;

      // Bloc des totaux chiffrés
      const totalsY = finalY + 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Sous-total HT :", 135, totalsY);
      doc.text(formatPrice(q.subtotal).replace(/[  ]/g, " "), 196, totalsY, { align: "right" });

      let offset = 0;
      if (q.discount > 0) {
        offset += 5;
        doc.setTextColor(220, 38, 38);
        doc.text("Remise accordée :", 135, totalsY + offset);
        doc.text(`-${formatPrice(q.discount).replace(/[  ]/g, " ")}`, 196, totalsY + offset, { align: "right" });
      }

      offset += 6;
      doc.setDrawColor(200, 200, 200);
      doc.line(135, totalsY + offset - 2, 196, totalsY + offset - 2);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text("NET À PAYER :", 135, totalsY + offset + 3);
      doc.text(formatPrice(q.total).replace(/[  ]/g, " "), 196, totalsY + offset + 3, { align: "right" });

      // Notes & Modalités
      const notesY = Math.max(totalsY + offset + 14, finalY + 22);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(110, 110, 110);
      doc.text(`Conditions : ${q.notes || "Offre valable sous réserve de disponibilité des stocks. Paiement à réception."}`, 14, notesY);

      // Signatures
      const sigY = notesY + 14;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(70, 70, 70);
      doc.text("Mention bon pour accord (Client) :", 14, sigY);
      doc.text("Cachet & Signature (Fournisseur) :", 196, sigY, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setTextColor(140, 140, 140);
      doc.text("Date et signature :", 14, sigY + 10);
      doc.text(state.settings.managerName || "La Direction", 196, sigY + 10, { align: "right" });

      doc.save(`Devis_${q.quoteNumber}.pdf`);
    } catch (err) {
      console.error("Erreur génération PDF Devis:", err);
      alert("Une erreur est survenue lors de la génération du PDF.");
    } finally {
      setDownloadingQuoteId(null);
    }
  };

  // Impression
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Badge Statut
  const getStatusBadge = (status: Quote["status"]) => {
    switch (status) {
      case "draft":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border/60">Brouillon</span>;
      case "sent":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">Envoyé</span>;
      case "accepted":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Accepté</span>;
      case "converted":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Vente effectuée</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">Refusé</span>;
      case "expired":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">Expiré</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Devis & Factures Proforma
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Établissez des devis professionnels et transformez-les en ventes directes en 1 clic.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-all hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          Nouveau Devis / Proforma
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total Devis Émis</p>
          <p className="text-xl font-bold text-foreground mt-1">{stats.totalCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Historique global</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Montant en Attente</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{formatPrice(stats.pendingTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Devis envoyés ou acceptés</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">CA Converti en Vente</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatPrice(stats.convertedTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Ventes concrétisées</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Taux de Conversion</p>
          <p className="text-xl font-bold text-purple-600 mt-1">{stats.conversionRate}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Succès des propositions</p>
        </div>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par N° de devis, client ou téléphone..."
            className="w-full rounded-xl border border-border/60 bg-secondary/30 pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Tous" },
            { key: "draft", label: "Brouillons" },
            { key: "sent", label: "Envoyés" },
            { key: "accepted", label: "Acceptés" },
            { key: "converted", label: "Convertis" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des Devis */}
      {filteredQuotes.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border/60 bg-card/40 p-8">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Aucun devis trouvé</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "all"
              ? "Aucun résultat pour vos filtres de recherche."
              : "Créez votre premier devis ou proposition commerciale dès maintenant."}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nouveau Devis
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((q) => (
            <div
              key={q.id}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
            >
              <div className="space-y-3">
                {/* Header carte */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-primary font-mono">{q.quoteNumber}</span>
                    <h3 className="text-sm font-bold text-foreground mt-0.5 truncate">{q.customerName}</h3>
                    {q.customerPhone && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {q.customerPhone}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(q.status)}
                </div>

                {/* Détail articles */}
                <div className="rounded-xl bg-secondary/30 p-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground font-medium text-[11px]">
                    <span>{q.items.length} article(s)</span>
                    <span>Émis le {new Date(q.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div className="divide-y divide-border/30 max-h-24 overflow-y-auto no-scrollbar">
                    {q.items.map((it) => (
                      <div key={it.id} className="py-1 flex justify-between items-center text-[11px]">
                        <span className="truncate max-w-[160px] text-foreground font-medium">
                          {it.quantity}x {it.productName}
                        </span>
                        <span className="text-muted-foreground">{formatPrice(it.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Montant total */}
                <div className="flex justify-between items-center pt-1 border-t border-border/40">
                  <span className="text-xs font-medium text-muted-foreground">Total Devis</span>
                  <span className="text-base font-black text-foreground">{formatPrice(q.total)}</span>
                </div>
              </div>

              {/* Boutons d'actions */}
              <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewingQuote(q)}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Aperçu & Impression A4"
                  >
                    <Printer className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDownloadPDF(q)}
                    disabled={downloadingQuoteId === q.id}
                    className="p-1.5 rounded-lg hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 transition-colors"
                    title="Télécharger en PDF A4"
                  >
                    <Download className={`h-4 w-4 ${downloadingQuoteId === q.id ? "animate-bounce text-purple-600" : ""}`} />
                  </button>

                  <button
                    onClick={() => handleShareWhatsApp(q)}
                    className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-colors"
                    title="Envoyer via WhatsApp"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>

                  {q.status !== "converted" && (
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                      title="Modifier"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}

                  {q.status !== "converted" && (
                    <button
                      onClick={() => handleDeleteQuote(q.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Bouton Magique : Convertir en Vente */}
                {q.status !== "converted" ? (
                  <button
                    onClick={() => setConvertingQuote(q)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm hover:scale-[1.02] transition-transform"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Convertir en Vente
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-purple-600 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Vente conclue
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CRÉATION / ÉDITION DE DEVIS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in overflow-hidden border border-border/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/50 bg-secondary/10">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {editingQuote ? `Modifier le devis ${editingQuote.quoteNumber}` : "Nouveau Devis / Facture Proforma"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-secondary rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5 no-scrollbar">
              {/* Coordonnées Client */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nom du Client *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Entreprise SOTRA / Jean"
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Téléphone / WhatsApp</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+228 90 00 00 00"
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Validité de l&apos;offre</label>
                  <select
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value={7}>7 jours</option>
                    <option value={15}>15 jours</option>
                    <option value={30}>30 jours</option>
                    <option value={60}>60 jours</option>
                  </select>
                </div>
              </div>

              {/* Sélecteur d'articles */}
              <div className="p-4 rounded-xl border border-border/60 bg-secondary/10 space-y-3">
                <p className="text-xs font-bold text-foreground">Ajouter des articles au devis</p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setSelectedUnitName("Unité");
                        const p = state.products.find((prod) => prod.id === e.target.value);
                        if (p) setItemCustomPrice(p.price);
                      }}
                      className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Sélectionner un article...</option>
                      {state.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatPrice(p.price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Conditionnement multiple */}
                  <div className="sm:col-span-3">
                    <select
                      value={selectedUnitName}
                      onChange={(e) => {
                        setSelectedUnitName(e.target.value);
                        const p = state.products.find((prod) => prod.id === selectedProductId);
                        if (p) {
                          if (e.target.value === "Unité") setItemCustomPrice(p.price);
                          else {
                            const u = (p.units || []).find((unit) => unit.name === e.target.value);
                            if (u && u.price && u.price > 0) setItemCustomPrice(u.price);
                            else if (u) setItemCustomPrice(p.price * u.multiplier);
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-border/60 bg-card px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Unité">Unité (Pièce)</option>
                      {selectedProductId &&
                        (state.products.find((p) => p.id === selectedProductId)?.units || []).map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name} (x{u.multiplier})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={itemQty}
                      onChange={(e) => setItemQty(Math.max(1, Number(e.target.value)))}
                      placeholder="Qté"
                      className="w-full rounded-xl border border-border/60 bg-card px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProductId}
                      className="w-full h-full flex items-center justify-center gap-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Tableau des lignes */}
              {formItems.length > 0 && (
                <div className="border border-border/50 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="p-2.5 font-semibold">Article</th>
                        <th className="p-2.5 font-semibold">Unité</th>
                        <th className="p-2.5 font-semibold text-center">Quantité</th>
                        <th className="p-2.5 font-semibold text-right">Prix Unit.</th>
                        <th className="p-2.5 font-semibold text-right">Total</th>
                        <th className="p-2.5 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {formItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-secondary/10">
                          <td className="p-2.5 font-medium text-foreground">{it.productName}</td>
                          <td className="p-2.5 text-muted-foreground">{it.unitName}</td>
                          <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                          <td className="p-2.5 text-right">{formatPrice(it.unitPrice)}</td>
                          <td className="p-2.5 text-right font-bold text-foreground">{formatPrice(it.total)}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-destructive/70 hover:text-destructive p-1 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Récapitulatif financier */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Notes & Conditions</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Conditions de livraison, validité, etc."
                  />
                </div>

                <div className="w-full sm:w-64 space-y-2 rounded-xl bg-secondary/20 p-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Sous-total HT :</span>
                    <span className="font-semibold">{formatPrice(computedSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Remise globale :</span>
                    <input
                      type="number"
                      min={0}
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      className="w-24 text-right rounded-lg border border-border/60 bg-card px-2 py-0.5 text-xs font-semibold"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/40 font-bold text-sm text-foreground">
                    <span>Net à Payer :</span>
                    <span className="text-primary text-base">{formatPrice(computedTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div className="p-4 border-t border-border/50 bg-secondary/10 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-border/60 hover:bg-secondary"
              >
                Annuler
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveQuote("draft")}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary text-foreground hover:bg-secondary/80"
                >
                  Enregistrer Brouillon
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveQuote("sent")}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                >
                  Valider & Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONVERSION EN VENTE DIRECTE */}
      {convertingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setConvertingQuote(null)}>
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl p-6 border border-border/50 space-y-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Convertir en Vente Directe</h3>
                <p className="text-xs text-muted-foreground">Devis {convertingQuote.quoteNumber} • {convertingQuote.customerName}</p>
              </div>
            </div>

            <div className="rounded-xl bg-secondary/30 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Articles :</span>
                <span className="font-semibold">{convertingQuote.items.length} lignes</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/30">
                <span>Montant à encaisser :</span>
                <span className="text-emerald-600 font-black">{formatPrice(convertingQuote.total)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Mode d&apos;encaissement</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "cash", label: "Espèces (Caisse)" },
                  { key: "mobile_money", label: "Mobile Money" },
                  { key: "card", label: "Carte Bancaire" },
                  { key: "credit", label: "À Crédit (Dette)" },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.key as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      paymentMethod === m.key
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                        : "border-border/60 hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConvertingQuote(null)}
                className="flex-1 py-2.5 rounded-xl border border-border/60 text-xs font-semibold hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Confirmer la Vente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL APERÇU FACTURE PROFORMA / IMPRESSION A4 */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" onClick={() => setViewingQuote(null)}>
          <div className="w-full max-w-3xl bg-card rounded-2xl shadow-2xl flex flex-col my-auto border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Barre d'outils */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-secondary/20">
              <span className="text-xs font-bold text-muted-foreground">Aperçu Facture Proforma / Devis A4</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF(viewingQuote)}
                  disabled={downloadingQuoteId === viewingQuote.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-xs transition-all"
                  title="Télécharger directement la facture proforma en fichier PDF A4"
                >
                  <Download className={`h-3.5 w-3.5 ${downloadingQuoteId === viewingQuote.id ? "animate-bounce" : ""}`} />
                  <span>{downloadingQuoteId === viewingQuote.id ? "Génération..." : "Télécharger PDF"}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimer
                </button>
                <button
                  onClick={() => handleShareWhatsApp(viewingQuote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:opacity-90"
                >
                  <Share2 className="h-3.5 w-3.5" /> WhatsApp
                </button>
                <button onClick={() => setViewingQuote(null)} className="p-1.5 hover:bg-secondary rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Proforma Imprimable */}
            <div ref={printRef} className="p-8 bg-white text-black space-y-6 text-xs font-sans print:p-0 print:m-0">
              {/* Entête */}
              <div className="flex justify-between items-start border-b pb-4 border-gray-200">
                <div>
                  <h1 className="text-xl font-black uppercase text-gray-900 tracking-wide">
                    {state.settings.name || "MaBoutiquePro"}
                  </h1>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    {state.settings.city || "Lomé"} • {state.settings.country || "Togo"}
                  </p>
                  <p className="text-gray-600 text-[11px]">Tél : {state.settings.phone || ""}</p>
                  <p className="text-gray-600 text-[11px]">{state.settings.email || ""}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-gray-100 border border-gray-300 rounded font-black text-sm uppercase text-gray-800">
                    FACTURE PROFORMA
                  </span>
                  <p className="text-gray-800 font-bold text-xs mt-2 font-mono">N° {viewingQuote.quoteNumber}</p>
                  <p className="text-gray-500 text-[10px]">Date : {new Date(viewingQuote.createdAt).toLocaleDateString("fr-FR")}</p>
                  {viewingQuote.validityDate && (
                    <p className="text-gray-500 text-[10px]">Validité : {new Date(viewingQuote.validityDate).toLocaleDateString("fr-FR")}</p>
                  )}
                </div>
              </div>

              {/* Destinataire */}
              <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                <p className="text-[10px] font-bold uppercase text-gray-500">Destinataire / Client :</p>
                <p className="text-sm font-black text-gray-900 mt-0.5">{viewingQuote.customerName}</p>
                {viewingQuote.customerPhone && <p className="text-gray-600 text-[11px]">Tél : {viewingQuote.customerPhone}</p>}
                {viewingQuote.customerAddress && <p className="text-gray-600 text-[11px]">Adresse : {viewingQuote.customerAddress}</p>}
              </div>

              {/* Tableau Articles */}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 text-gray-600 uppercase text-[10px] tracking-wider">
                    <th className="py-2 font-black">Désignation</th>
                    <th className="py-2 font-black">Conditionnement</th>
                    <th className="py-2 text-center font-black">Quantité</th>
                    <th className="py-2 text-right font-black">Prix Unitaire</th>
                    <th className="py-2 text-right font-black">Total Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-800">
                  {viewingQuote.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-semibold">{it.productName}</td>
                      <td className="py-2 text-gray-500">{it.unitName || "Unité"}</td>
                      <td className="py-2 text-center font-bold">{it.quantity}</td>
                      <td className="py-2 text-right">{formatPrice(it.unitPrice)}</td>
                      <td className="py-2 text-right font-black">{formatPrice(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totaux & Conditions */}
              <div className="flex justify-between items-start pt-2 border-t border-gray-200">
                <div className="max-w-xs space-y-1">
                  <p className="font-bold text-gray-700 text-[11px]">Conditions & Modalités :</p>
                  <p className="text-gray-500 text-[10px] italic">
                    {viewingQuote.notes || "Offre valable sous réserve de disponibilité des stocks. Paiement à réception."}
                  </p>
                </div>

                <div className="w-56 space-y-1.5 text-right">
                  <div className="flex justify-between text-gray-600 text-[11px]">
                    <span>Sous-total HT :</span>
                    <span className="font-semibold">{formatPrice(viewingQuote.subtotal)}</span>
                  </div>
                  {viewingQuote.discount > 0 && (
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Remise accordée :</span>
                      <span className="font-semibold text-rose-600">-{formatPrice(viewingQuote.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-300 pt-1.5 text-gray-900 font-black text-sm">
                    <span>NET À PAYER :</span>
                    <span className="text-base text-gray-900">{formatPrice(viewingQuote.total)}</span>
                  </div>
                </div>
              </div>

              {/* Signature & Cachet */}
              <div className="pt-8 flex justify-between text-[11px] text-gray-500 border-t border-gray-200">
                <div>
                  <p className="font-bold text-gray-700">Mention bon pour accord (Client) :</p>
                  <p className="mt-8 text-gray-400">Date et signature :</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-700">Cachet & Signature (Fournisseur) :</p>
                  <p className="mt-8 text-gray-400 font-semibold">{state.settings.managerName || "La Direction"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
