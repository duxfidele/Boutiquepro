-- ==============================================================================
-- BOUTIQUEPRO : SCRIPT DE VERROUILLAGE ET RENFORCEMENT DE SÉCURITÉ (RLS & RPCs)
-- ==============================================================================
-- Ce script corrige les 3 failles critiques identifiées lors de l'audit :
-- 1. Falsification et suppression des sessions de caisse par les caissiers.
-- 2. Altération des ventes et suppression d'articles par les caissiers.
-- 3. Exposition publique des tables de paiement Moneriz (USING true).
-- 4. Suppression non autorisée de fiches clients par les caissiers.
-- 5. Exécution sécurisée des RPCs create_sale et record_debt_payment (SECURITY DEFINER).

-- ==============================================================================
-- 1. SÉCURISATION DE LA TABLE CASH_SESSIONS (SESSIONS DE CAISSE & RAPPORT Z)
-- ==============================================================================
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cash sessions isolation by store" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_select" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_delete" ON public.cash_sessions;

-- 1.1 Lecture pour tous les membres de la boutique (Admin et Caissiers)
CREATE POLICY "cash_sessions_select" ON public.cash_sessions
FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_user_stores()));

-- 1.2 Ouverture de session : uniquement pour son propre compte dans sa boutique
CREATE POLICY "cash_sessions_insert" ON public.cash_sessions
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND user_id = auth.uid()
);

-- 1.3 Clôture et mise à jour des compteurs :
-- L'Admin peut modifier toute session de sa boutique.
-- Le Caissier ne peut modifier QUE sa session EN COURS (status = 'open').
-- Dès que la session passe à 'closed', elle est gelée et infalsifiable par le caissier !
CREATE POLICY "cash_sessions_update" ON public.cash_sessions
FOR UPDATE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND (
    public.get_user_role_in_store(store_id) = 'admin'
    OR (user_id = auth.uid() AND status = 'open')
  )
)
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND (
    public.get_user_role_in_store(store_id) = 'admin'
    OR user_id = auth.uid()
  )
);

-- 1.4 Suppression : STRICTEMENT RÉSERVÉE À L'ADMINISTRATEUR (interdite aux caissiers)
CREATE POLICY "cash_sessions_delete" ON public.cash_sessions
FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);


-- ==============================================================================
-- 2. SÉCURISATION DE LA TABLE SALES (VENTES & CRÉANCES)
-- ==============================================================================
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_update" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Select" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Insert" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Update" ON public.sales;
DROP POLICY IF EXISTS "SaaS Isolation Sales Delete" ON public.sales;

-- 2.1 Lecture : tous les membres de la boutique
CREATE POLICY "sales_select" ON public.sales
FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_user_stores()));

-- 2.2 Insertion : tous les membres de la boutique (pour enregistrer une vente)
CREATE POLICY "sales_insert" ON public.sales
FOR INSERT TO authenticated
WITH CHECK (store_id IN (SELECT public.get_user_stores()));

-- 2.3 Modification directe : STRICTEMENT RÉSERVÉE À L'ADMINISTRATEUR
-- Les caissiers ne peuvent PAS modifier les totaux, statuts ou montants payés directement.
-- Tout recouvrement de dette par le caissier passe obligatoirement par la RPC record_debt_payment.
CREATE POLICY "sales_update" ON public.sales
FOR UPDATE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
)
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);

-- 2.4 Suppression : STRICTEMENT RÉSERVÉE À L'ADMINISTRATEUR
CREATE POLICY "sales_delete" ON public.sales
FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);


-- ==============================================================================
-- 3. SÉCURISATION DE LA TABLE SALE_ITEMS (ARTICLES VENDUS)
-- ==============================================================================
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SaaS Isolation Sale Items" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete" ON public.sale_items;

CREATE POLICY "sale_items_select" ON public.sale_items
FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_user_stores()));

CREATE POLICY "sale_items_insert" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (store_id IN (SELECT public.get_user_stores()));

-- Modification et suppression interdites aux caissiers (seul l'admin peut corriger)
CREATE POLICY "sale_items_update" ON public.sale_items
FOR UPDATE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);

CREATE POLICY "sale_items_delete" ON public.sale_items
FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);


