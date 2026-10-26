-- ==============================================================================
-- MIGRATION COMBINÉE : ÉTAPE 4 (LOTS & FEFO) & ÉTAPE 5 (HISTORIQUE PRIX)
-- ==============================================================================
-- Projet : MaBoutiquePro (SaaS Multi-Tenant)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTIE 1 : ÉTAPE 4 — TRAÇABILITÉ & DATES DE PÉREMPTION PAR LOT
-- ==============================================================================

-- 1. Table product_batches
CREATE TABLE IF NOT EXISTS public.product_batches (
  id TEXT PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  initial_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
  current_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
  order_id TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_store_product ON public.product_batches(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches(expiry_date);

-- 2. Colonnes traçabilité dans order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT NULL;

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL;

-- 3. Colonnes traçabilité dans sale_items
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS batch_id TEXT DEFAULT NULL;

ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT NULL;

ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL;

-- 4. Sécurité RLS sur product_batches
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_batches_select_member ON public.product_batches;
CREATE POLICY product_batches_select_member ON public.product_batches
FOR SELECT TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS product_batches_admin_all ON public.product_batches;
CREATE POLICY product_batches_admin_all ON public.product_batches
FOR ALL TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
  )
)
WITH CHECK (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
  )
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active'
  ) THEN
    DROP POLICY IF EXISTS sub_gate_batches ON public.product_batches;
    CREATE POLICY sub_gate_batches ON public.product_batches AS RESTRICTIVE FOR ALL TO authenticated
    USING (public.is_store_subscription_active(store_id))
    WITH CHECK (public.is_store_subscription_active(store_id));
  END IF;
END $$;

GRANT ALL ON public.product_batches TO authenticated, anon;

-- 5. Mise à jour de create_sale avec décompte automatique FEFO
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
  v_unit_name TEXT;
  v_unit_multiplier NUMERIC;
  v_quantity_ref NUMERIC;
  v_amount_paid NUMERIC;
  v_remaining_amount NUMERIC;
  v_payment_status TEXT;
  v_allow_negative_stock BOOLEAN := false;

  v_batch RECORD;
  v_remaining_deduct NUMERIC;
  v_deduct_qty NUMERIC;
  v_primary_batch_id TEXT;
  v_primary_batch_num TEXT;
  v_primary_expiry DATE;
BEGIN
  SELECT COALESCE(allow_negative_stock, false) INTO v_allow_negative_stock
  FROM public.settings
  WHERE store_id = p_store_id;

  IF v_allow_negative_stock IS NULL THEN
    v_allow_negative_stock := false;
  END IF;

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

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := 'si_' || substr(md5(random()::text), 1, 8);
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := (item->>'quantity')::NUMERIC;
    v_unit_price := (item->>'unitPrice')::NUMERIC;
    v_item_total := (item->>'total')::NUMERIC;

    v_unit_name := COALESCE(NULLIF(TRIM(item->>'unitName'), ''), 'Unité');
    
    IF v_unit_name = 'Unité' THEN
      v_unit_multiplier := 1;
    ELSE
      SELECT multiplier INTO v_unit_multiplier
      FROM public.product_units
      WHERE store_id = p_store_id
        AND product_id = v_product_id
        AND name = v_unit_name;

      IF v_unit_multiplier IS NULL THEN
        RAISE EXCEPTION 'Unité non reconnue [%] pour le produit [%]', v_unit_name, v_product_id;
      END IF;
    END IF;

    v_quantity_ref := ROUND(v_quantity * v_unit_multiplier, 3);

    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total,
      unit_name, unit_multiplier, quantity_reference
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total,
      v_unit_name, v_unit_multiplier, v_quantity_ref
    );

    IF v_allow_negative_stock THEN
      UPDATE products
      SET stock = stock - v_quantity_ref
      WHERE id = v_product_id AND store_id = p_store_id;
    ELSE
      UPDATE products
      SET stock = GREATEST(0, stock - v_quantity_ref)
      WHERE id = v_product_id AND store_id = p_store_id;
    END IF;

    -- DÉCOMPTE FEFO
    v_remaining_deduct := v_quantity_ref;
    v_primary_batch_id := NULL;
    v_primary_batch_num := NULL;
    v_primary_expiry := NULL;

    FOR v_batch IN 
      SELECT id, batch_number, expiry_date, current_quantity
      FROM public.product_batches
      WHERE store_id = p_store_id 
        AND product_id = v_product_id 
        AND current_quantity > 0
      ORDER BY expiry_date ASC, created_at ASC
    LOOP
      IF v_remaining_deduct <= 0 THEN
        EXIT;
      END IF;

      IF v_primary_batch_num IS NULL THEN
        v_primary_batch_id := v_batch.id;
        v_primary_batch_num := v_batch.batch_number;
        v_primary_expiry := v_batch.expiry_date;
      END IF;

      v_deduct_qty := LEAST(v_batch.current_quantity, v_remaining_deduct);

      UPDATE public.product_batches
      SET current_quantity = current_quantity - v_deduct_qty,
          updated_at = now()
      WHERE id = v_batch.id;

      v_remaining_deduct := v_remaining_deduct - v_deduct_qty;
    END LOOP;

    IF v_primary_batch_num IS NOT NULL THEN
      UPDATE public.sale_items
      SET batch_id = v_primary_batch_id,
          batch_number = v_primary_batch_num,
          expiry_date = v_primary_expiry
      WHERE id = v_sale_item_id;
    END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION create_sale TO authenticated, anon;

