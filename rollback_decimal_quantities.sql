-- ==============================================================================
-- ROLLBACK ÉTAPE 3.1 : RETOUR AUX ENTIERS (INTEGER)
-- ==============================================================================
BEGIN;

-- 1. Supprimer temporairement la vue
DROP VIEW IF EXISTS public.v_products_cashier CASCADE;

-- 2. Reconvertir les colonnes en INTEGER avec arrondi
ALTER TABLE public.products ALTER COLUMN stock TYPE INTEGER USING ROUND(stock)::INTEGER;
ALTER TABLE public.sale_items ALTER COLUMN quantity TYPE INTEGER USING ROUND(quantity)::INTEGER;
ALTER TABLE public.order_items ALTER COLUMN quantity TYPE INTEGER USING ROUND(quantity)::INTEGER;

-- 3. Recréer la vue
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

GRANT SELECT ON public.v_products_cashier TO authenticated;

COMMIT;
