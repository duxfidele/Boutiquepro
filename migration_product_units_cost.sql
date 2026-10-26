-- ==============================================================================
-- MIGRATION : AJOUT DE LA COLONNE COST DANS PRODUCT_UNITS
-- Permet de mémoriser le coût d'achat fournisseur par conditionnement (carton, bidon, etc.)
-- ==============================================================================

ALTER TABLE public.product_units
ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.product_units.cost IS 'Prix d'achat fournisseur du conditionnement (ex: prix d'achat du carton ou bidon)';
