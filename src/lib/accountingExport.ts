import * as XLSX from "xlsx";
import { Sale, Expense, Product } from "@/context/StoreContext";

export type ExportFormat = "excel" | "csv";

export interface DateFilterOptions {
  period?: "all" | "today" | "week" | "month" | "last_month" | "custom";
  startDate?: string;
  endDate?: string;
  sortOrder?: "asc" | "desc";
}

// ─── 1. Téléchargement Universel de Fichier ───────────────────
export function triggerFileDownload(content: string, filename: string, mimeType: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 2. Générateur CSV Professionnel (UTF-8 BOM + Point-Virgule)
export function generateCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const sanitizeCell = (cell: string | number): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [];
  lines.push(headers.map(sanitizeCell).join(";"));
  for (const row of rows) {
    lines.push(row.map(sanitizeCell).join(";"));
  }

  // Préfixe \uFEFF (UTF-8 BOM) pour ouverture directe sans bug dans Microsoft Excel
  const csvContent = "\uFEFF" + lines.join("\r\n");
  triggerFileDownload(csvContent, filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv;charset=utf-8;");
}

// ─── 3. Générateur Excel Structuré (.xls XML) ─────────────────
// ─── 3. Générateur Microsoft Excel Natif (.xlsx Binaire Standard) ───
// ─── Helpers Horodatage & Dates Locales Fiables ─────────────
export function parseSafeTimestamp(raw?: string | null): number {
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return isNaN(t) ? 0 : t;
}

export function getLocalISODate(raw?: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    return raw.split("T")[0] || "";
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateExcel(
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  totalsRow?: (string | number)[]
) {
  // Créer un vrai classeur Excel binaire OpenXML compatible 100% Microsoft Office, Excel Online & Mobile
  const wb = XLSX.utils.book_new();

  // Entête propre
  const sheetData: (string | number)[][] = [
    [sheetTitle],
    [`Document généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")} • MaBoutiquePro`],
    [], // ligne vide
    headers,
    ...rows,
  ];

  if (totalsRow) {
    sheetData.push(totalsRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Calcul intelligent des largeurs de colonnes pour lisibilité maximale
  const colWidths = headers.map((h, colIndex) => {
    let maxLen = String(h || "").length;
    for (const r of rows) {
      const cellVal = r[colIndex];
      if (cellVal !== undefined && cellVal !== null) {
        maxLen = Math.max(maxLen, String(cellVal).length);
      }
    }
    if (totalsRow && totalsRow[colIndex] !== undefined && totalsRow[colIndex] !== null) {
      maxLen = Math.max(maxLen, String(totalsRow[colIndex]).length);
    }
    return { wch: Math.max(maxLen + 4, 15) };
  });
  ws["!cols"] = colWidths;

  const cleanName = sheetTitle.substring(0, 31).replace(/[/\\?*\[\]]/g, "_") || "Données";
  XLSX.utils.book_append_sheet(wb, ws, cleanName);

  const finalName = filename.endsWith(".xlsx")
    ? filename
    : filename.endsWith(".xls")
    ? filename.replace(/\.xls$/, ".xlsx")
    : `${filename}.xlsx`;

  if (typeof window !== "undefined") {
    XLSX.writeFile(wb, finalName);
  }
}

export function filterItemsByPeriod<T extends { createdAt?: string; date?: string }>(
  items: T[],
  options?: DateFilterOptions
): T[] {
  if (!options || !options.period || options.period === "all") return items;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  return items.filter((item) => {
    const rawDate = item.createdAt || item.date;
    if (!rawDate) return false;
    const itemDate = getLocalISODate(rawDate);
    if (!itemDate) return false;

    if (options.period === "today") return itemDate === todayStr;
    if (options.period === "week") {
      const d = new Date(now);
      const currentDay = d.getDay();
      const diffToMonday = (currentDay + 6) % 7;
      d.setDate(d.getDate() - diffToMonday);
      d.setHours(0, 0, 0, 0);
      const monYear = d.getFullYear();
      const monMonth = String(d.getMonth() + 1).padStart(2, "0");
      const monDay = String(d.getDate()).padStart(2, "0");
      const mondayStr = `${monYear}-${monMonth}-${monDay}`;
      return itemDate >= mondayStr;
    }
    if (options.period === "month") {
      const currentMonth = `${year}-${month}`;
      return itemDate.startsWith(currentMonth);
    }
    if (options.period === "last_month") {
      const prevDate = new Date(year, now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      return itemDate.startsWith(prevMonth);
    }
    if (options.period === "custom") {
      if (options.startDate && itemDate < options.startDate) return false;
      if (options.endDate && itemDate > options.endDate) return false;
      return true;
    }
    return true;
  });
}

// ─── 5. Export Journal des Ventes ─────────────────────────────
export function exportSalesJournal(
  sales: Sale[],
  currency: string = "FCFA",
  format: ExportFormat = "excel",
  filter?: DateFilterOptions
) {
  // Tri chronologique strict par Date et Heure (par défaut : du matin au soir, jour après jour)
  const isDesc = filter?.sortOrder === "desc";
  const filtered = filterItemsByPeriod(sales, filter).sort((a, b) => {
    const timeA = parseSafeTimestamp(a.createdAt);
    const timeB = parseSafeTimestamp(b.createdAt);
    if (timeA !== timeB) {
      return isDesc ? timeB - timeA : timeA - timeB;
    }
    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  const dateSuffix = new Date().toISOString().split("T")[0];
  const filename = `journal_des_ventes_${dateSuffix}`;

  const headers = [
    "Date",
    "Heure",
    "N° Vente",
    "Client",
    "Articles Vendus",
    "Quantité Totale",
    `Sous-Total (${currency})`,
    `Remise (${currency})`,
    `Total Net (${currency})`,
    "Mode de Paiement",
  ];

  let sumQty = 0;
  let sumSubtotal = 0;
  let sumDiscount = 0;
  let sumTotal = 0;

  const rows = filtered.map((s) => {
    const d = s.createdAt ? new Date(s.createdAt) : null;
    const isValid = d && !isNaN(d.getTime());
    const dateStr = isValid ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
    const timeStr = isValid ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

    const totalQty = (s.items || []).reduce((acc, item) => acc + item.quantity, 0);
    const itemsDetail = (s.items || []).map((i) => `${i.productName} (x${i.quantity})`).join(", ");

    sumQty += totalQty;
    sumSubtotal += Number(s.subtotal) || 0;
    sumDiscount += Number(s.discount) || 0;
    sumTotal += Number(s.total) || 0;

    const paymentLabel = s.paymentMethod === "cash" 
      ? "Espèces" 
      : s.paymentMethod === "mobile_money" 
      ? "Mobile Money" 
      : "Carte Bancaire";

    return [
      dateStr,
      timeStr,
      s.id,
      s.customerName || "Client Comptoir",
      itemsDetail || "Articles divers",
      totalQty,
      Number(s.subtotal) || 0,
      Number(s.discount) || 0,
      Number(s.total) || 0,
      paymentLabel,
    ];
  });

  const totalsRow: (string | number)[] = [
    "TOTAL GÉNÉRAL",
    `${filtered.length} ventes`,
    "",
    "",
    "",
    sumQty,
    sumSubtotal,
    sumDiscount,
    sumTotal,
    "",
  ];

  if (format === "csv") {
    generateCSV(headers, [...rows, totalsRow], filename);
  } else {
    generateExcel("Journal des Ventes", headers, rows, filename, totalsRow);
  }
}

// ─── 6. Export Journal des Dépenses ───────────────────────────
export function exportExpensesJournal(
  expenses: Expense[],
  currency: string = "FCFA",
  format: ExportFormat = "excel",
  filter?: DateFilterOptions
) {
  // Tri chronologique strict par Date et Heure (par défaut : du plus ancien au plus récent)
  const isDesc = filter?.sortOrder === "desc";
  const filtered = filterItemsByPeriod(expenses, filter).sort((a, b) => {
    const rawA = a.createdAt || a.date;
    const rawB = b.createdAt || b.date;
    const timeA = parseSafeTimestamp(rawA);
    const timeB = parseSafeTimestamp(rawB);
    if (timeA !== timeB) {
      return isDesc ? timeB - timeA : timeA - timeB;
    }
    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  const dateSuffix = new Date().toISOString().split("T")[0];
  const filename = `journal_des_depenses_${dateSuffix}`;

  const headers = [
    "Date",
    "Heure",
    "N° Pièce",
    "Catégorie",
    "Description / Libellé",
    `Montant (${currency})`,
  ];

  let sumAmount = 0;

  const rows = filtered.map((e) => {
    const raw = e.createdAt || e.date;
    const d = raw ? new Date(raw) : null;
    const isValid = d && !isNaN(d.getTime());
    const dateStr = isValid ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : (e.date || "-");
    const timeStr = isValid && (e.createdAt || (e.date && e.date.includes("T"))) ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
    const amount = Number(e.amount) || 0;
    sumAmount += amount;

    return [
      dateStr,
      timeStr,
      e.id,
      e.category || "Frais divers",
      e.description || "-",
      amount,
    ];
  });

  const totalsRow: (string | number)[] = [
    "TOTAL DÉPENSES",
    `${filtered.length} opérations`,
    "",
    "",
    "",
    sumAmount,
  ];

  if (format === "csv") {
    generateCSV(headers, [...rows, totalsRow], filename);
  } else {
    generateExcel("Journal des Dépenses", headers, rows, filename, totalsRow);
  }
}

// ─── 7. Export État & Valorisation des Stocks ──────────────────
export function exportInventoryValuation(
  products: Product[],
  currency: string = "FCFA",
  format: ExportFormat = "excel"
) {
  // Tri méthodique et ordonné par Catégorie (A-Z) puis par Nom de Produit (A-Z)
  const sortedProducts = [...products].sort((a, b) => {
    const catComp = (a.category || "").localeCompare(b.category || "");
    if (catComp !== 0) return catComp;
    return (a.name || "").localeCompare(b.name || "");
  });

  const dateSuffix = new Date().toISOString().split("T")[0];
  const filename = `valorisation_stocks_${dateSuffix}`;

  const headers = [
    "Code SKU",
    "Désignation Produit",
    "Catégorie",
    `Prix Achat / Coût (${currency})`,
    `Prix Vente TTC (${currency})`,
    `Marge Unitaire (${currency})`,
    "Stock Physique",
    "Stock Minimum",
    "Statut Stock",
    `Valeur Stock Coût Achat (${currency})`,
    `Valeur Stock Prix Vente (${currency})`,
  ];

  let totalQty = 0;
  let totalCostValuation = 0;
  let totalSellingValuation = 0;

  const rows = sortedProducts.map((p) => {
    const cost = Number(p.cost) || 0;
    const price = Number(p.price) || 0;
    const stock = Number(p.stock) || 0;
    const minStock = Number(p.minStock) || 0;
    const margin = price - cost;

    const stockCostVal = stock * cost;
    const stockSellVal = stock * price;

    totalQty += stock;
    totalCostValuation += stockCostVal;
    totalSellingValuation += stockSellVal;

    const status = stock <= 0 ? "Rupture" : stock <= minStock ? "Stock Faible" : "Normal";

    return [
      p.sku || "-",
      p.name,
      p.category || "Non classé",
      cost,
      price,
      margin,
      stock,
      minStock,
      status,
      stockCostVal,
      stockSellVal,
    ];
  });

  const totalsRow: (string | number)[] = [
    "TOTAL INVENTAIRE",
    `${sortedProducts.length} références`,
    "",
    "",
    "",
    "",
    totalQty,
    "",
    "",
    totalCostValuation,
    totalSellingValuation,
  ];

  if (format === "csv") {
    generateCSV(headers, [...rows, totalsRow], filename);
  } else {
    generateExcel("Valorisation des Stocks", headers, rows, filename, totalsRow);
  }
}

// ─── 8. Export Grand Livre & Compte de Résultat (P&L) ──────────
export function exportGeneralLedger(
  sales: Sale[],
  expenses: Expense[],
  products: Product[],
  currency: string = "FCFA",
  format: ExportFormat = "excel",
  filter?: DateFilterOptions
) {
  const filteredSales = filterItemsByPeriod(sales, filter);
  const filteredExpenses = filterItemsByPeriod(expenses, filter);
  const dateSuffix = new Date().toISOString().split("T")[0];
  const filename = `compte_de_resultat_${dateSuffix}`;

  const revenue = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const discountTotal = filteredSales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);
  const grossRevenue = revenue + discountTotal;

  // Calcul du coût d'achat des marchandises vendues (COGS)
  let cogs = 0;
  filteredSales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        cogs += (Number(prod.cost) || 0) * item.quantity;
      }
    });
  });

  const grossMargin = revenue - cogs;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = grossMargin - totalExpenses;

  // Valorisation du stock actuel
  const currentStockValuation = products.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.stock) || 0), 0);

  const headers = [
    "Poste Comptable",
    "Description",
    `Montant (${currency})`,
    "% du Chiffre d'Affaires Net",
  ];

  const pct = (val: number) => revenue > 0 ? `${((val / revenue) * 100).toFixed(1)}%` : "0.0%";

  const rows: (string | number)[][] = [
    ["Chiffre d'Affaires Brut", "Total des ventes avant déduction des remises", grossRevenue, pct(grossRevenue)],
    ["Remises & Réductions Commerciales", "Total des remises accordées aux clients", discountTotal, pct(discountTotal)],
    ["Chiffre d'Affaires Net Encaissé", "Recettes effectives de la boutique", revenue, "100.0%"],
    ["Coût d'Achat des Marchandises (COGS)", "Prix d'achat des produits vendus aux fournisseurs", cogs, pct(cogs)],
    ["Marge Commerciale Brute", "Chiffre d'affaires net - Coût d'achat", grossMargin, pct(grossMargin)],
    ["Charges d'Exploitation (Dépenses)", "Loyers, factures, salaires, fournitures", totalExpenses, pct(totalExpenses)],
    ["BÉNÉFICE NET D'EXPLOITATION", "Résultat net après toutes charges et achats", netProfit, pct(netProfit)],
    ["Actif Circulant : Valeur Stock en Magasin", "Valeur patrimoniale actuelle des stocks au coût d'achat", currentStockValuation, "-"],
  ];

  if (format === "csv") {
    generateCSV(headers, rows, filename);
  } else {
    generateExcel("Compte de Résultat & Grand Livre", headers, rows, filename);
  }
}
