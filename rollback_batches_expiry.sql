-- ==============================================================================
-- ROLLBACK ÉTAPE 4 : RETOUR ARRIÈRE DU MODULE TRAÇABILITÉ & PÉREMPTION
-- ==============================================================================

BEGIN;

-- 1. Restauration de create_sale sans la boucle FEFO
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

-- 2. Suppression des colonnes ajoutées dans order_items et sale_items
ALTER TABLE public.order_items DROP COLUMN IF EXISTS batch_number;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS expiry_date;
ALTER TABLE public.sale_items DROP COLUMN IF EXISTS batch_id;
ALTER TABLE public.sale_items DROP COLUMN IF EXISTS batch_number;
ALTER TABLE public.sale_items DROP COLUMN IF EXISTS expiry_date;

-- 3. Suppression de la table product_batches
DROP TABLE IF EXISTS public.product_batches CASCADE;

COMMIT;
