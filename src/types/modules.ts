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
  | 'general_store'  // Alimentation générale / Supérette
  | 'fashion'        // Vêtements & Accessoires de mode
  | 'electronics'    // Électroménager & Téléphonie
  | 'hardware'       // Quincaillerie & Matériaux
  | 'other';         // Autre activité

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
    category: 'future',
    minTier: 'PRO',
    routes: [],
    isPlaceholder: true,
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
    category: 'future',
    minTier: 'PRO',
    routes: [],
    isPlaceholder: true,
    adminOnly: true,
  },
};

/**
 * Matrice stricte des modules inclus par formule d'abonnement.
 * Reproduit EXACTEMENT les accès actuels sans dupliquer les quotas numériques.
 */
export const TIER_MODULES: Record<SubscriptionTier, ModuleKey[]> = {
  STARTER: ['core', 'expenses'],
  PRO: ['core', 'expenses', 'debts', 'receipts_invoices', 'inventory', 'orders', 'analytics', 'team'],
  BUSINESS: ['core', 'expenses', 'debts', 'receipts_invoices', 'inventory', 'orders', 'analytics', 'team', 'multi_store'],
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
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store',
];

/**
 * Profils métiers disponibles
 */
export const STORE_SECTORS: { key: StoreSector; label: string; icon: string }[] = [
  { key: 'general_store', label: 'Alimentation générale / Supérette', icon: '🛒' },
  { key: 'fashion', label: 'Vêtements & Prêt-à-porter', icon: '👗' },
  { key: 'electronics', label: 'Électroménager & Téléphonie', icon: '📱' },
  { key: 'hardware', label: 'Quincaillerie & Matériaux', icon: '🔨' },
  { key: 'other', label: 'Autre commerce / Général', icon: '🏬' },
];

/**
 * Calcule l'état d'un module à 3 états pour une boutique donnée :
 * 1. 'available' : inclus dans la formule ET activé par le gérant
 * 2. 'locked' : NON inclus dans la formule (visible avec cadenas PRO/BUSINESS)
 * 3. 'disabled' : inclus dans la formule mais désactivé par le gérant (masqué de l'UI)
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

  const allowedByTier = TIER_MODULES[tier]?.includes(moduleKey) ?? false;
  if (!allowedByTier) {
    return 'locked';
  }

  const enabledByStore = safeEnabledModules.has(moduleKey);
  if (!enabledByStore) {
    return 'disabled';
  }

  return 'available';
}
