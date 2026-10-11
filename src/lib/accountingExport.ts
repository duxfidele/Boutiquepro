import { Sale, Expense, Product } from "@/context/StoreContext";

export type ExportFormat = "excel" | "csv";

export interface DateFilterOptions {
  period?: "all" | "today" | "week" | "month" | "last_month" | "custom";
  startDate?: string;
  endDate?: string;
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
export function generateExcel(
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  totalsRow?: (string | number)[]
) {
  let html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>${sheetTitle.replace(/[/\\?*\[\]]/g, "_")}</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
    <style>
      body { font-family: Calibri, Arial, sans-serif; }
      table { border-collapse: collapse; width: 100%; font-size: 11pt; }
      th { background-color: #1E3A8A; color: #FFFFFF; font-weight: bold; border: 1px solid #0F172A; padding: 10px; text-align: left; }
      td { border: 1px solid #CBD5E1; padding: 8px 10px; }
      .text-left { text-align: left; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .zebra { background-color: #F8FAFC; }
      .total-row { background-color: #E2E8F0; font-weight: bold; border-top: 2px solid #0F172A; border-bottom: 2px solid #0F172A; }
      .title-block { font-size: 15pt; font-weight: bold; color: #1E3A8A; padding-bottom: 8px; }
      .meta-block { font-size: 10pt; color: #64748B; padding-bottom: 12px; }
    </style>
  </head>
  <body>
    <table>
      <tr><td colspan="${headers.length}" class="title-block">${sheetTitle}</td></tr>
      <tr><td colspan="${headers.length}" class="meta-block">Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")} • BoutiquePro ERP</td></tr>
      <tr></tr>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach((row, idx) => {
    const isZebra = idx % 2 === 1 ? ' class="zebra"' : '';
    html += `<tr${isZebra}>`;
    row.forEach((cell) => {
      const isNum = typeof cell === "number";
      const align = isNum ? ' class="text-right"' : ' class="text-left"';
      html += `<td${align}>${cell !== null && cell !== undefined ? cell : ""}</td>`;
    });
    html += `</tr>`;
  });

  if (totalsRow) {
    html += `<tr class="total-row">`;
    totalsRow.forEach((cell) => {
      const isNum = typeof cell === "number";
      const align = isNum ? ' class="text-right"' : ' class="text-left"';
      html += `<td${align}>${cell !== null && cell !== undefined ? cell : ""}</td>`;
    });
    html += `</tr>`;
  }

  html += `
      </tbody>
    </table>
  </body>
  </html>
  `;

  triggerFileDownload(
    html,
    filename.endsWith(".xls") ? filename : `${filename}.xls`,
    "application/vnd.ms-excel;charset=utf-8;"
  );
}

// ─── 4. Filtre de Période Temporelle ──────────────────────────
export function filterItemsByPeriod<T extends { createdAt?: string; date?: string }>(
  items: T[],
  options?: DateFilterOptions
): T[] {
  if (!options || !options.period || options.period === "all") return items;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  return items.filter((item) => {
    const rawDate = item.createdAt || item.date;
    if (!rawDate) return false;
    const itemDate = rawDate.split("T")[0];

    if (options.period === "today") return itemDate === todayStr;
    if (options.period === "week") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      return itemDate >= weekAgo;
    }
    if (options.period === "month") {
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return itemDate.startsWith(currentMonth);
    }
    if (options.period === "last_month") {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
  const filtered = filterItemsByPeriod(sales, filter);
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
    const d = new Date(s.createdAt);
    const dateStr = d.toLocaleDateString("fr-FR");
    const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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
  const filtered = filterItemsByPeriod(expenses, filter);
  const dateSuffix = new Date().toISOString().split("T")[0];
  const filename = `journal_des_depenses_${dateSuffix}`;

  const headers = [
    "Date",
    "N° Pièce",
    "Catégorie",
    "Description / Libellé",
    `Montant (${currency})`,
  ];

  let sumAmount = 0;

  const rows = filtered.map((e) => {
    const d = e.date ? new Date(e.date).toLocaleDateString("fr-FR") : "";
    const amount = Number(e.amount) || 0;
    sumAmount += amount;

    return [
      d,
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

  const rows = products.map((p) => {
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
    `${products.length} références`,
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
