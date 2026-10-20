/**
 * SOURCE DE VÉRITÉ UNIQUE : FORMULES D'ABONNEMENT MABOUTIQUEPRO
 * Centralise les tarifs, limites et autorisations pour l'ensemble du SaaS.
 */

export type SubscriptionTier = 'STARTER' | 'PRO' | 'BUSINESS';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'past_due' | 'cancelled';

export type PlanKey =
  | 'starter_monthly'
  | 'starter_annual'
  | 'pro_monthly'
  | 'pro_annual'
  | 'business_monthly'
  | 'business_annual';

export interface PlanLimits {
  maxStores: number;
  maxCashiers: number; // Au total sur le compte
  canPrintReceipts: boolean;
  canOfferCredit: boolean;
  canUseInventory: boolean;
  canUseManualOrders: boolean;
  canUseAdvancedAnalytics: boolean;
  canManageTeam: boolean;
  hasMultiStore: boolean;
}

export interface PlanConfig {
  id: PlanKey;
  tier: SubscriptionTier;
  cycle: BillingCycle;
  durationMonths: number;
  amount: number;
  currency: 'XOF';
  title: string;
  monthlyEquivalent: number;
  annualSavings: number;
  limits: PlanLimits;
}

export const TIER_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  STARTER: {
    maxStores: 1,
    maxCashiers: 0,
    canPrintReceipts: false,
    canOfferCredit: false,
    canUseInventory: false,
    canUseManualOrders: false,
    canUseAdvancedAnalytics: false,
    canManageTeam: false,
    hasMultiStore: false,
  },
  PRO: {
    maxStores: 1,
    maxCashiers: 1,
    canPrintReceipts: true,
    canOfferCredit: true,
    canUseInventory: true,
    canUseManualOrders: true,
    canUseAdvancedAnalytics: true,
    canManageTeam: true,
    hasMultiStore: false,
  },
  BUSINESS: {
    maxStores: 3,
    maxCashiers: 3,
    canPrintReceipts: true,
    canOfferCredit: true,
    canUseInventory: true,
    canUseManualOrders: true,
    canUseAdvancedAnalytics: true,
    canManageTeam: true,
    hasMultiStore: true,
  },
};

export const SUBSCRIPTION_PLANS: Record<PlanKey, PlanConfig> = {
  starter_monthly: {
    id: 'starter_monthly',
    tier: 'STARTER',
    cycle: 'monthly',
    durationMonths: 1,
    amount: 100, // Rehaussé à 100 FCFA : minimum obligatoire pour Mobile Money / Moneriz
    currency: 'XOF',
    title: 'Abonnement Starter (1 Mois) - MaBoutiquePro',
    monthlyEquivalent: 100,
    annualSavings: 0,
    limits: TIER_LIMITS.STARTER,
  },
  starter_annual: {
    id: 'starter_annual',
    tier: 'STARTER',
    cycle: 'annual',
    durationMonths: 12,
    amount: 500,
    currency: 'XOF',
    title: 'Abonnement Starter (1 An) - MaBoutiquePro',
    monthlyEquivalent: 42,
    annualSavings: 100,
    limits: TIER_LIMITS.STARTER,
  },
  pro_monthly: {
    id: 'pro_monthly',
    tier: 'PRO',
    cycle: 'monthly',
    durationMonths: 1,
    amount: 100,
    currency: 'XOF',
    title: 'Abonnement Pro (1 Mois) - MaBoutiquePro',
    monthlyEquivalent: 100,
    annualSavings: 0,
    limits: TIER_LIMITS.PRO,
  },
  pro_annual: {
    id: 'pro_annual',
    tier: 'PRO',
    cycle: 'annual',
    durationMonths: 12,
    amount: 1000,
    currency: 'XOF',
    title: 'Abonnement Pro (1 An) - MaBoutiquePro',
    monthlyEquivalent: 83,
    annualSavings: 200,
    limits: TIER_LIMITS.PRO,
  },
  business_monthly: {
    id: 'business_monthly',
    tier: 'BUSINESS',
    cycle: 'monthly',
    durationMonths: 1,
    amount: 150,
    currency: 'XOF',
    title: 'Abonnement Business (1 Mois) - MaBoutiquePro',
    monthlyEquivalent: 150,
    annualSavings: 0,
    limits: TIER_LIMITS.BUSINESS,
  },
  business_annual: {
    id: 'business_annual',
    tier: 'BUSINESS',
    cycle: 'annual',
    durationMonths: 12,
    amount: 1500,
    currency: 'XOF',
    title: 'Abonnement Business (1 An) - MaBoutiquePro',
    monthlyEquivalent: 125,
    annualSavings: 300,
    limits: TIER_LIMITS.BUSINESS,
  },
};

/**
 * Normalise le nom de formule (gestion de la rétro-compatibilité TRIAL / PREMIUM)
 */
export function normalizeTier(tierName?: string | null): SubscriptionTier {
  if (!tierName) return 'PRO';
  const clean = tierName.toUpperCase().trim();
  if (clean === 'STARTER') return 'STARTER';
  if (clean === 'BUSINESS') return 'BUSINESS';
  // TRIAL ou PREMIUM ou PRO -> PRO par défaut
  return 'PRO';
}

export function getTierLimits(tierName?: string | null): PlanLimits {
  const tier = normalizeTier(tierName);
  return TIER_LIMITS[tier];
}

export function canPrintReceipts(tierName?: string | null): boolean {
  return getTierLimits(tierName).canPrintReceipts;
}

export function canOfferCredit(tierName?: string | null): boolean {
  return getTierLimits(tierName).canOfferCredit;
}

export function canUseInventory(tierName?: string | null): boolean {
  return getTierLimits(tierName).canUseInventory;
}

export function canUseManualOrders(tierName?: string | null): boolean {
  return getTierLimits(tierName).canUseManualOrders;
}

export function canUseAdvancedAnalytics(tierName?: string | null): boolean {
  return getTierLimits(tierName).canUseAdvancedAnalytics;
}

export function canManageTeam(tierName?: string | null): boolean {
  return getTierLimits(tierName).canManageTeam;
}

export function hasMultiStore(tierName?: string | null): boolean {
  return getTierLimits(tierName).hasMultiStore;
}

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}
