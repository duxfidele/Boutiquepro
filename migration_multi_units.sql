-- ==============================================================================
-- MIGRATION PHASE 3 : UNITÉS MULTIPLES (product_units, sale_items, order_items, create_sale)
-- ==============================================================================

BEGIN;

-- 1. CRÉATION DE LA TABLE product_units
CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  multiplier NUMERIC(12, 3) NOT NULL CHECK (multiplier > 0),
  price NUMERIC DEFAULT NULL,
  barcode TEXT DEFAULT NULL,
  is_reference BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_unit_name UNIQUE (product_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_units_store ON public.product_units(store_id);
CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON public.product_units(store_id, barcode);

-- 2. AJOUT DES COLONNES FIGÉES DANS sale_items
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1;

-- Rattrapage rétrocompatible : quantity_reference ne vaut JAMAIS 0 pour l'existant
UPDATE public.sale_items
SET quantity_reference = quantity
WHERE quantity_reference IS NULL OR quantity_reference = 0;

-- 3. AJOUT DES COLONNES DANS order_items (COMMANDES FOURNISSEURS)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1;

UPDATE public.order_items
SET quantity_reference = quantity
WHERE quantity_reference IS NULL OR quantity_reference = 0;

-- 4. ROW LEVEL SECURITY SUR product_units
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les membres de la boutique (Admin + Caissiers pour le scan POS)
DROP POLICY IF EXISTS "product_units_select_member" ON public.product_units;
CREATE POLICY "product_units_select_member" ON public.product_units
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = product_units.store_id
      AND sm.user_id = auth.uid()
  )
);

-- Écriture : Administrateur uniquement
DROP POLICY IF EXISTS "product_units_write_admin" ON public.product_units;
CREATE POLICY "product_units_write_admin" ON public.product_units
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = product_units.store_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = product_units.store_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'admin'
  )
);

-- Politiques restrictives d'abonnement actives (sub_gate_*)
DROP POLICY IF EXISTS sub_gate_ins ON public.product_units;
CREATE POLICY sub_gate_ins ON public.product_units AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_store_subscription_active(store_id));

DROP POLICY IF EXISTS sub_gate_upd ON public.product_units;
CREATE POLICY sub_gate_upd ON public.product_units AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_store_subscription_active(store_id))
WITH CHECK (public.is_store_subscription_active(store_id));

DROP POLICY IF EXISTS sub_gate_del ON public.product_units;
CREATE POLICY sub_gate_del ON public.product_units AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_store_subscription_active(store_id));

-- 5. RPC create_sale SÉCURISÉE CÔTÉ SERVEUR (ZÉRO CONFIANCE SUR LE COEFFICIENT CLIENT)
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
BEGIN
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

    -- RÉSOLUTION SERVEUR SÉCURISÉE DU COEFFICIENT MULTIPLICATEUR
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

    -- Insertion dans sale_items avec quantité de référence scellée
    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total,
      unit_name, unit_multiplier, quantity_reference
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total,
      v_unit_name, v_unit_multiplier, v_quantity_ref
    );

    -- Maintien strict de GREATEST(0, ...)
    UPDATE products
    SET stock = GREATEST(0, stock - v_quantity_ref)
    WHERE id = v_product_id AND store_id = p_store_id;

    -- Coût figé en unité de référence
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

COMMIT;
