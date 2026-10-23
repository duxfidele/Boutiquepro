-- ==============================================================================
-- MIGRATION MABOUTIQUEPRO : SYSTÈME DE MODULES PAR BOUTIQUE (ADDITIF & TRANSACTIONNEL)
-- À exécuter dans le SQL Editor de Supabase sur le projet de test
-- ==============================================================================

BEGIN;

-- 1. Ajout additif des colonnes sur public.stores avec NOT NULL DEFAULT
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] 
NOT NULL DEFAULT ARRAY[
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store'
]::TEXT[];

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS business_sector TEXT DEFAULT NULL;

-- 2. Sécurisation et remplissage rétroactif pour toutes les boutiques existantes
UPDATE public.stores 
SET enabled_modules = ARRAY[
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store'
]::TEXT[]
WHERE enabled_modules IS NULL 
   OR array_length(enabled_modules, 1) IS NULL 
   OR array_length(enabled_modules, 1) = 0;

-- 3. Requête de contrôle immédiat
SELECT id, name, enabled_modules, business_sector 
FROM public.stores;

COMMIT;
