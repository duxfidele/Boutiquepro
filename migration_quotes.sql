-- ==============================================================================
-- MIGRATION ÉTAPE 6 : MODULE « DEVIS & FACTURES PROFORMA » (quotes & quote_items)
-- ==============================================================================
-- Auteur : Fr Fidèle & Antigravity
-- Projet : MaBoutiquePro (SaaS Multi-Tenant)
-- Objectif :
--   1. Créer la table quotes pour la gestion des devis et factures proforma
--   2. Créer la table quote_items pour le détail des lignes chiffrées
--   3. Mettre en place la fonction atomique convert_quote_to_sale
--   4. Sécuriser les accès via Row Level Security (RLS) et abonnement
-- ==============================================================================

BEGIN;

-- 1. Table quotes (En-tête de devis / proforma)
CREATE TABLE IF NOT EXISTS public.quotes (
  id TEXT PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT NULL,
  customer_address TEXT DEFAULT NULL,
  subtotal NUMERIC(15, 3) NOT NULL DEFAULT 0,
  tax NUMERIC(15, 3) NOT NULL DEFAULT 0,
  discount NUMERIC(15, 3) NOT NULL DEFAULT 0,
  total NUMERIC(15, 3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'converted', 'rejected', 'expired')) DEFAULT 'draft',
  validity_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  sale_id TEXT REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_store ON public.quotes(store_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(store_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);

-- 2. Table quote_items (Lignes d'articles du devis)
CREATE TABLE IF NOT EXISTS public.quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity NUMERIC(15, 3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15, 3) NOT NULL DEFAULT 0,
  total NUMERIC(15, 3) NOT NULL DEFAULT 0,
  unit_name TEXT NOT NULL DEFAULT 'Unité',
  unit_multiplier NUMERIC(15, 3) NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_store ON public.quote_items(store_id);

-- 3. Sécurité Row Level Security (RLS)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotes_member_all ON public.quotes;
CREATE POLICY quotes_member_all ON public.quotes
FOR ALL TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
)
WITH CHECK (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS quote_items_member_all ON public.quote_items;
CREATE POLICY quote_items_member_all ON public.quote_items
FOR ALL TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
)
WITH CHECK (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
);

-- Gate abonnement
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active'
  ) THEN
    DROP POLICY IF EXISTS sub_gate_quotes ON public.quotes;
    CREATE POLICY sub_gate_quotes ON public.quotes AS RESTRICTIVE FOR ALL TO authenticated
    USING (public.is_store_subscription_active(store_id))
    WITH CHECK (public.is_store_subscription_active(store_id));

    DROP POLICY IF EXISTS sub_gate_quote_items ON public.quote_items;
    CREATE POLICY sub_gate_quote_items ON public.quote_items AS RESTRICTIVE FOR ALL TO authenticated
    USING (public.is_store_subscription_active(store_id))
    WITH CHECK (public.is_store_subscription_active(store_id));
  END IF;
END $$;

GRANT ALL ON public.quotes TO authenticated, anon;
GRANT ALL ON public.quote_items TO authenticated, anon;

-- 4. Fonction RPC atomique : Convertir un Devis en Vente directe
CREATE OR REPLACE FUNCTION convert_quote_to_sale(
  p_quote_id TEXT,
  p_sale_id TEXT,
  p_payment_method TEXT DEFAULT 'cash',
  p_amount_paid NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_quote RECORD;
  v_items JSONB;
  v_sale_result JSONB;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Devis introuvable [%]', p_quote_id;
  END IF;

  IF v_quote.status = 'converted' THEN
    RAISE EXCEPTION 'Ce devis a déjà été converti en vente.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'productId', qi.product_id,
      'productName', qi.product_name,
      'quantity', qi.quantity,
      'unitPrice', qi.unit_price,
      'total', qi.total,
      'unitName', qi.unit_name
    )
  ) INTO v_items
  FROM public.quote_items qi
  WHERE qi.quote_id = p_quote_id;

  v_sale_result := public.create_sale(
    v_quote.store_id,
    p_sale_id,
    v_quote.subtotal,
    v_quote.tax,
    v_quote.discount,
    v_quote.total,
    p_payment_method,
    v_quote.customer_name,
    now(),
    v_items,
    v_quote.customer_phone,
    p_amount_paid,
    NULL,
    NULL,
    NULL
  );

  UPDATE public.quotes
  SET status = 'converted',
      sale_id = p_sale_id,
      updated_at = now()
  WHERE id = p_quote_id;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'quote_id', p_quote_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION convert_quote_to_sale TO authenticated, anon;

COMMIT;
