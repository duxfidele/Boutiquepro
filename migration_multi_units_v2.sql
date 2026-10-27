-- ==============================================================================
-- MIGRATION PHASE 3 (V2) : UNITÉS MULTIPLES, CONDITIONNEMENTS ET VENTES CERTIFIÉES
-- ==============================================================================
-- Garantit :
-- 1. Stock unique centralisé (products.stock) en unité de référence
-- 2. Prix de vente et d'achat totalement indépendants par conditionnement
-- 3. Vente à montant fixe avec arrondi à 3 décimales certifié côté serveur
-- 4. Déduction atomique sans risque de doublons
-- 5. Préservation des coûts figés (sale_item_costs)
-- ==============================================================================

BEGIN;

-- 1. TABLE product_units : AJOUT DES COLONNES NÉCESSAIRES
CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  multiplier NUMERIC(12, 3) NOT NULL CHECK (multiplier > 0),
  price NUMERIC DEFAULT NULL,
  cost NUMERIC DEFAULT NULL,
  barcode TEXT DEFAULT NULL,
  is_reference BOOLEAN NOT NULL DEFAULT false,
  is_purchase_default BOOLEAN NOT NULL DEFAULT false,
  allow_fractional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_unit_name UNIQUE (product_id, name)
);

ALTER TABLE public.product_units ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT NULL;
ALTER TABLE public.product_units ADD COLUMN IF NOT EXISTS is_purchase_default BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.product_units ADD COLUMN IF NOT EXISTS allow_fractional BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_product_units_store ON public.product_units(store_id);
CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON public.product_units(store_id, barcode);

-- 2. ROW LEVEL SECURITY SUR product_units
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

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

-- 3. AJOUT DES COLONNES DANS sale_items ET order_items (IDEMPOTENT)
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1;

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1;

-- 4. RPC create_sale SÉCURISÉE CÔTÉ SERVEUR AVEC PRIX INDÉPENDANTS & VENTES À MONTANT FIXE
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
  v_db_product_price NUMERIC;
  v_unit_db_price NUMERIC;
  v_is_amount_mode BOOLEAN;
  v_custom_total NUMERIC;
BEGIN
  -- A. Détermination exacte des montants de la vente
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

  -- B. Enregistrement de la vente principale
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

  -- C. Traitement certifié de chaque ligne d'article
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := 'si_' || substr(md5(random()::text), 1, 8);
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_unit_name := COALESCE(NULLIF(TRIM(item->>'unitName'), ''), 'Unité');
    v_is_amount_mode := COALESCE((item->>'isAmountMode')::BOOLEAN, false);
    v_custom_total := (item->>'customTotal')::NUMERIC;

    -- 1. Recherche du prix de référence de base dans products
    SELECT price INTO v_db_product_price
    FROM public.products
    WHERE id = v_product_id AND store_id = p_store_id;

    IF v_db_product_price IS NULL THEN
      v_db_product_price := COALESCE((item->>'unitPrice')::NUMERIC, 0);
    END IF;

    -- 2. Résolution serveur du multiplier et du tarif propre au format
    IF v_unit_name = 'Unité' OR v_unit_name = 'Pièce' THEN
      v_unit_multiplier := 1;
      v_unit_price := v_db_product_price;
    ELSE
      SELECT multiplier, price INTO v_unit_multiplier, v_unit_db_price
      FROM public.product_units
      WHERE store_id = p_store_id
        AND product_id = v_product_id
        AND name = v_unit_name;

      IF v_unit_multiplier IS NULL THEN
        -- Repli sécurisé si l'unité n'a pas été trouvée en table
        v_unit_multiplier := COALESCE((item->>'unitMultiplier')::NUMERIC, 1);
        v_unit_price := COALESCE((item->>'unitPrice')::NUMERIC, v_db_product_price * v_unit_multiplier);
      ELSE
        -- Le prix propre au conditionnement prime sur tout prorata !
        IF v_unit_db_price IS NOT NULL AND v_unit_db_price > 0 THEN
          v_unit_price := v_unit_db_price;
        ELSE
          v_unit_price := COALESCE((item->>'unitPrice')::NUMERIC, v_db_product_price * v_unit_multiplier);
        END IF;
      END IF;
    END IF;

    -- 3. Traitement des ventes à montant fixe (ex: 100 FCFA d'huile sur un litre à 850 FCFA)
    IF v_is_amount_mode AND v_custom_total IS NOT NULL AND v_custom_total > 0 AND v_unit_price > 0 THEN
      -- Calcul de la quantité physique exacte arrondie à 3 décimales (au ml ou gramme près)
      v_quantity := ROUND(v_custom_total / v_unit_price, 3);
      v_item_total := v_custom_total; -- Le montant facturé est rigoureusement le montant demandé
    ELSE
      v_quantity := (item->>'quantity')::NUMERIC;
      v_item_total := COALESCE((item->>'total')::NUMERIC, ROUND(v_quantity * v_unit_price, 2));
    END IF;

    -- 4. Quantité déduite du stock physique unique (en unités de référence)
    v_quantity_ref := ROUND(v_quantity * v_unit_multiplier, 3);

    -- 5. Insertion scellée dans sale_items
    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total,
      unit_name, unit_multiplier, quantity_reference
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total,
      v_unit_name, v_unit_multiplier, v_quantity_ref
    );

    -- 6. Décrémentation atomique du stock physique unique
    UPDATE products
    SET stock = GREATEST(0, stock - v_quantity_ref)
    WHERE id = v_product_id AND store_id = p_store_id;

    -- 7. Scellement immuable du coût d'achat unitaire de référence dans sale_item_costs
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
