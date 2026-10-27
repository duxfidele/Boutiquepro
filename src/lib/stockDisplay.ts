import { ProductUnit } from "@/context/StoreContext";

export interface StockDecomposition {
  /** Quantité numérique exacte dans l'unité de référence */
  rawStock: number;
  /** Affichage de base ex: "218,5 Litres" */
  baseText: string;
  /** Affichage décomposé physique ex: "8 bidons de 25 L + 18,5 Litres" */
  decomposedText: string;
  /** Résumé complet combiné */
  fullSummary: string;
  /** Détails pour badges ou infobulles */
  hasWholesaleFormat: boolean;
  wholesalePacks: number;
  remainder: number;
  primaryFormatName?: string;
}

/**
 * Décompose intelligemment une quantité de stock unique en ses contenances physiques
 * sans jamais créer de stocks séparés ou de doublons.
 */
export function formatDecomposedStock(
  stock: number,
  baseUnit?: string | null,
  units?: ProductUnit[] | null
): StockDecomposition {
  const safeStock = Number.isFinite(Number(stock)) ? Number(stock) : 0;
  const unitLabel = (baseUnit || "unité").trim();
  const pluralUnit = safeStock > 1 && !unitLabel.endsWith("s") && !unitLabel.endsWith("x")
    ? `${unitLabel}s`
    : unitLabel;

  const baseText = `${safeStock.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${pluralUnit}`;

  // Filtrer les conditionnements de gros (> 1 unité de référence)
  const wholesaleUnits = (units || [])
    .filter((u) => u && Number(u.multiplier) > 1)
    .sort((a, b) => Number(b.multiplier) - Number(a.multiplier)); // Trier du plus grand au plus petit

  if (wholesaleUnits.length === 0 || safeStock <= 0) {
    return {
      rawStock: safeStock,
      baseText,
      decomposedText: baseText,
      fullSummary: baseText,
      hasWholesaleFormat: false,
      wholesalePacks: 0,
      remainder: safeStock,
    };
  }

  // Utiliser le format de gros principal (le plus grand ou marqué par défaut)
  const primaryFormat = wholesaleUnits.find(u => (u as any).is_purchase_default) || wholesaleUnits[0];
  const mult = Number(primaryFormat.multiplier);
  
  const packs = Math.floor(safeStock / mult);
  const remainder = Math.round((safeStock % mult) * 1000) / 1000;

  let decomposedText = "";
  if (packs > 0 && remainder > 0) {
    decomposedText = `${packs} ${primaryFormat.name} + ${remainder.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${remainder > 1 ? pluralUnit : unitLabel}`;
  } else if (packs > 0 && remainder === 0) {
    decomposedText = `${packs} ${primaryFormat.name}`;
  } else {
    decomposedText = `${remainder.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${remainder > 1 ? pluralUnit : unitLabel}`;
  }

  const fullSummary = packs > 0
    ? `${baseText} (${decomposedText})`
    : baseText;

  return {
    rawStock: safeStock,
    baseText,
    decomposedText,
    fullSummary,
    hasWholesaleFormat: true,
    wholesalePacks: packs,
    remainder,
    primaryFormatName: primaryFormat.name,
  };
}
