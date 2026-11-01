"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useStore, Product, ProductUnit } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  Clock,
} from "lucide-react";

interface ProductExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  category: string;
  sku: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  wholesaleName?: string;
  wholesaleMultiplier?: number;
  wholesaleCost?: number;
  wholesalePrice?: number;
  wholesaleBarcode?: string;
  batchNumber?: string;
  expiryDate?: string;
  isExisting: boolean;
  existingId?: string;
  status: "new" | "update" | "error";
  errorMessage?: string;
}

export default function ProductExcelImportModal({ isOpen, onClose }: ProductExcelImportModalProps) {
  const { state, dispatch, formatPrice } = useStore();
  const { activeStore, role } = useAuth();
  const isAdmin = role === "admin" || activeStore?.role === "admin";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [stockMode, setStockMode] = useState<"replace" | "add">("replace");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, newCount: 0, updatedCount: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Clean numbers safely (anti-NaN)
  const parseSafeNumber = (val: any, defaultVal = 0): number => {
    if (val === undefined || val === null || val === "") return defaultVal;
    if (typeof val === "number") return isNaN(val) ? defaultVal : val;
    const str = String(val).trim().replace(/[^0-9.,-]/g, "").replace(",", ".");
    const num = parseFloat(str);
    return isNaN(num) ? defaultVal : num;
  };

  // Normalisation intelligente des dates (support Excel serial date, JJ/MM/AAAA, AAAA-MM-JJ)
  const parseSafeDate = (val: any): string | undefined => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number") {
      try {
        const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split("T")[0];
        }
      } catch (e) {}
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const parts = str.split(/[\/\-.]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return parts[2] + "-" + parts[1].padStart(2, "0") + "-" + parts[0].padStart(2, "0");
      } else if (parts[0].length === 4) {
        return parts[0] + "-" + parts[1].padStart(2, "0") + "-" + parts[2].padStart(2, "0");
      }
    }
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split("T")[0];
    }
    return undefined;
  };

  // Normalisation des unités courantes
  const normalizeUnit = (val?: any): string => {
    if (!val) return "Pièce / Unité";
    const str = String(val).trim();
    const low = str.toLowerCase();
    if (low === "piece" || low === "pièce" || low === "unite" || low === "unité" || low === "u" || low === "pcs") return "Pièce / Unité";
    if (low === "l" || low === "litre" || low === "litres") return "Litre (L)";
    if (low === "kg" || low === "kilo" || low === "kilogramme" || low === "kilogrammes") return "Kilogramme (kg)";
    if (low === "boite" || low === "boîte" || low === "conserve" || low === "boites" || low === "boîtes") return "Boîte / Conserve";
    if (low === "sachet" || low === "paquet" || low === "sachets" || low === "paquets") return "Sachet / Paquet";
    if (low === "m" || low === "metre" || low === "mètre" || low === "metres") return "Mètre (m)";
    return str;
  };

  // Assign appropriate emoji
  const getEmojiForProduct = (name: string, category: string): string => {
    const str = (name + " " + category).toLowerCase();
    if (str.includes("robe") || str.includes("jupe")) return "👗";
    if (str.includes("chemise") || str.includes("t-shirt") || str.includes("polo") || str.includes("veste") || str.includes("habit") || str.includes("vetement") || str.includes("vêtement")) return "👕";
    if (str.includes("pantalon") || str.includes("jean")) return "👖";
    if (str.includes("chaussure") || str.includes("basket") || str.includes("sandale") || str.includes("soulier")) return "👟";
    if (str.includes("sac") || str.includes("valise") || str.includes("pochette")) return "👜";
    if (str.includes("montre") || str.includes("bijou") || str.includes("bague") || str.includes("collier")) return "⌚";
    if (str.includes("lunette")) return "🕶️";
    if (str.includes("chapeau") || str.includes("casquette")) return "🧢";
    if (str.includes("parfum") || str.includes("creme") || str.includes("crème") || str.includes("beaute") || str.includes("beauté") || str.includes("savon")) return "🧴";
    if (str.includes("telephone") || str.includes("téléphone") || str.includes("iphone") || str.includes("smartphone") || str.includes("samsung")) return "📱";
    if (str.includes("ordinateur") || str.includes("pc") || str.includes("laptop")) return "💻";
    if (str.includes("boisson") || str.includes("jus") || str.includes("eau") || str.includes("soda")) return "🥤";
    if (str.includes("aliment") || str.includes("nourriture") || str.includes("pain") || str.includes("huile") || str.includes("riz")) return "🍎";
    return "📦";
  };

  // Download official Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Nom du produit": "Huile Végétale Pure",
        "Catégorie": "Alimentation",
        "Code Barre (SKU)": "HUI-1001",
        "Unité de base": "Litre (L)",
        "Prix de vente détail": 1000,
        "Prix d'achat unitaire": 720,
        "Quantité en stock": 250,
        "Stock minimum": 25,
        "Nom format gros": "Bidon de 25 L",
        "Contenance (Multiplicateur)": 25,
        "Prix d'achat gros": 18000,
        "Prix de vente gros": 22500,
        "Code Barre gros": "BID-HUI-25L",
        "Numéro de lot": "LOT-HUI-2026-01",
        "Date de péremption (DLC)": "2026-12-31",
      },
      {
        "Nom du produit": "Sardines à l'Huile",
        "Catégorie": "Alimentation",
        "Code Barre (SKU)": "SAR-2002",
        "Unité de base": "Boîte / Conserve",
        "Prix de vente détail": 400,
        "Prix d'achat unitaire": 300,
        "Quantité en stock": 100,
        "Stock minimum": 20,
        "Nom format gros": "Carton de 50",
        "Contenance (Multiplicateur)": 50,
        "Prix d'achat gros": 15000,
        "Prix de vente gros": 16500,
        "Code Barre gros": "CAR-SAR-50",
        "Numéro de lot": "LOT-SAR-2026-02",
        "Date de péremption (DLC)": "2027-06-30",
      },
      {
        "Nom du produit": "Riz Parfumé 100%",
        "Catégorie": "Alimentation",
        "Code Barre (SKU)": "RIZ-3003",
        "Unité de base": "Kilogramme (kg)",
        "Prix de vente détail": 700,
        "Prix d'achat unitaire": 550,
        "Quantité en stock": 200,
        "Stock minimum": 50,
        "Nom format gros": "Sac de 50 kg",
        "Contenance (Multiplicateur)": 50,
        "Prix d'achat gros": 27500,
        "Prix de vente gros": 32000,
        "Code Barre gros": "SAC-RIZ-50KG",
        "Numéro de lot": "LOT-RIZ-2026-03",
        "Date de péremption (DLC)": "2027-12-31",
      },
      {
        "Nom du produit": "Savon de Ménage",
        "Catégorie": "Entretien",
        "Code Barre (SKU)": "SAV-4004",
        "Unité de base": "Pièce / Unité",
        "Prix de vente détail": 350,
        "Prix d'achat unitaire": 250,
        "Quantité en stock": 80,
        "Stock minimum": 15,
        "Nom format gros": "Carton de 24",
        "Contenance (Multiplicateur)": 24,
        "Prix d'achat gros": 6000,
        "Prix de vente gros": 7500,
        "Code Barre gros": "CAR-SAV-24",
        "Numéro de lot": "",
        "Date de péremption (DLC)": "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 25 }, // Nom du produit
      { wch: 16 }, // Catégorie
      { wch: 18 }, // Code Barre (SKU)
      { wch: 18 }, // Unité de base
      { wch: 20 }, // Prix de vente détail
      { wch: 20 }, // Prix d'achat unitaire
      { wch: 18 }, // Quantité en stock
      { wch: 16 }, // Stock minimum
      { wch: 18 }, // Nom format gros
      { wch: 25 }, // Contenance (Multiplicateur)
      { wch: 18 }, // Prix d'achat gros
      { wch: 18 }, // Prix de vente gros
      { wch: 18 }, // Code Barre gros
      { wch: 18 }, // Numéro de lot
      { wch: 22 }, // Date de péremption (DLC)
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle Produits");
    XLSX.writeFile(wb, "modele_import_produits_maboutiquepro.xlsx");
  };

  // Normalisation intelligente et exhaustive des en-têtes (accents, apostrophes ' et ’, ponctuations)
  const normalizeHeader = (header: string): string => {
    return String(header || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Enlève les accents
      .replace(/[\'\’\`\-_()\[\]/\\.,:;]/g, " ") // Remplace apostrophes et ponctuations par des espaces
      .replace(/\s+/g, " ")
      .trim();
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);

    // Contrôles de sécurité : extension et taille maximale (max 5 Mo)
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      setErrorMsg("Format non pris en charge. Veuillez fournir un fichier Excel (.xlsx, .xls) ou CSV (.csv).");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg("Fichier trop volumineux. La taille maximale autorisée est de 5 Mo.");
      return;
    }

    setLoading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("Le fichier Excel ne contient aucune feuille de calcul.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

      if (rawJson.length === 0) {
        throw new Error("La feuille de calcul est vide.");
      }

      if (rawJson.length > 5000) {
        throw new Error("Le fichier contient trop de lignes (" + rawJson.length + "). Limite maximale : 5 000 lignes par import.");
      }

      const rows: ParsedRow[] = [];

      rawJson.forEach((row) => {
        const keys = Object.keys(row);
        const items = keys.map((k) => ({ original: k, norm: normalizeHeader(k) }));

        const getValue = (predicate: (norm: string) => boolean) => {
          const found = items.find((item) => {
            if (!predicate(item.norm)) return false;
            const v = row[item.original];
            return v !== undefined && v !== null && String(v).trim() !== "";
          });
          return found ? row[found.original] : undefined;
        };

        // 1. Nom / Désignation du produit
        const rawName = getValue((n) =>
          n.includes("nom") ||
          n.includes("designation") ||
          n.includes("libelle") ||
          n.includes("article") ||
          n.includes("produit") ||
          n.includes("description") ||
          n.includes("name") ||
          n.includes("item")
        );
        if (!rawName || !String(rawName).trim()) return;

        const name = String(rawName).trim();

        // 2. Catégorie / Rayon / Famille
        const rawCategory = getValue((n) =>
          n.includes("categor") ||
          n.includes("rayon") ||
          n.includes("famille") ||
          n.includes("groupe") ||
          n.includes("type")
        );
        const category = rawCategory ? String(rawCategory).trim() : (state.categories[0]?.name || "Divers");

        // 3. Unité physique de base
        const rawUnit = getValue((n) =>
          (n.includes("unite") || n.includes("mesure") || n === "unit" || n.includes("conditionnement detail")) &&
          !n.includes("gros") && !n.includes("carton") && !n.includes("multiplicateur")
        );
        const unit = normalizeUnit(rawUnit);

        // 4. Code-barres / SKU de détail
        const rawSku = getValue((n) =>
          (n.includes("sku") || n.includes("barre") || n.includes("barcode") || n.includes("ref") || n.includes("code")) &&
          !n.includes("postal") && !n.includes("client") && !n.includes("pays") &&
          !n.includes("gros") && !n.includes("carton") && !n.includes("pack")
        );
        const sku = rawSku 
          ? String(rawSku).trim() 
          : (name.substring(0, 3).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000));

        // 5. Conditionnement Gros (Multi-unités optionnel)
        const rawWholesaleName = getValue((n) =>
          n.includes("format gros") ||
          n.includes("nom gros") ||
          n.includes("nom format gros") ||
          n.includes("nom carton") ||
          n.includes("conditionnement gros") ||
          n === "carton" ||
          n.includes("type gros") ||
          n.includes("wholesale name")
        );
        const wholesaleName = rawWholesaleName ? String(rawWholesaleName).trim() : undefined;

        const rawWholesaleMultiplier = getValue((n) =>
          n.includes("contenance") ||
          n.includes("multiplicateur") ||
          n.includes("pieces par carton") ||
          n.includes("unites par carton") ||
          n.includes("capacite") ||
          n === "multiplier" ||
          n.includes("contenu")
        );
        let wholesaleMultiplier = parseSafeNumber(rawWholesaleMultiplier, 0);
        if (wholesaleMultiplier <= 1 && wholesaleName) {
          const matchNum = String(wholesaleName).match(/\d+/);
          if (matchNum) wholesaleMultiplier = parseInt(matchNum[0], 10);
        }

        // 6. Tarifs d'achat (Gros vs Détail)
        const rawWholesaleCost = getValue((n) =>
          (n.includes("achat") || n.includes("cout") || n.includes("cost") || n.includes("pa")) &&
          (n.includes("gros") || n.includes("carton") || n.includes("pack") || n.includes("bidon") || n.includes("sac"))
        );
        const wholesaleCost = rawWholesaleCost !== undefined ? parseSafeNumber(rawWholesaleCost, 0) : undefined;

        const rawCost = getValue((n) =>
          (n.includes("achat") ||
           n.includes("cout") ||
           n.includes("fournisseur") ||
           n.includes("revient") ||
           n.includes("cost") ||
           n.includes("purchase") ||
           n.includes("buy") ||
           n === "pa" ||
           n.startsWith("pa ") ||
           n.endsWith(" pa")) &&
          !n.includes("vente") &&
          !n.includes("gros") &&
          !n.includes("carton") &&
          !n.includes("pack") &&
          !n.includes("bidon") &&
          !n.includes("sac")
        );
        let cost = parseSafeNumber(rawCost, 0);
        if (cost === 0 && wholesaleCost && wholesaleMultiplier > 1) {
          cost = Math.round((wholesaleCost / wholesaleMultiplier) * 100) / 100;
        }

        // 7. Tarifs de vente (Gros vs Détail)
        const rawWholesalePrice = getValue((n) =>
          (n.includes("vente") || n.includes("prix") || n.includes("price") || n.includes("pv")) &&
          (n.includes("gros") || n.includes("carton") || n.includes("pack") || n.includes("bidon") || n.includes("sac"))
        );
        const wholesalePrice = rawWholesalePrice !== undefined ? parseSafeNumber(rawWholesalePrice, 0) : undefined;

        const rawPrice = getValue((n) => {
          if (
            n.includes("achat") ||
            n.includes("cout") ||
            n.includes("fournisseur") ||
            n.includes("revient") ||
            n.includes("cost") ||
            n === "pa" ||
            n.startsWith("pa ") ||
            n.endsWith(" pa")
          ) {
            return false;
          }
          if (n.includes("gros") || n.includes("carton") || n.includes("pack") || n.includes("bidon") || n.includes("sac")) {
            return false;
          }
          return (
            n.includes("vente") ||
            n.includes("selling") ||
            n.includes("sale") ||
            n.includes("public") ||
            n.includes("client") ||
            n.includes("ttc") ||
            n.includes("prix") ||
            n.includes("price") ||
            n.includes("unitaire") ||
            n === "pv" ||
            n.startsWith("pv ")
          );
        });
        const price = parseSafeNumber(rawPrice, 0);

        // 8. Code barre gros
        const rawWholesaleBarcode = getValue((n) =>
          (n.includes("barre") || n.includes("barcode") || n.includes("sku") || n.includes("code")) &&
          (n.includes("gros") || n.includes("carton") || n.includes("pack"))
        );
        const wholesaleBarcode = rawWholesaleBarcode ? String(rawWholesaleBarcode).trim() : undefined;

        // 9. Traçabilité : Lots & Dates d'expiration
        const rawBatchNumber = getValue((n) => (n.includes("lot") || n.includes("batch")) && !n.includes("cloture"));
        const rawExpiryDate = getValue((n) => n.includes("dlc") || n.includes("peremption") || n.includes("expiration") || n.includes("expiry") || n.includes("dluo"));
        const expiryDate = parseSafeDate(rawExpiryDate);
        const batchNumber = rawBatchNumber 
          ? String(rawBatchNumber).trim() 
          : (expiryDate ? ("LOT-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900)) : undefined);

        // 10. Quantité en stock
        const rawStock = getValue((n) =>
          (n.includes("quantite") ||
           n.includes("qte") ||
           n.includes("qty") ||
           n.includes("stock") ||
           n.includes("disponible") ||
           n.includes("physique") ||
           n.includes("magasin") ||
           n.includes("quantity")) &&
          !n.includes("min") && !n.includes("seuil") && !n.includes("alerte") && !n.includes("max")
        );
        const stock = parseSafeNumber(rawStock, 0);

        // 11. Seuil d'alerte
        const rawMinStock = getValue((n) =>
          n.includes("min") || n.includes("seuil") || n.includes("alerte") || n.includes("reapprovisionnement")
        );
        const minStock = parseSafeNumber(rawMinStock, 5);

        // Vérification si le produit existe déjà en boutique
        const existing = state.products.find(
          (p) =>
            (p.sku && sku && p.sku.toLowerCase() === sku.toLowerCase()) ||
            p.name.toLowerCase() === name.toLowerCase()
        );

        rows.push({
          name,
          category,
          sku,
          unit,
          price,
          cost,
          stock,
          minStock,
          wholesaleName: wholesaleName || undefined,
          wholesaleMultiplier: wholesaleMultiplier > 1 ? wholesaleMultiplier : undefined,
          wholesaleCost: wholesaleCost && wholesaleCost > 0 ? wholesaleCost : undefined,
          wholesalePrice: wholesalePrice && wholesalePrice > 0 ? wholesalePrice : undefined,
          wholesaleBarcode: wholesaleBarcode || undefined,
          batchNumber: batchNumber || undefined,
          expiryDate: expiryDate || undefined,
          isExisting: !!existing,
          existingId: existing?.id,
          status: existing ? "update" : "new",
        });
      });

      if (rows.length === 0) {
        throw new Error("Aucun produit valide n'a été détecté dans le fichier. Assurez-vous d'avoir au moins une colonne 'Nom du produit'.");
      }

      setParsedRows(rows);
    } catch (err: any) {
      console.error("Excel parse error:", err);
      setErrorMsg(err.message || "Erreur lors de la lecture du fichier Excel.");
      setParsedRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const existingCategories = new Set(state.categories.map((c) => c.name.toLowerCase()));
      const newCategoriesToAdd = new Set<string>();

      const finalProductsToUpsert: Product[] = [];
      const batchesToCreate: any[] = [];
      let newCount = 0;
      let updatedCount = 0;

      for (const row of parsedRows) {
        if (!existingCategories.has(row.category.toLowerCase())) {
          newCategoriesToAdd.add(row.category);
          existingCategories.add(row.category.toLowerCase());
        }

        const targetProdId = (row.isExisting && row.existingId)
          ? row.existingId
          : ("p" + Date.now() + "_" + Math.random().toString(36).substring(2, 7));

        const existingProd = row.existingId ? state.products.find((p) => p.id === row.existingId) : undefined;
        const currentStock = existingProd ? Number(existingProd.stock) || 0 : 0;
        const finalStock = (row.isExisting && stockMode === "add") ? currentStock + row.stock : row.stock;

        const finalCost = row.cost > 0 ? row.cost : (Number(existingProd?.cost) || 0);
        const finalPrice = row.price > 0 ? row.price : (Number(existingProd?.price) || 0);
        const finalMinStock = row.minStock > 0 ? row.minStock : (Number(existingProd?.minStock) || 5);
        const finalUnit = row.unit || existingProd?.unit || "Pièce / Unité";

        // Conditionnement gros
        const units: ProductUnit[] = existingProd?.units ? [...existingProd.units] : [];
        if (row.wholesaleName && Number(row.wholesaleMultiplier) > 1) {
          const wholesaleIdx = units.findIndex(u => u.name.toLowerCase() === row.wholesaleName!.toLowerCase() || u.multiplier === row.wholesaleMultiplier);
          const newWholesaleUnit: ProductUnit = {
            id: wholesaleIdx >= 0 ? units[wholesaleIdx].id : ("pu_" + Math.random().toString(36).substring(7)),
            storeId: activeStore?.id || "",
            productId: targetProdId,
            name: row.wholesaleName.trim(),
            multiplier: Number(row.wholesaleMultiplier),
            price: row.wholesalePrice && row.wholesalePrice > 0 ? row.wholesalePrice : (wholesaleIdx >= 0 ? units[wholesaleIdx].price : null),
            cost: row.wholesaleCost && row.wholesaleCost > 0 ? row.wholesaleCost : (wholesaleIdx >= 0 ? units[wholesaleIdx].cost : null),
            barcode: row.wholesaleBarcode || (wholesaleIdx >= 0 ? units[wholesaleIdx].barcode : null),
            isReference: false,
          };
          if (wholesaleIdx >= 0) {
            units[wholesaleIdx] = newWholesaleUnit;
          } else {
            units.push(newWholesaleUnit);
          }
        }

        const prodToSave: Product = {
          id: targetProdId,
          name: row.name,
          sku: row.sku,
          category: row.category,
          unit: finalUnit,
          price: finalPrice,
          cost: finalCost,
          stock: finalStock,
          minStock: finalMinStock,
          image: existingProd?.image || getEmojiForProduct(row.name, row.category),
          createdAt: existingProd?.createdAt || new Date().toISOString().split("T")[0],
          units: units.length > 0 ? units : undefined,
        };

        if (row.isExisting && row.existingId) {
          if (!updateExisting) {
            continue;
          }
          finalProductsToUpsert.push(prodToSave);
          updatedCount++;
        } else {
          finalProductsToUpsert.push(prodToSave);
          newCount++;
        }

        // Lot initial si DLC ou lot fourni
        if (row.expiryDate && row.expiryDate.trim()) {
          const bNum = row.batchNumber && row.batchNumber.trim()
            ? row.batchNumber.trim()
            : ("LOT-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900));
          batchesToCreate.push({
            id: "b_" + Date.now() + "_" + Math.random().toString(36).substring(7),
            storeId: activeStore?.id || "",
            productId: targetProdId,
            batchNumber: bNum,
            expiryDate: row.expiryDate.trim(),
            initialQuantity: finalStock > 0 ? finalStock : 1,
            currentQuantity: finalStock > 0 ? finalStock : 1,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // 1. Ajouter les nouvelles catégories dans Supabase & state
      for (const catName of Array.from(newCategoriesToAdd)) {
        const catId = "cat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
        const newCat = {
          id: catId,
          name: catName,
          icon: "📦",
          color: "#6343EA",
        };
        dispatch({ type: "ADD_CATEGORY", payload: newCat });

        if (activeStore?.id) {
          await supabase.from("categories").insert([
            {
              id: catId,
              store_id: activeStore.id,
              name: catName,
              icon: "📦",
              color: "#6343EA",
            },
          ]);
        }
      }

      // 2. Dispatch BATCH_ADD_PRODUCTS (met à jour le state et enregistre en base via upsert)
      await dispatch({ type: "BATCH_ADD_PRODUCTS", payload: finalProductsToUpsert });

      // 3. Enregistrement des lots initiaux et dates de péremption si présents
      if (batchesToCreate.length > 0) {
        for (const batch of batchesToCreate) {
          try {
            await dispatch({ type: "ADD_BATCH", payload: batch });
          } catch (batchErr) {
            console.warn("Erreur création lot importé:", batchErr);
          }
        }
      }

      setImportStats({
        total: finalProductsToUpsert.length,
        newCount,
        updatedCount,
      });
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Import error:", err);
      setErrorMsg(err.message || "Une erreur est survenue lors de l'enregistrement des produits.");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setParsedRows([]);
    setIsSuccess(false);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const newRowsCount = parsedRows.filter((r) => !r.isExisting).length;
  const updateRowsCount = parsedRows.filter((r) => r.isExisting).length;
  const totalStockValue = parsedRows.reduce((acc, r) => acc + r.stock * r.price, 0);
  const totalCostValue = isAdmin ? parsedRows.reduce((acc, r) => acc + r.stock * r.cost, 0) : 0;
  const totalProjectedProfit = isAdmin ? (totalStockValue - totalCostValue) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60 bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Importer des produits via Excel</h2>
              <p className="text-xs text-muted-foreground">Fichiers acceptés : .xlsx, .xls, .csv</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-xs font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {isSuccess ? (
            <div className="py-8 text-center space-y-5 animate-scale-in">
              <div className="h-20 w-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-3xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Importation réussie avec succès !</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Votre catalogue a été mis à jour instantanément dans MaBoutiquePro.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto p-4 rounded-2xl bg-secondary/30 border border-border/60 text-center">
                <div>
                  <div className="text-xl font-bold text-foreground">{importStats.total}</div>
                  <div className="text-[11px] text-muted-foreground">Total traités</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{importStats.newCount}</div>
                  <div className="text-[11px] text-muted-foreground">Nouveaux</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{importStats.updatedCount}</div>
                  <div className="text-[11px] text-muted-foreground">Mis à jour</div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={resetAll}
                  className="px-5 py-2.5 rounded-xl border border-border/60 text-xs font-semibold hover:bg-secondary/50 transition-colors"
                >
                  Importer un autre fichier
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all flex items-center gap-2"
                >
                  <span>Voir le catalogue</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : parsedRows.length === 0 ? (
            <div className="space-y-6">
              {/* Template Download Card */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Vous n&apos;avez pas encore de fichier prêt ?</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Téléchargez notre modèle Excel déjà configuré avec les colonnes recommandées.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border/70 hover:bg-secondary/60 text-xs font-semibold text-foreground transition-all shadow-xs shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  <span>Télécharger le modèle</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-primary bg-primary/10 scale-[0.99]"
                    : "border-border/80 hover:border-primary/60 hover:bg-secondary/20"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="h-16 w-16 rounded-2xl bg-secondary/80 border border-border/80 flex items-center justify-center text-primary mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Glissez-déposez votre fichier Excel ici
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  ou cliquez pour parcourir vos dossiers (.xlsx, .xls ou .csv)
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">
                  <HelpCircle className="h-3 w-3" />
                  Colonnes détectées automatiquement
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-fade-in">
              {/* Summary Badges : Nouveaux, Existants, Valeur Vente & Valeur Achat */}
              <div className={`grid ${isAdmin ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"} gap-3`}>
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60">
                  <div className="text-[11px] text-muted-foreground font-medium">Produits détectés</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{parsedRows.length}</div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Nouveaux</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{newRowsCount}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Déjà existants</div>
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {updateRowsCount}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60">
                  <div className="text-[11px] text-muted-foreground font-medium">Valeur Vente (CA)</div>
                  <div className="text-xs font-bold text-primary mt-1 truncate" title={formatPrice(totalStockValue)}>
                    {formatPrice(totalStockValue)}
                  </div>
                </div>
                {isAdmin && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Valeur Achat (Coût)</div>
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 truncate" title={formatPrice(totalCostValue)}>
                      {formatPrice(totalCostValue)}
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              {updateRowsCount > 0 && (
                <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Mettre à jour les {updateRowsCount} produits déjà existants</span>
                    </label>

                    {updateExisting && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Pour le stock :</span>
                        <select
                          value={stockMode}
                          onChange={(e) => setStockMode(e.target.value as any)}
                          className="bg-background border border-border/70 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="replace">Remplacer par la quantité du fichier</option>
                          <option value="add">Ajouter au stock existant</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                  <span>Aperçu des 10 premières lignes :</span>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Changer de fichier
                  </button>
                </div>

                <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
                  <div className="overflow-x-auto max-h-60 no-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/50 text-muted-foreground font-semibold border-b border-border/60 sticky top-0 backdrop-blur-md">
                        <tr>
                          <th className="p-3">Statut</th>
                          <th className="p-3">Produit & Unité</th>
                          <th className="p-3">Catégorie / SKU</th>
                          <th className="p-3">Format Gros</th>
                          <th className="p-3 text-right">Prix Vente</th>
                          {isAdmin && <th className="p-3 text-right">Prix Achat</th>}
                          {isAdmin && <th className="p-3 text-right">Marge</th>}
                          <th className="p-3 text-right">Stock</th>
                          <th className="p-3">Péremption (DLC)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {parsedRows.slice(0, 10).map((r, i) => {
                          const margin = r.price - r.cost;
                          const marginPct = r.price > 0 ? Math.round((margin / r.price) * 100) : 0;
                          return (
                            <tr key={i} className="hover:bg-secondary/20 transition-colors">
                              <td className="p-3">
                                {r.isExisting ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    Existant
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    Nouveau
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-foreground">
                                <div className="font-semibold">{r.name}</div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <span>Unité:</span>
                                  <span className="font-medium text-primary">{r.unit}</span>
                                </div>
                              </td>
                              <td className="p-3 text-muted-foreground">
                                <div className="text-foreground">{r.category}</div>
                                <div className="font-mono text-[10px] text-muted-foreground/70">{r.sku}</div>
                              </td>
                              <td className="p-3 text-xs">
                                {r.wholesaleName && Number(r.wholesaleMultiplier) > 1 ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-[10px] border border-amber-500/20">
                                      📦 {r.wholesaleName} (x{r.wholesaleMultiplier})
                                    </span>
                                    {r.wholesalePrice && (
                                      <div className="text-[10px] text-muted-foreground">
                                        Revente: <strong className="text-foreground">{formatPrice(r.wholesalePrice)}</strong>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/60 text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="font-bold text-foreground">{formatPrice(r.price)}</div>
                                <div className="text-[10px] text-muted-foreground">/ {r.unit ? (r.unit.split('/')[0] || r.unit).trim() : 'unité'}</div>
                              </td>
                              {isAdmin && (
                                <td className="p-3 text-right">
                                  <div className="font-medium text-amber-600 dark:text-amber-400">{formatPrice(r.cost)}</div>
                                  {r.wholesaleCost && (
                                    <div className="text-[10px] text-muted-foreground">
                                      Gros: {formatPrice(r.wholesaleCost)}
                                    </div>
                                  )}
                                </td>
                              )}
                              {isAdmin && (
                                <td className="p-3 text-right">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    margin >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
                                  }`}>
                                    {marginPct}% ({formatPrice(margin)})
                                  </span>
                                </td>
                              )}
                              <td className="p-3 text-right font-bold text-foreground">
                                <div>{r.stock} <span className="text-[10px] font-normal text-muted-foreground">{r.unit ? (r.unit.split('/')[0] || r.unit).trim() : ''}</span></div>
                                {r.wholesaleMultiplier && r.wholesaleMultiplier > 1 && r.stock >= r.wholesaleMultiplier && (
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    ≈ {Math.floor(r.stock / r.wholesaleMultiplier)} cartons
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-xs">
                                {r.expiryDate ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium border border-blue-500/20" title={r.batchNumber ? `Lot: ${r.batchNumber}` : undefined}>
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>{new Date(r.expiryDate).toLocaleDateString('fr-FR')}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60 text-[11px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 10 && (
                    <div className="p-2.5 text-center text-[11px] text-muted-foreground bg-secondary/30 border-t border-border/40">
                      + {parsedRows.length - 10} autres produits prêts à être importés
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isSuccess && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-secondary/20">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              Annuler
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importation en cours...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Confirmer l&apos;importation ({parsedRows.length} produits)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
