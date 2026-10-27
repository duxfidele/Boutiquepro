/**
 * CATALOGUE CENTRALISÉ DES MODULES (MaBoutiquePro)
 * Source unique de vérité pour la modularité par boutique.
 * Définit les modules opérationnels, les formules requises, les profils métiers et les placeholders futurs.
 */

import { SubscriptionTier } from "@/lib/subscriptionPlans";

export type ModuleKey =
  | 'core'               // Fondation : Caisse POS, Produits, Dashboard, Clôtures X/Z (invariable, toujours actif)
  | 'debts'              // Carnet de dettes clients & relances WhatsApp
  | 'receipts_invoices'  // Facturation formelle A4 & quittances de solde
  | 'inventory'          // Sessions d'inventaire physique & régularisations
  | 'orders'             // Commandes d'achats fournisseurs & réceptions
  | 'expenses'           // Enregistrement des charges d'exploitation
  | 'analytics'          // Analytique avancée & statistiques détaillées
  | 'team'               // Gestion de l'équipe et des caissiers
  | 'multi_store'        // Pilotage multi-boutiques (formule Business)
  // Placeholders futurs (non affichés tant que non implémentés)
  | 'multi_units'
  | 'price_history'
  | 'quotes';

export type ModuleStatus = 'available' | 'locked' | 'disabled';

export type StoreSector =
  | 'general_store'     // Alimentation générale / Épicerie / Supérette
  | 'fashion'           // Vêtements & Accessoires de mode
  | 'hardware'          // Quincaillerie & Matériaux
  | 'electronics'       // Téléphonie & Électronique
  | 'beverage'          // Dépôt de boissons, Bar & Brasserie
  | 'cosmetics_pharma'  // Cosmétique, Soins & Parapharmacie
  | 'services_other'    // Prestation de services & Négoce B2B
  | 'other';            // Autre commerce

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  category: 'essential' | 'commercial' | 'management' | 'expansion' | 'future';
  minTier: SubscriptionTier;
  routes: string[];
  isCore?: boolean;        // Toujours actif, ne peut pas être désactivé
  isPlaceholder?: boolean; // Futurs modules non encore développés
  adminOnly?: boolean;
}

/**
 * Catalogue complet de tous les modules de l'application
 */
export const MODULES_CATALOG: Record<ModuleKey, ModuleDefinition> = {
  core: {
    key: 'core',
    label: 'Caisse & Produits (Fondation)',
    description: 'Point de vente tactile, catalogue produits, stocks, sessions de caisse et rapports X/Z.',
    category: 'essential',
    minTier: 'STARTER',
    routes: ['/', '/pos', '/products', '/categories', '/profile', '/support'],
    isCore: true,
    adminOnly: false,
  },
  expenses: {
    key: 'expenses',
    label: 'Dépenses & Charges',
    description: 'Suivi des frais généraux du magasin (loyers, factures, salaires) et impact sur le bénéfice net.',
    category: 'essential',
    minTier: 'STARTER',
    routes: ['/expenses'],
    adminOnly: true,
  },
  debts: {
    key: 'debts',
    label: 'Carnet de Dettes & Relances',
    description: 'Ventes à crédit, suivi des créances impayées, échéanciers et relances directes WhatsApp.',
    category: 'commercial',
    minTier: 'PRO',
    routes: ['/debts'],
    adminOnly: false,
  },
  receipts_invoices: {
    key: 'receipts_invoices',
    label: 'Factures A4 & Reçus Avancés',
    description: 'Édition de factures normalisées A4, reçus thermiques avec logo et quittances de paiement.',
    category: 'commercial',
    minTier: 'PRO',
    routes: [], // Lié aux flux d'impression au POS et dans le carnet de dettes
    adminOnly: false,
  },
  inventory: {
    key: 'inventory',
    label: 'Inventaires Physiques',
    description: 'Sessions de comptage réel de stock, calcul automatique de démarque et régularisations.',
    category: 'management',
    minTier: 'PRO',
    routes: ['/inventory'],
    adminOnly: true,
  },
  orders: {
    key: 'orders',
    label: 'Commandes Fournisseurs',
    description: 'Bons de commande d\'achat, suivi des réapprovisionnements et entrées de stock.',
    category: 'management',
    minTier: 'PRO',
    routes: ['/orders'],
    adminOnly: true,
  },
  analytics: {
    key: 'analytics',
    label: 'Analytique & Rentabilité',
    description: 'Top ventes, marges bénéficiaires détaillées, concordances et exports comptables avancés.',
    category: 'management',
    minTier: 'PRO',
    routes: ['/analytics'],
    adminOnly: true,
  },
  team: {
    key: 'team',
    label: 'Gestion d\'Équipe & Caissiers',
    description: 'Comptes caissiers dédiés, attribution des caisses et gestion des accès du personnel.',
    category: 'expansion',
    minTier: 'PRO',
    routes: ['/team'],
    adminOnly: true,
  },
  multi_store: {
    key: 'multi_store',
    label: 'Multi-Boutiques',
    description: 'Gestion centralisée de plusieurs points de vente avec bascule instantanée.',
    category: 'expansion',
    minTier: 'BUSINESS',
    routes: [],
    adminOnly: true,
  },
  // Placeholders futurs : marqués isPlaceholder: true (non affichés tant que non développés)
  multi_units: {
    key: 'multi_units',
    label: 'Unités Multiples',
    description: 'Gestion des conditionnements multiples (cartons, packs, pièces, vrac).',
    category: 'commercial',
    minTier: 'PRO',
    routes: [],
    adminOnly: true,
  },
  price_history: {
    key: 'price_history',
    label: 'Historique des Prix',
    description: 'Traçabilité des fluctuations de prix d\'achat et des tarifs de vente dans le temps.',
    category: 'future',
    minTier: 'PRO',
    routes: [],
    isPlaceholder: true,
    adminOnly: true,
  },
  quotes: {
    key: 'quotes',
    label: 'Devis & Proformas',
    description: 'Génération de devis commerciaux transformables en ventes directes.',
    category: 'commercial',
    minTier: 'STARTER',
    routes: ['/quotes'],
    isPlaceholder: false,
    adminOnly: false,
  },
};

