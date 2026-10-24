-- ==============================================================================
-- MIGRATION PHASE 2 : FIGER LE COÛT D'ACHAT DANS LES VENTES (sale_item_costs)
-- ==============================================================================

BEGIN;

-- 1. CRÉATION DE LA TABLE sale_item_costs
CREATE TABLE IF NOT EXISTS public.sale_item_costs (
  sale_item_id TEXT PRIMARY KEY REFERENCES public.sale_items(id) ON DELETE CASCADE,
  sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  is_estimated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour accélérer les requêtes d'analytique par boutique et par vente
CREATE INDEX IF NOT EXISTS idx_sale_item_costs_store ON public.sale_item_costs(store_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_costs_sale ON public.sale_item_costs(sale_id);

-- 2. ACTIVATION DU ROW LEVEL SECURITY
ALTER TABLE public.sale_item_costs ENABLE ROW LEVEL SECURITY;

-- 3. POLITIQUES RLS : LECTURE ADMIN UNIQUEMENT (AUCUNE ÉCRITURE CLIENT)
DROP POLICY IF EXISTS "sale_item_costs_select_admin" ON public.sale_item_costs;
CREATE POLICY "sale_item_costs_select_admin" ON public.sale_item_costs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = sale_item_costs.store_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'admin'
  )
);

-- 4. FONCTION SECURITY DEFINER : ÉCRITURE SÉCURISÉE DU COÛT FIGÉ
CREATE OR REPLACE FUNCTION public.record_frozen_sale_item_cost(
  p_sale_item_id TEXT,
  p_sale_id TEXT,
  p_store_id UUID,
  p_product_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_member BOOLEAN := false;
  v_unit_cost NUMERIC := 0;
BEGIN
  -- A. Vérifier que l'utilisateur connecté est membre de la boutique (admin ou caissier)
  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_id = p_store_id AND user_id = v_caller_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Accès refusé : utilisateur non membre de cette boutique.';
    END IF;
  END IF;

  -- B. Lecture sécurisée du coût actuel dans product_costs (jamais lu par le client caissier)
  SELECT COALESCE(cost, 0) INTO v_unit_cost
  FROM public.product_costs
  WHERE product_id = p_product_id AND store_id = p_store_id
  LIMIT 1;

  IF v_unit_cost IS NULL THEN
    v_unit_cost := 0;
  END IF;

  -- C. Enregistrement immuable du coût figé dans sale_item_costs (non estimé pour toute nouvelle vente)
  INSERT INTO public.sale_item_costs (
    sale_item_id,
    sale_id,
    store_id,
    unit_cost,
    is_estimated
  ) VALUES (
    p_sale_item_id,
    p_sale_id,
    p_store_id,
    v_unit_cost,
    false
  )
  ON CONFLICT (sale_item_id) DO NOTHING;
END;
$$;

-- 5. RPC create_sale ATOMIQUE AVEC COÛT FIGÉ
CREATE OR REPLACE FUNCTION create_sale(
  p_store_id UUID,
  p_sale_id TEXT,
  p_subtotal NUMERIC,
  p_tax NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_customer_name TEXT,
  p_created_at TIMESTAMP WITH TIME ZONE,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_remaining_amount NUMERIC DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL,
  p_due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  item JSONB;
  v_sale_item_id TEXT;
  v_product_id TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_item_total NUMERIC;
  v_amount_paid NUMERIC;
  v_remaining_amount NUMERIC;
  v_payment_status TEXT;
BEGIN
  -- Détermination exacte des montants
  IF p_payment_method = 'credit' THEN
    v_amount_paid := COALESCE(p_amount_paid, 0);
    v_remaining_amount := COALESCE(p_remaining_amount, GREATEST(0, p_total - v_amount_paid));
    v_payment_status := COALESCE(p_payment_status, 
      CASE 
        WHEN v_remaining_amount = 0 THEN 'paid'
        WHEN v_amount_paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END
    );
  ELSE
    v_amount_paid := COALESCE(p_amount_paid, p_total);
    v_remaining_amount := COALESCE(p_remaining_amount, 0);
    v_payment_status := COALESCE(p_payment_status, 'paid');
  END IF;

  -- 1. Insérer la vente principale
  INSERT INTO sales (
    id, store_id, user_id, subtotal, tax, discount, total, 
    payment_method, customer_name, customer_phone, 
    amount_paid, remaining_amount, payment_status, due_date, created_at
  ) VALUES (
    p_sale_id, p_store_id, auth.uid(), p_subtotal, p_tax, p_discount, p_total, 
    p_payment_method, p_customer_name, p_customer_phone, 
    v_amount_paid, v_remaining_amount, v_payment_status, p_due_date, 
    COALESCE(p_created_at, now())
  );

  -- 2. Boucle sur les articles
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := 'si_' || substr(md5(random()::text), 1, 8);
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := (item->>'quantity')::NUMERIC;
    v_unit_price := (item->>'unitPrice')::NUMERIC;
    v_item_total := (item->>'total')::NUMERIC;

    -- A. Insertion dans sale_items (accessible par le caissier pour tickets/reçus)
    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total
    );

    -- B. Décrémentation du stock
    UPDATE products
    SET stock = GREATEST(0, stock - v_quantity)
    WHERE id = v_product_id AND store_id = p_store_id;

    -- C. Figer le coût d'achat unitaire via SECURITY DEFINER
    PERFORM public.record_frozen_sale_item_cost(
      v_sale_item_id,
      p_sale_id,
      p_store_id,
      v_product_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'sale_id', p_sale_id,
    'amount_paid', v_amount_paid,
    'remaining_amount', v_remaining_amount,
    'payment_status', v_payment_status
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 6. RATTRAPAGE (BACKFILL) DES ANCIENNES VENTES AVEC COÛT ESTIMÉ
INSERT INTO public.sale_item_costs (
  sale_item_id, sale_id, store_id, unit_cost, is_estimated
)
SELECT 
  si.id AS sale_item_id,
  si.sale_id,
  si.store_id,
  COALESCE(pc.cost, 0) AS unit_cost,
  true AS is_estimated
FROM public.sale_items si
LEFT JOIN public.product_costs pc 
  ON pc.product_id = si.product_id AND pc.store_id = si.store_id
ON CONFLICT (sale_item_id) DO NOTHING;

COMMIT;