-- ==============================================================================
-- PARTIE 2 : ÉTAPE 5 — HISTORIQUE DES FLUCTUATIONS DE PRIX
-- ==============================================================================

-- 1. Table product_price_history
CREATE TABLE IF NOT EXISTS public.product_price_history (
  id TEXT PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('selling', 'cost', 'unit_selling')),
  unit_name TEXT DEFAULT NULL,
  old_price NUMERIC(15, 3) NOT NULL,
  new_price NUMERIC(15, 3) NOT NULL,
  change_reason TEXT DEFAULT NULL,
  user_id UUID DEFAULT auth.uid(),
  user_name TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_store_product ON public.product_price_history(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON public.product_price_history(created_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_history_admin_all ON public.product_price_history;
CREATE POLICY price_history_admin_all ON public.product_price_history
FOR ALL TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
  )
)
WITH CHECK (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
  )
);

DROP POLICY IF EXISTS price_history_member_select ON public.product_price_history;
CREATE POLICY price_history_member_select ON public.product_price_history
FOR SELECT TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
  AND (
    price_type != 'cost'
    OR store_id IN (
      SELECT sm.store_id 
      FROM public.store_members sm 
      WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
    )
  )
);

GRANT ALL ON public.product_price_history TO authenticated, anon;

-- 2. Triggers automatiques sur products et product_costs
CREATE OR REPLACE FUNCTION public.fn_log_product_price_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT := 'Système';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.price IS DISTINCT FROM NEW.price THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', email, 'Utilisateur')
    INTO v_user_name
    FROM auth.users
    WHERE id = auth.uid();

    INSERT INTO public.product_price_history (
      id, store_id, product_id, price_type, old_price, new_price, change_reason, user_id, user_name, created_at
    ) VALUES (
      'ph_' || gen_random_uuid()::text,
      NEW.store_id,
      NEW.id,
      'selling',
      OLD.price,
      NEW.price,
      'Ajustement du prix de vente',
      auth.uid(),
      COALESCE(v_user_name, 'Système'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_price ON public.products;
CREATE TRIGGER trg_log_product_price
AFTER UPDATE OF price ON public.products
FOR EACH ROW
WHEN (OLD.price IS DISTINCT FROM NEW.price)
EXECUTE FUNCTION public.fn_log_product_price_history();

CREATE OR REPLACE FUNCTION public.fn_log_product_cost_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT := 'Système';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.cost IS DISTINCT FROM NEW.cost THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', email, 'Utilisateur')
    INTO v_user_name
    FROM auth.users
    WHERE id = auth.uid();

    INSERT INTO public.product_price_history (
      id, store_id, product_id, price_type, old_price, new_price, change_reason, user_id, user_name, created_at
    ) VALUES (
      'ph_' || gen_random_uuid()::text,
      NEW.store_id,
      NEW.product_id,
      'cost',
      OLD.cost,
      NEW.cost,
      'Ajustement du coût d''achat fournisseur',
      auth.uid(),
      COALESCE(v_user_name, 'Système'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_cost ON public.product_costs;
CREATE TRIGGER trg_log_product_cost
AFTER UPDATE OF cost ON public.product_costs
FOR EACH ROW
WHEN (OLD.cost IS DISTINCT FROM NEW.cost)
EXECUTE FUNCTION public.fn_log_product_cost_history();

COMMIT;