/**
 * Matrice stricte des modules inclus par formule d'abonnement.
 * Reproduit EXACTEMENT les accès actuels sans dupliquer les quotas numériques.
 */
export const TIER_MODULES: Record<SubscriptionTier, ModuleKey[]> = {
  STARTER: ['core', 'expenses', 'quotes'],
  PRO: ['core', 'expenses', 'debts', 'receipts_invoices', 'inventory', 'orders', 'analytics', 'team', 'multi_units', 'quotes'],
  BUSINESS: ['core', 'expenses', 'debts', 'receipts_invoices', 'inventory', 'orders', 'analytics', 'team', 'multi_store', 'multi_units', 'quotes'],
};

/**
 * Ensemble des clés de modules valides connues du système
 */
export const KNOWN_MODULE_KEYS: Set<ModuleKey> = new Set(
  Object.keys(MODULES_CATALOG) as ModuleKey[]
);

/**
 * Modules activés par défaut pour les boutiques existantes (rétro-compatibilité 100%)
 */
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [
  'quotes',
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store',
  // multi_units est activable sur demande ou via profil secteur, jamais imposé par défaut
];

/**
 * Profils métiers disponibles
 */
export interface SectorPreset {
  key: StoreSector;
  label: string;
  tagline: string;
  icon: string;
  recommendedModules: ModuleKey[];
  features: {
    multiUnits: boolean;
    batchesExpiry: boolean;
    fractionalSales: boolean;
    quotes: boolean;
    debts: boolean;
    team: boolean;
    receiptsInvoices: boolean;
  };
  sampleUnits: string[];
}

export const STORE_SECTORS: { key: StoreSector; label: string; icon: string; tagline: string }[] = [
  { key: "general_store", label: "Alimentation / Supérette", icon: "🛒", tagline: "Épicerie, vivres, boissons et produits de grande consommation" },
  { key: "fashion", label: "Mode, Vêtements & Chaussures", icon: "👗", tagline: "Prêt-à-porter, accessoires, maroquinerie et tissus" },
  { key: "hardware", label: "Quincaillerie & Matériaux", icon: "🔨", tagline: "Bricolage, outillage, ciment, électricité et plomberie" },
  { key: "beverage", label: "Dépôt de Boissons & Bar", icon: "🍻", tagline: "Casiers, packs d'eau, jus, brasserie et vente au détail" },
  { key: "electronics", label: "Téléphonie & Électronique", icon: "📱", tagline: "Smartphones, informatique, pièces et accessoires" },
  { key: "cosmetics_pharma", label: "Cosmétique & Soins", icon: "💊", tagline: "Beauté, parfumerie, parapharmacie et soins corporels" },
  { key: "services_other", label: "Prestations & Négoce B2B", icon: "🏢", tagline: "Devis formels, fournitures de bureau et facturation professionnelle" },
  { key: "other", label: "Autre commerce général", icon: "🏬", tagline: "Commerce général avec outils complets et polyvalents" },
];

