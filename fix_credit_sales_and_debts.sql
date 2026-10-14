-- ==============================================================================
-- MIGRATION CORRECTIVE : VENTES À CRÉDIT, CARNET DE DETTES ET RECOUVREMENT
-- À exécuter dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. S'assurer que les colonnes de crédit et dette existent sur public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- 2. Supprimer l'ancienne signature à 10 paramètres pour éviter les conflits d'overload
DROP FUNCTION IF EXISTS create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, JSONB);

-- 3. Créer la nouvelle fonction create_sale atomique intégrant le crédit et le reste dû
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
  v_product_id TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_item_total NUMERIC;
  v_amount_paid NUMERIC;
  v_remaining_amount NUMERIC;
  v_payment_status TEXT;
BEGIN
  -- Détermination exacte des montants pour vente comptant ou vente à crédit
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

  -- 1. Insérer la vente directement avec toutes ses métadonnées de crédit
  INSERT INTO sales (
    id, 
    store_id, 
    user_id, 
    subtotal, 
    tax, 
    discount, 
    total, 
    payment_method, 
    customer_name, 
    customer_phone, 
    amount_paid, 
    remaining_amount, 
    payment_status, 
    due_date, 
    created_at
  ) VALUES (
    p_sale_id, 
    p_store_id, 
    auth.uid(), 
    p_subtotal, 
    p_tax, 
    p_discount, 
    p_total, 
    p_payment_method, 
    p_customer_name, 
    p_customer_phone, 
    v_amount_paid, 
    v_remaining_amount, 
    v_payment_status, 
    p_due_date, 
    COALESCE(p_created_at, now())
  );

  -- 2. Boucler sur les articles pour les insérer et mettre à jour le stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := (item->>'quantity')::NUMERIC;
    v_unit_price := (item->>'unitPrice')::NUMERIC;
    v_item_total := (item->>'total')::NUMERIC;

    -- Insérer l'article de vente
    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total
    ) VALUES (
      'si_' || substr(md5(random()::text), 1, 8),
      p_sale_id, 
      p_store_id, 
      v_product_id, 
      v_product_name, 
      v_quantity, 
      v_unit_price, 
      v_item_total
    );

    -- Mettre à jour le stock du produit
    UPDATE products
    SET stock = GREATEST(0, stock - v_quantity)
    WHERE id = v_product_id AND store_id = p_store_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'sale_id', p_sale_id,
    'amount_paid', v_amount_paid,
    'remaining_amount', v_remaining_amount,
    'payment_status', v_payment_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 4. Fonction RPC atomique pour le recouvrement d'une dette (paiement acompte ou solde)
CREATE OR REPLACE FUNCTION record_debt_payment(
  p_store_id UUID,
  p_sale_id TEXT,
  p_payment_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_note TEXT DEFAULT NULL,
  p_cashier_name TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_sale RECORD;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Vérifier que l'utilisateur appartient bien à la boutique
  IF NOT EXISTS (SELECT 1 FROM store_members WHERE store_id = p_store_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé pour cette boutique';
  END IF;

  -- 1. Récupérer la vente avec verrou pour mise à jour
  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id AND store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable (id: %, store_id: %)', p_sale_id, p_store_id;
  END IF;

  -- 2. Calculer les nouveaux soldes
  v_new_paid := COALESCE(v_sale.amount_paid, 0) + p_payment_amount;
  v_new_remaining := GREATEST(0, COALESCE(v_sale.remaining_amount, GREATEST(0, v_sale.total - COALESCE(v_sale.amount_paid, 0))) - p_payment_amount);
  
  IF v_new_remaining = 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- 3. Mettre à jour la vente
  UPDATE sales
  SET
    amount_paid = v_new_paid,
    remaining_amount = v_new_remaining,
    payment_status = v_new_status
  WHERE id = p_sale_id AND store_id = p_store_id;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'amount_paid', v_new_paid,
    'remaining_amount', v_new_remaining,
    'payment_status', v_new_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 5. Sécurité RLS sur la table sales pour permettre la lecture, l'insertion et la mise à jour des recouvrements
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Select" ON public.sales;
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT get_user_stores()));

DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Insert" ON public.sales;
CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT get_user_stores()));

DROP POLICY IF EXISTS "sales_update" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Update" ON public.sales;
CREATE POLICY "sales_update" ON public.sales
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT get_user_stores()))
  WITH CHECK (store_id IN (SELECT get_user_stores()));

DROP POLICY IF EXISTS "sales_delete" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Delete" ON public.sales;
CREATE POLICY "sales_delete" ON public.sales
  FOR DELETE TO authenticated
  USING (get_user_role_in_store(store_id) = 'admin');

-- 6. Réparer immédiatement toutes les ventes à crédit antérieures dont le reste dû a été erronément mis à zéro
UPDATE public.sales
SET 
  remaining_amount = GREATEST(0, total - COALESCE(amount_paid, 0)),
  payment_status = CASE 
    WHEN GREATEST(0, total - COALESCE(amount_paid, 0)) = 0 THEN 'paid'
    WHEN COALESCE(amount_paid, 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END
WHERE payment_method = 'credit';

-- Message de confirmation
SELECT 'Correction des ventes à crédit et RPC create_sale / record_debt_payment appliquée avec succès !' AS resultat;
