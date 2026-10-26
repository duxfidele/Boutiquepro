-- ==============================================================================
-- ROLLBACK ÉTAPE 5 : MODULE « HISTORIQUE DES FLUCTUATIONS DE PRIX »
-- ==============================================================================
-- Annule proprement toutes les modifications apportées par migration_price_history.sql
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_log_product_cost ON public.product_costs;
DROP FUNCTION IF EXISTS public.fn_log_product_cost_history();

DROP TRIGGER IF EXISTS trg_log_product_price ON public.products;
DROP FUNCTION IF EXISTS public.fn_log_product_price_history();

DROP TABLE IF EXISTS public.product_price_history CASCADE;

COMMIT;