export const SECTOR_PRESETS: Record<StoreSector, SectorPreset> = {
  general_store: {
    key: "general_store",
    label: "Alimentation & Épicerie",
    tagline: "Vente rapide, cartons/packs et gestion des dates de péremption",
    icon: "🛒",
    recommendedModules: ["core", "expenses", "debts", "inventory", "orders", "analytics", "multi_units", "quotes"],
    features: {
      multiUnits: true,
      batchesExpiry: true,
      fractionalSales: true,
      quotes: false,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Carton (24)", "Pack (6)", "Paquet (12)", "Sac (50kg)", "Unité"],
  },
  fashion: {
    key: "fashion",
    label: "Boutique de Mode & Prêt-à-porter",
    tagline: "Vente unitaire épurée sans dates de péremption ni encombrement",
    icon: "👗",
    recommendedModules: ["core", "expenses", "debts", "analytics", "receipts_invoices", "inventory"],
    features: {
      multiUnits: false,
      batchesExpiry: false,
      fractionalSales: false,
      quotes: false,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Pièce", "Paire", "Ensemble", "Lot"],
  },
  hardware: {
    key: "hardware",
    label: "Quincaillerie & Matériaux",
    tagline: "Chiffrage de devis, ventes au mètre/kilo et carnet de crédits chantiers",
    icon: "🔨",
    recommendedModules: ["core", "expenses", "debts", "quotes", "orders", "inventory", "analytics", "multi_units", "receipts_invoices"],
    features: {
      multiUnits: true,
      batchesExpiry: false,
      fractionalSales: true,
      quotes: true,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Sac (50kg)", "Barre (6m)", "Paquet (100)", "Rouleau", "Unité"],
  },
  beverage: {
    key: "beverage",
    label: "Dépôt de Boissons & Bar",
    tagline: "Multi-unités casiers/bouteilles, réceptions et traçabilité",
    icon: "🍻",
    recommendedModules: ["core", "expenses", "debts", "orders", "inventory", "multi_units", "quotes", "analytics"],
    features: {
      multiUnits: true,
      batchesExpiry: true,
      fractionalSales: false,
      quotes: true,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Casier (24)", "Pack (6)", "Bouteille", "Fût (50L)"],
  },
  electronics: {
    key: "electronics",
    label: "Téléphonie & Électronique",
    tagline: "Factures avec garantie, devis proforma et suivi des marges",
    icon: "📱",
    recommendedModules: ["core", "expenses", "debts", "quotes", "receipts_invoices", "analytics", "inventory"],
    features: {
      multiUnits: false,
      batchesExpiry: false,
      fractionalSales: false,
      quotes: true,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Unité", "Kit", "Carton"],
  },
  cosmetics_pharma: {
    key: "cosmetics_pharma",
    label: "Cosmétique, Beauté & Soins",
    tagline: "Contrôle des DLC, lots fournisseurs et vente soignée",
    icon: "💊",
    recommendedModules: ["core", "expenses", "debts", "inventory", "orders", "analytics", "multi_units"],
    features: {
      multiUnits: true,
      batchesExpiry: true,
      fractionalSales: false,
      quotes: false,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Boîte (12)", "Flacon", "Tube", "Unité"],
  },
  services_other: {
    key: "services_other",
    label: "Prestations & Négoce B2B",
    tagline: "Devis professionnels, facturation A4 et suivi des paiements",
    icon: "🏢",
    recommendedModules: ["core", "expenses", "quotes", "receipts_invoices", "debts", "analytics"],
    features: {
      multiUnits: false,
      batchesExpiry: false,
      fractionalSales: false,
      quotes: true,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Forfait", "Heure", "Jour", "Prestation"],
  },
  other: {
    key: "other",
    label: "Commerce Général",
    tagline: "Configuration complète et équilibrée pour tout type d'activité",
    icon: "🏬",
    recommendedModules: ["core", "expenses", "debts", "inventory", "orders", "analytics", "quotes", "multi_units", "receipts_invoices"],
    features: {
      multiUnits: true,
      batchesExpiry: false,
      fractionalSales: true,
      quotes: true,
      debts: true,
      team: false,
      receiptsInvoices: true,
    },
    sampleUnits: ["Carton", "Pack", "Unité"],
  },
};

/**
 * Calcule l'état d'un module à 3 états pour une boutique donnée :
 */
export function resolveModuleStatus(
  moduleKey: ModuleKey,
  tier: SubscriptionTier,
  enabledModulesRaw?: string[] | null
): ModuleStatus {
  // Le core est toujours disponible
  if (moduleKey === 'core') return 'available';

  // Sécurisation : filtrer les clés inconnues
  const safeEnabledModules: Set<string> = new Set(
    (enabledModulesRaw && enabledModulesRaw.length > 0 ? enabledModulesRaw : DEFAULT_ENABLED_MODULES)
      .filter((k) => KNOWN_MODULE_KEYS.has(k as ModuleKey))
  );

  const effectiveTier = tier || 'PRO';
  const allowedByTier = TIER_MODULES[effectiveTier]?.includes(moduleKey) ?? false;
  if (!allowedByTier) {
    return 'locked';
  }

  const enabledByStore = safeEnabledModules.has(moduleKey);
  if (!enabledByStore) {
    return 'disabled';
  }

  return 'available';
}
