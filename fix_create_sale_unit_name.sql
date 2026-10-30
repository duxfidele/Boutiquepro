-- ==============================================================================
-- MISE À JOUR RPC create_sale : PRISE EN CHARGE DES UNITÉS DE DÉTAIL
-- ("Pièce / Unité", "Pièce", "Unité", "Litre", etc.) SANS AUCUN BLOCAGE
-- ==============================================================================

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
    
    -- Résolution tolérante et certifiée de l'unité
    IF v_unit_name = 'Unité' 
       OR v_unit_name = 'Pièce' 
       OR v_unit_name = 'Pièce / Unité'
       OR LOWER(v_unit_name) = 'unite'
       OR LOWER(v_unit_name) = 'piece'
       OR LOWER(v_unit_name) = 'pièce'
       OR COALESCE((item->>'unitMultiplier')::NUMERIC, 1) = 1 THEN
      v_unit_multiplier := 1;
    ELSE
      SELECT multiplier INTO v_unit_multiplier
      FROM public.product_units
      WHERE store_id = p_store_id
        AND product_id = v_product_id
        AND name = v_unit_name;

      IF v_unit_multiplier IS NULL THEN
        -- Repli sécurisé pour les libellés personnalisés (ex: Litre, Boîte, etc.)
        v_unit_multiplier := COALESCE(NULLIF((item->>'unitMultiplier')::NUMERIC, 0), 1);
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

    -- DÉCOMPTE FEFO AUTOMATIQUE
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

    -- Enregistrement du coût d'achat figé
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_frozen_sale_item_cost') THEN
      PERFORM public.record_frozen_sale_item_cost(
        v_sale_item_id,
        p_sale_id,
        p_store_id,
        v_product_id
      );
    END IF;
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