-- ==============================================================================
-- 4. SÉCURISATION DE LA TABLE CUSTOMERS (CLIENTS)
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SaaS Isolation Customers" ON public.customers;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;

-- Lecture, ajout et modification autorisés pour caissiers et admins
CREATE POLICY "customers_select" ON public.customers
FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_user_stores()));

CREATE POLICY "customers_insert" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (store_id IN (SELECT public.get_user_stores()));

CREATE POLICY "customers_update" ON public.customers
FOR UPDATE TO authenticated
USING (store_id IN (SELECT public.get_user_stores()))
WITH CHECK (store_id IN (SELECT public.get_user_stores()));

-- Suppression : EXCLUSIVEMENT l'administrateur
CREATE POLICY "customers_delete" ON public.customers
FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);


-- ==============================================================================
-- 5. VERROUILLAGE DES TABLES MONERIZ (ABONNEMENTS & WEBHOOKS)
-- ==============================================================================
ALTER TABLE IF EXISTS public.moneriz_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moneriz_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on moneriz_checkout_attempts" ON public.moneriz_checkout_attempts;
DROP POLICY IF EXISTS "Allow all on moneriz_webhook_events" ON public.moneriz_webhook_events;
DROP POLICY IF EXISTS "moneriz_checkout_attempts_admin_select" ON public.moneriz_checkout_attempts;
DROP POLICY IF EXISTS "moneriz_webhook_events_service_only" ON public.moneriz_webhook_events;

-- Seul l'administrateur peut consulter ses propres tentatives d'abonnement
CREATE POLICY "moneriz_checkout_attempts_admin_select"
ON public.moneriz_checkout_attempts
FOR SELECT TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);

-- Les événements de webhook sont purement internes au serveur (inaccessibles côté client)
-- Le serveur (service_role) passe outre RLS, garantissant un traitement sûr à 100%
CREATE POLICY "moneriz_webhook_events_service_only"
ON public.moneriz_webhook_events
FOR ALL TO authenticated
USING (false);


-- ==============================================================================
-- 6. RPC CREATE_SALE SÉCURISÉE (SECURITY DEFINER)
-- ==============================================================================
-- Permet au caissier d'enregistrer une vente et de décrémenter le stock sans avoir
-- besoin d'un droit direct UPDATE sur la table products (prix/coûts protégés)
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
  -- VÉRIFICATION STRICTE : L'utilisateur connecté doit appartenir à la boutique
  IF NOT EXISTS (
    SELECT 1 FROM public.store_members 
    WHERE store_id = p_store_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès refusé : vous nappartenez pas à cette boutique.';
  END IF;

  -- Détermination des montants (comptant vs crédit)
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

  -- 1. Insérer la vente
  INSERT INTO public.sales (
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

  -- 2. Insérer les articles et décrémenter le stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := (item->>'quantity')::NUMERIC;
    v_unit_price := (item->>'unitPrice')::NUMERIC;
    v_item_total := (item->>'total')::NUMERIC;

    INSERT INTO public.sale_items (
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

    UPDATE public.products
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 7. RPC RECORD_DEBT_PAYMENT SÉCURISÉE (SECURITY DEFINER)
-- ==============================================================================
-- Permet au caissier d'enregistrer un paiement de créance sans avoir
-- besoin d'un droit UPDATE arbitraire sur la table sales
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
  -- VÉRIFICATION : L'utilisateur connecté doit appartenir à la boutique
  IF NOT EXISTS (
    SELECT 1 FROM public.store_members 
    WHERE store_id = p_store_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès refusé pour cette boutique';
  END IF;

  IF p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être strictement supérieur à zéro';
  END IF;

  -- 1. Récupération avec verrou
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable (id: %, store_id: %)', p_sale_id, p_store_id;
  END IF;

  -- 2. Calcul des nouveaux montants
  v_new_paid := COALESCE(v_sale.amount_paid, 0) + p_payment_amount;
  v_new_remaining := GREATEST(0, COALESCE(v_sale.remaining_amount, GREATEST(0, v_sale.total - COALESCE(v_sale.amount_paid, 0))) - p_payment_amount);
  
  IF v_new_remaining = 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- 3. Mise à jour atomique de la vente
  UPDATE public.sales
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
