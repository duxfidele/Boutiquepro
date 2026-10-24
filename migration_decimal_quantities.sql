-- ==============================================================================
-- MIGRATION ÉTAPE 3.1 : DÉCIMALES POUR LE STOCK ET LES VENTES (VRAC / AU MONTANT)
-- ==============================================================================
BEGIN;

-- 1. Supprimer temporairement la vue sécurisée caissier qui dépend de la colonne stock
DROP VIEW IF EXISTS public.v_products_cashier CASCADE;

-- 2. Passer les colonnes de stock et de quantité en NUMERIC(15, 3) (3 décimales)
ALTER TABLE public.products ALTER COLUMN stock TYPE NUMERIC(15, 3);
ALTER TABLE public.sale_items ALTER COLUMN quantity TYPE NUMERIC(15, 3);
ALTER TABLE public.order_items ALTER COLUMN quantity TYPE NUMERIC(15, 3);

-- 3. Recréer immédiatement la vue sécurisée caissier (sans exposer le coût d'achat)
CREATE OR REPLACE VIEW public.v_products_cashier AS
SELECT 
  id, 
  store_id, 
  name, 
  sku, 
  category, 
  price, 
  stock, 
  min_stock as "minStock",
  image, 
  created_at
FROM public.products;

-- 4. Rétablir les permissions de lecture pour tous les utilisateurs authentifiés
GRANT SELECT ON public.v_products_cashier TO authenticated;

COMMIT;
