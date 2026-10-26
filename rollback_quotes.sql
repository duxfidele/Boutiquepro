-- ==============================================================================
-- ROLLBACK ÉTAPE 6 : MODULE « DEVIS & FACTURES PROFORMA »
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.convert_quote_to_sale(TEXT, TEXT, TEXT, NUMERIC);
DROP TABLE IF EXISTS public.quote_items CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;

COMMIT;
