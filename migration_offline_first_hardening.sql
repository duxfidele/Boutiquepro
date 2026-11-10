-- ==============================================================================
-- MABOUTIQUEPRO : MIGRATION LOT 1 — CONSOLIDATION OFFLINE-FIRST, IDEMPOTENCE & SÉCURITÉ
-- ==============================================================================
-- Auteur : Fr Fidèle & Antigravity
-- Objectif :
--   1. Ajouter updated_at + triggers + index incrémentaux sur toutes les tables métier
--   2. Ajouter la table sale_debt_payments (historique persistant & idempotence des recouvrements)
--   3. Sécuriser & rendre 100% idempotentes les RPCs create_sale, record_debt_payment et convert_quote_to_sale
--   4. Ajouter des RPCs transactionnelles atomiques & détection de conflits (OCC) pour :
--      - receive_order_atomic (évite l'écrasement de stock sur réception commande)
--      - apply_inventory_session_atomic (ajustement delta/absolu atomique)
--      - upsert_quote_atomic (évite la perte de quote_items entre delete et insert)
--      - upsert_product_atomic (transaction unique products + product_costs + product_units + OCC)
--      - upsert_store_settings_atomic (transaction unique settings + stores.name + OCC)
--      - ping_health (sonde serveur légère pour vérification réelle de connectivité)
--
-- IMPORTANT : Script 100% idempotent et non destructif (préserve toutes les données existantes).
-- À exécuter dans le SQL Editor de Supabase (https://supabase.com/dashboard).
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. COLONNES updated_at, TRIGGERS AUTOMATIQUES & INDEX INCRÉMENTAUX
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  v_idx_name TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products',
    'sales',
    'customers',
    'expenses',
    'orders',
    'inventory_sessions',
    'cash_sessions',
    'settings',
    'categories',
    'product_units',
    'product_batches',
    'product_costs',
    'quotes'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
          t
        );
      END IF;

      EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_touch_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at()',
        t, t
      );

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'store_id'
      ) THEN
        v_idx_name := 'idx_' || t || '_store_updated_at';
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON public.%I (store_id, updated_at DESC)',
          v_idx_name, t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- S'assurer que sales.session_id existe pour rattacher précisément chaque vente à sa caisse
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

-- S'assurer que product_units.cost existe avant compilation de upsert_product_atomic
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_units'
  ) THEN
    ALTER TABLE public.product_units ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_store_session
  ON public.sales (store_id, session_id);

-- ------------------------------------------------------------------------------
-- 2. TABLE sale_debt_payments : HISTORIQUE SERVEUR & CLÉ D'IDEMPOTENCE DES RECOUVREMENTS
-- (Table dédiée pour MaBoutiquePro ; laisse intacte toute éventuelle table debt_payments existante)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_debt_payments (
  id TEXT PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(15, 3) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT DEFAULT NULL,
  cashier_name TEXT DEFAULT NULL,
  session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_touch_updated_at_sale_debt_payments ON public.sale_debt_payments;
CREATE TRIGGER trg_touch_updated_at_sale_debt_payments
BEFORE UPDATE ON public.sale_debt_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_sale_debt_payments_store_sale
  ON public.sale_debt_payments (store_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_debt_payments_store_paid_at
  ON public.sale_debt_payments (store_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_debt_payments_store_updated_at
  ON public.sale_debt_payments (store_id, updated_at DESC);

ALTER TABLE public.sale_debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_debt_payments_select_member" ON public.sale_debt_payments;
CREATE POLICY "sale_debt_payments_select_member" ON public.sale_debt_payments
FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_user_stores()));

DROP POLICY IF EXISTS "sale_debt_payments_delete_admin" ON public.sale_debt_payments;
CREATE POLICY "sale_debt_payments_delete_admin" ON public.sale_debt_payments
FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active') THEN
    DROP POLICY IF EXISTS "sub_gate_sale_debt_payments_del" ON public.sale_debt_payments;
    CREATE POLICY "sub_gate_sale_debt_payments_del" ON public.sale_debt_payments
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (public.is_store_subscription_active(store_id));
  END IF;
END $$;

REVOKE ALL ON public.sale_debt_payments FROM anon;
REVOKE INSERT, UPDATE ON public.sale_debt_payments FROM authenticated;
GRANT SELECT, DELETE ON public.sale_debt_payments TO authenticated;

-- Ajouter sale_debt_payments à supabase_realtime si la publication existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'sale_debt_payments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_debt_payments;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. RPC record_debt_payment IDEMPOTENTE, SÉCURISÉE ET RÉTROCOMPATIBLE
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_debt_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.record_debt_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION public.record_debt_payment(
  p_store_id UUID,
  p_sale_id TEXT,
  p_payment_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_note TEXT DEFAULT NULL,
  p_cashier_name TEXT DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_sale RECORD;
  v_existing_payment RECORD;
  v_payment_id TEXT;
  v_current_paid NUMERIC;
  v_current_remaining NUMERIC;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_inserted_rows INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = p_store_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Accès refusé pour cette boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré : impossible d''enregistrer ce recouvrement.' USING ERRCODE = 'P0001';
  END IF;

  IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être strictement supérieur à zéro.' USING ERRCODE = '22023';
  END IF;

  v_payment_id := COALESCE(NULLIF(TRIM(p_payment_id), ''), 'rec_' || gen_random_uuid()::text);

  -- 1. Vérification d'idempotence immédiate (anti-double encaissement sur timeout/retry)
  SELECT * INTO v_existing_payment
  FROM public.sale_debt_payments
  WHERE id = v_payment_id;

  IF FOUND THEN
    IF v_existing_payment.store_id <> p_store_id OR v_existing_payment.sale_id <> p_sale_id THEN
      RAISE EXCEPTION 'Conflit identifiant de paiement cross-tenant/cross-vente.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND store_id = p_store_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_id', v_payment_id,
      'sale_id', p_sale_id,
      'amount_paid', COALESCE(v_sale.amount_paid, 0),
      'remaining_amount', COALESCE(v_sale.remaining_amount, 0),
      'payment_status', COALESCE(v_sale.payment_status, 'partial')
    );
  END IF;

  -- 2. Verrouillage pessimiste de la créance
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable (id: %, store_id: %).', p_sale_id, p_store_id USING ERRCODE = 'P0002';
  END IF;

  v_current_paid := COALESCE(v_sale.amount_paid, 0);
  v_current_remaining := GREATEST(0, COALESCE(v_sale.remaining_amount, GREATEST(0, v_sale.total - v_current_paid)));

  -- Protection contre le surpaiement concurrent (ex. deux appareils soldent la dette simultanément)
  IF v_current_remaining <= 0 THEN
    RAISE EXCEPTION 'CONFLICT_DEBT_ALREADY_PAID: Cette créance est déjà entièrement soldée.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Insertion atomique du justificatif de paiement (clé unique v_payment_id)
  INSERT INTO public.sale_debt_payments (
    id, store_id, sale_id, user_id, amount, payment_method, note, cashier_name, session_id, paid_at
  ) VALUES (
    v_payment_id,
    p_store_id,
    p_sale_id,
    v_caller_id,
    p_payment_amount,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cash'),
    p_note,
    p_cashier_name,
    p_session_id,
    COALESCE(p_paid_at, now())
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  IF v_inserted_rows = 0 THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND store_id = p_store_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_id', v_payment_id,
      'sale_id', p_sale_id,
      'amount_paid', COALESCE(v_sale.amount_paid, 0),
      'remaining_amount', COALESCE(v_sale.remaining_amount, 0),
      'payment_status', COALESCE(v_sale.payment_status, 'partial')
    );
  END IF;

  -- 4. Mise à jour des cumuls sur la vente
  v_new_paid := v_current_paid + p_payment_amount;
  v_new_remaining := GREATEST(0, v_current_remaining - p_payment_amount);
  v_new_status := CASE WHEN v_new_remaining = 0 THEN 'paid' ELSE 'partial' END;

  UPDATE public.sales
  SET
    amount_paid = v_new_paid,
    remaining_amount = v_new_remaining,
    payment_status = v_new_status,
    updated_at = now()
  WHERE id = p_sale_id AND store_id = p_store_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'payment_id', v_payment_id,
    'sale_id', p_sale_id,
    'amount_paid', v_new_paid,
    'remaining_amount', v_new_remaining,
    'payment_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_debt_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. RPC create_sale SÉCURISÉE, IDEMPOTENTE, MULTI-UNITÉS, FEFO & SESSION CAISSE
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, JSONB, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, JSONB, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMP WITH TIME ZONE, UUID);

CREATE OR REPLACE FUNCTION public.create_sale(
  p_store_id UUID,
  p_sale_id TEXT,
  p_subtotal NUMERIC,
  p_tax NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_customer_name TEXT,
  p_created_at TIMESTAMPTZ,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_remaining_amount NUMERIC DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL,
  p_due_date TIMESTAMPTZ DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_existing_sale RECORD;
  item JSONB;
  v_item_idx INT := 0;
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
  v_session_id UUID := p_session_id;
BEGIN
  -- 1. Contrôles de sécurité & abonnement obligatoires (ne jamais contourner en SECURITY DEFINER)
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour enregistrer une vente.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = p_store_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''appartenez pas à cette boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré : écriture bloquée pour cette boutique.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Idempotence stricte sur p_sale_id (anti-doublon réseau & vérification d'appartenance boutique)
  SELECT id, store_id, amount_paid, remaining_amount, payment_status
  INTO v_existing_sale
  FROM public.sales
  WHERE id = p_sale_id;

  IF FOUND THEN
    IF v_existing_sale.store_id <> p_store_id THEN
      RAISE EXCEPTION 'Accès refusé : identifiant de vente déjà utilisé dans une autre boutique.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'sale_id', p_sale_id,
      'amount_paid', COALESCE(v_existing_sale.amount_paid, 0),
      'remaining_amount', COALESCE(v_existing_sale.remaining_amount, 0),
      'payment_status', COALESCE(v_existing_sale.payment_status, 'paid')
    );
  END IF;

  -- Vérifier que p_session_id appartient bien à p_store_id s'il est fourni
  IF v_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE id = v_session_id AND store_id = p_store_id
  ) THEN
    v_session_id := NULL;
  END IF;

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

  INSERT INTO public.sales (
    id, store_id, user_id, session_id, subtotal, tax, discount, total,
    payment_method, customer_name, customer_phone,
    amount_paid, remaining_amount, payment_status, due_date, created_at
  ) VALUES (
    p_sale_id, p_store_id, v_caller_id, v_session_id, p_subtotal, p_tax, p_discount, p_total,
    p_payment_method, p_customer_name, p_customer_phone,
    v_amount_paid, v_remaining_amount, v_payment_status, p_due_date,
    COALESCE(p_created_at, now())
  );

  -- Si crédit avec acompte initial, journaliser aussi l'acompte de façon idempotente dans sale_debt_payments
  IF p_payment_method = 'credit' AND v_amount_paid > 0 THEN
    INSERT INTO public.sale_debt_payments (
      id, store_id, sale_id, user_id, amount, payment_method, note, cashier_name, session_id, paid_at
    ) VALUES (
      'init_' || p_sale_id,
      p_store_id,
      p_sale_id,
      v_caller_id,
      v_amount_paid,
      'cash',
      'Acompte initial à l''enregistrement',
      NULL,
      v_session_id,
      COALESCE(p_created_at, now())
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_item_idx := v_item_idx + 1;
    v_sale_item_id := COALESCE(
      NULLIF(TRIM(item->>'id'), ''),
      'si_' || substr(md5(p_sale_id || ':' || v_item_idx::text), 1, 16)
    );
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := COALESCE((item->>'quantity')::NUMERIC, 1);
    v_unit_price := COALESCE((item->>'unitPrice')::NUMERIC, 0);
    v_item_total := COALESCE((item->>'total')::NUMERIC, ROUND(v_quantity * v_unit_price, 3));
    v_unit_name := COALESCE(NULLIF(TRIM(item->>'unitName'), ''), 'Unité');

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
        v_unit_multiplier := COALESCE(NULLIF((item->>'unitMultiplier')::NUMERIC, 0), 1);
      END IF;
    END IF;

    v_quantity_ref := ROUND(v_quantity * v_unit_multiplier, 3);

    INSERT INTO public.sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total,
      unit_name, unit_multiplier, quantity_reference
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total,
      v_unit_name, v_unit_multiplier, v_quantity_ref
    )
    ON CONFLICT (id) DO NOTHING;

    -- Ne déduire du stock réel que si le produit existe dans la boutique (ignore les dettes "custom-credit")
    IF v_product_id IS NOT NULL AND v_product_id <> 'custom-credit' THEN
      IF v_allow_negative_stock THEN
        UPDATE public.products
        SET stock = stock - v_quantity_ref, updated_at = now()
        WHERE id = v_product_id AND store_id = p_store_id;
      ELSE
        UPDATE public.products
        SET stock = GREATEST(0, stock - v_quantity_ref), updated_at = now()
        WHERE id = v_product_id AND store_id = p_store_id;
      END IF;

      -- Décompte FEFO avec verrouillage FOR UPDATE contre concurrence
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
        FOR UPDATE
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

      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_frozen_sale_item_cost') THEN
        PERFORM public.record_frozen_sale_item_cost(
          v_sale_item_id,
          p_sale_id,
          p_store_id,
          v_product_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'sale_id', p_sale_id,
    'amount_paid', v_amount_paid,
    'remaining_amount', v_remaining_amount,
    'payment_status', v_payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. RPC convert_quote_to_sale SÉCURISÉE & IDEMPOTENTE
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.convert_quote_to_sale(TEXT, TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.convert_quote_to_sale(TEXT, TEXT, TEXT, NUMERIC, UUID);

CREATE OR REPLACE FUNCTION public.convert_quote_to_sale(
  p_quote_id TEXT,
  p_sale_id TEXT,
  p_payment_method TEXT DEFAULT 'cash',
  p_amount_paid NUMERIC DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_quote RECORD;
  v_items JSONB;
  v_sale_result JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devis introuvable [%]', p_quote_id USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = v_quote.store_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Accès refusé pour cette boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(v_quote.store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré.' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.status = 'converted' THEN
    IF v_quote.sale_id = p_sale_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_converted', true,
        'sale_id', p_sale_id,
        'quote_id', p_quote_id
      );
    ELSE
      RAISE EXCEPTION 'CONFLICT_QUOTE_ALREADY_CONVERTED: Ce devis a déjà été converti en vente sur un autre appareil (vente %).', v_quote.sale_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'productId', qi.product_id,
        'productName', qi.product_name,
        'quantity', qi.quantity,
        'unitPrice', qi.unit_price,
        'total', qi.total,
        'unitName', qi.unit_name,
        'unitMultiplier', qi.unit_multiplier
      )
    ),
    '[]'::jsonb
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
    COALESCE(p_payment_method, 'cash'),
    v_quote.customer_name,
    now(),
    v_items,
    v_quote.customer_phone,
    p_amount_paid,
    NULL,
    NULL,
    NULL,
    p_session_id
  );

  UPDATE public.quotes
  SET status = 'converted',
      sale_id = p_sale_id,
      updated_at = now()
  WHERE id = p_quote_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_converted', false,
    'sale_id', p_sale_id,
    'quote_id', p_quote_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_quote_to_sale(TEXT, TEXT, TEXT, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_sale(TEXT, TEXT, TEXT, NUMERIC, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. RPCs TRANSACTIONNELLES ANTI-ÉCRASEMENT & CONFLITS (COMMANDES, STOCK, DEVIS, PRODUITS, PARAMÈTRES)
-- ------------------------------------------------------------------------------

-- A. Réception commande fournisseur atomique (incrément SQL relatif + lots + coût)
CREATE OR REPLACE FUNCTION public.receive_order_atomic(
  p_store_id UUID,
  p_order_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_role TEXT;
  v_order RECORD;
  v_item RECORD;
  v_mult NUMERIC;
  v_ref_qty NUMERIC;
  v_ref_cost NUMERIC;
  v_batch_id TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.store_members
  WHERE store_id = p_store_id AND user_id = v_caller_id;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Action réservée à l''administrateur de la boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande fournisseur introuvable.' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotence : une commande déjà réceptionnée ou verrouillée ne ré-incrémente JAMAIS le stock deux fois
  IF v_order.status = 'received' OR COALESCE(v_order.reception_locked, false) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_received', true,
      'order_id', p_order_id
    );
  END IF;

  UPDATE public.orders
  SET status = 'received',
      received_at = COALESCE(received_at, now()),
      reception_locked = true,
      updated_at = now()
  WHERE id = p_order_id AND store_id = p_store_id;

  FOR v_item IN
    SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    v_mult := GREATEST(0.001, COALESCE(v_item.unit_multiplier, 1));
    v_ref_qty := CASE
      WHEN COALESCE(v_item.quantity_reference, 0) > 0 THEN v_item.quantity_reference
      ELSE ROUND(COALESCE(v_item.quantity, 0) * v_mult, 3)
    END;
    v_ref_cost := CASE
      WHEN COALESCE(v_item.reference_unit_cost, 0) > 0 THEN v_item.reference_unit_cost
      ELSE ROUND(COALESCE(v_item.cost_price, 0) / v_mult, 4)
    END;

    UPDATE public.products
    SET stock = COALESCE(stock, 0) + v_ref_qty,
        updated_at = now()
    WHERE id = v_item.product_id AND store_id = p_store_id;

    IF v_item.batch_number IS NOT NULL AND TRIM(v_item.batch_number) <> '' AND v_item.expiry_date IS NOT NULL THEN
      v_batch_id := 'batch_' || p_order_id || '_' || v_item.id;
      INSERT INTO public.product_batches (
        id, store_id, product_id, batch_number, expiry_date, initial_quantity, current_quantity, order_id
      ) VALUES (
        v_batch_id,
        p_store_id,
        v_item.product_id,
        v_item.batch_number,
        v_item.expiry_date,
        v_ref_qty,
        v_ref_qty,
        p_order_id
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_ref_cost > 0 THEN
      INSERT INTO public.product_costs (product_id, store_id, cost, updated_at)
      VALUES (v_item.product_id, p_store_id, v_ref_cost, now())
      ON CONFLICT (product_id) DO UPDATE
      SET cost = EXCLUDED.cost,
          updated_at = now();
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'already_received', false,
    'order_id', p_order_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.receive_order_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_order_atomic(UUID, TEXT) TO authenticated;

-- B. Session d'inventaire atomique (mode delta préservant les ventes concurrentes)
CREATE OR REPLACE FUNCTION public.apply_inventory_session_atomic(
  p_store_id UUID,
  p_session_id TEXT,
  p_date TIMESTAMPTZ,
  p_total_variance_value NUMERIC,
  p_notes TEXT,
  p_items JSONB,
  p_mode TEXT DEFAULT 'delta'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_role TEXT;
  v_existing_store UUID;
  v_allow_negative BOOLEAN := false;
  item JSONB;
  v_idx INT := 0;
  v_item_id TEXT;
  v_product_id TEXT;
  v_expected NUMERIC;
  v_actual NUMERIC;
  v_variance NUMERIC;
  v_iso_date TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.store_members
  WHERE store_id = p_store_id AND user_id = v_caller_id;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Action réservée à l''administrateur de la boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré.' USING ERRCODE = 'P0001';
  END IF;

  SELECT store_id INTO v_existing_store
  FROM public.inventory_sessions
  WHERE id = p_session_id;

  IF FOUND THEN
    IF v_existing_store <> p_store_id THEN
      RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'session_id', p_session_id);
  END IF;

  SELECT COALESCE(allow_negative_stock, false) INTO v_allow_negative
  FROM public.settings WHERE store_id = p_store_id;

  v_iso_date := to_char(COALESCE(p_date, now()) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  INSERT INTO public.inventory_sessions (id, store_id, user_id, date, total_variance_value, notes)
  VALUES (p_session_id, p_store_id, v_caller_id, v_iso_date, COALESCE(p_total_variance_value, 0), p_notes);

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    v_item_id := 'iv_' || substr(md5(p_session_id || ':' || v_idx::text), 1, 16);
    v_product_id := item->>'productId';
    v_expected := COALESCE((item->>'expectedStock')::NUMERIC, 0);
    v_actual := COALESCE((item->>'actualStock')::NUMERIC, 0);
    v_variance := COALESCE((item->>'variance')::NUMERIC, v_actual - v_expected);

    INSERT INTO public.inventory_items (
      id, session_id, store_id, user_id, product_id, product_name, expected_stock, actual_stock, variance, cost_price
    ) VALUES (
      v_item_id,
      p_session_id,
      p_store_id,
      v_caller_id,
      v_product_id,
      COALESCE(item->>'productName', ''),
      ROUND(v_expected)::INTEGER,
      ROUND(v_actual)::INTEGER,
      ROUND(v_variance)::INTEGER,
      COALESCE((item->>'costPrice')::NUMERIC, 0)
    )
    ON CONFLICT (id) DO NOTHING;

    IF p_mode = 'absolute' THEN
      UPDATE public.products
      SET stock = CASE WHEN v_allow_negative THEN v_actual ELSE GREATEST(0, v_actual) END,
          updated_at = now()
      WHERE id = v_product_id AND store_id = p_store_id;
    ELSE
      -- Mode delta : applique l'écart réel mesuré sans écraser les ventes survenues entre-temps
      UPDATE public.products
      SET stock = CASE
            WHEN v_allow_negative THEN COALESCE(stock, 0) + v_variance
            ELSE GREATEST(0, COALESCE(stock, 0) + v_variance)
          END,
          updated_at = now()
      WHERE id = v_product_id AND store_id = p_store_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'session_id', p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_inventory_session_atomic(UUID, TEXT, TIMESTAMPTZ, NUMERIC, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_inventory_session_atomic(UUID, TEXT, TIMESTAMPTZ, NUMERIC, TEXT, JSONB, TEXT) TO authenticated;

-- C. Upsert devis + lignes atomique avec détection de conflit de version et de conversion
CREATE OR REPLACE FUNCTION public.upsert_quote_atomic(
  p_store_id UUID,
  p_quote_id TEXT,
  p_quote_number TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0,
  p_tax NUMERIC DEFAULT 0,
  p_discount NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'draft',
  p_validity_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_force_overwrite BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_existing RECORD;
  item JSONB;
  v_idx INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = p_store_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Accès refusé pour cette boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.store_id <> p_store_id THEN
      RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
    END IF;

    IF v_existing.status = 'converted' AND p_status <> 'converted' THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'reason', 'QUOTE_ALREADY_CONVERTED',
        'server_updated_at', v_existing.updated_at,
        'server_record', row_to_json(v_existing)
      );
    END IF;

    IF NOT p_force_overwrite
       AND p_expected_updated_at IS NOT NULL
       AND v_existing.updated_at > p_expected_updated_at + INTERVAL '10 milliseconds' THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'reason', 'VERSION_MISMATCH',
        'server_updated_at', v_existing.updated_at,
        'server_record', row_to_json(v_existing)
      );
    END IF;

    UPDATE public.quotes
    SET
      quote_number = p_quote_number,
      customer_name = p_customer_name,
      customer_phone = p_customer_phone,
      customer_address = p_customer_address,
      subtotal = p_subtotal,
      tax = p_tax,
      discount = p_discount,
      total = p_total,
      status = p_status,
      validity_date = p_validity_date,
      notes = p_notes,
      updated_at = now()
    WHERE id = p_quote_id AND store_id = p_store_id;
  ELSE
    INSERT INTO public.quotes (
      id, store_id, user_id, quote_number, customer_name, customer_phone, customer_address,
      subtotal, tax, discount, total, status, validity_date, notes
    ) VALUES (
      p_quote_id, p_store_id, v_caller_id, p_quote_number, p_customer_name, p_customer_phone, p_customer_address,
      p_subtotal, p_tax, p_discount, p_total, COALESCE(p_status, 'draft'), p_validity_date, p_notes
    );
  END IF;

  -- Remplacement atomique des lignes à l'intérieur de la même transaction
  DELETE FROM public.quote_items WHERE quote_id = p_quote_id AND store_id = p_store_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.quote_items (
      id, quote_id, store_id, product_id, product_name, quantity, unit_price, total, unit_name, unit_multiplier
    ) VALUES (
      COALESCE(NULLIF(TRIM(item->>'id'), ''), 'qi_' || substr(md5(p_quote_id || ':' || v_idx::text), 1, 16)),
      p_quote_id,
      p_store_id,
      item->>'productId',
      COALESCE(item->>'productName', ''),
      COALESCE((item->>'quantity')::NUMERIC, 1),
      COALESCE((item->>'unitPrice')::NUMERIC, 0),
      COALESCE((item->>'total')::NUMERIC, 0),
      COALESCE(NULLIF(TRIM(item->>'unitName'), ''), 'Unité'),
      COALESCE((item->>'unitMultiplier')::NUMERIC, 1)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'conflict', false,
    'quote_id', p_quote_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_quote_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_quote_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN) TO authenticated;

-- D. Upsert produit atomique (products + product_costs + product_units + OCC)
CREATE OR REPLACE FUNCTION public.upsert_product_atomic(
  p_store_id UUID,
  p_product_id TEXT,
  p_name TEXT,
  p_sku TEXT,
  p_category TEXT,
  p_price NUMERIC,
  p_stock NUMERIC,
  p_min_stock NUMERIC,
  p_image TEXT DEFAULT '📦',
  p_cost NUMERIC DEFAULT NULL,
  p_units JSONB DEFAULT NULL,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_force_overwrite BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_role TEXT;
  v_existing RECORD;
  v_unit JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.store_members
  WHERE store_id = p_store_id AND user_id = v_caller_id;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Action réservée à l''administrateur de la boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.store_id <> p_store_id THEN
      RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
    END IF;

    IF NOT p_force_overwrite
       AND p_expected_updated_at IS NOT NULL
       AND v_existing.updated_at > p_expected_updated_at + INTERVAL '10 milliseconds' THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'reason', 'VERSION_MISMATCH',
        'server_updated_at', v_existing.updated_at,
        'server_record', row_to_json(v_existing)
      );
    END IF;

    UPDATE public.products
    SET
      name = p_name,
      sku = p_sku,
      category = p_category,
      price = COALESCE(p_price, 0),
      stock = COALESCE(p_stock, 0),
      min_stock = COALESCE(p_min_stock, 0),
      image = COALESCE(NULLIF(p_image, ''), '📦'),
      updated_at = now()
    WHERE id = p_product_id AND store_id = p_store_id;
  ELSE
    INSERT INTO public.products (id, store_id, user_id, name, sku, category, price, stock, min_stock, image)
    VALUES (
      p_product_id,
      p_store_id,
      v_caller_id,
      p_name,
      p_sku,
      p_category,
      COALESCE(p_price, 0),
      COALESCE(p_stock, 0),
      COALESCE(p_min_stock, 0),
      COALESCE(NULLIF(p_image, ''), '📦')
    );
  END IF;

  IF p_cost IS NOT NULL THEN
    INSERT INTO public.product_costs (product_id, store_id, cost, updated_at)
    VALUES (p_product_id, p_store_id, p_cost, now())
    ON CONFLICT (product_id) DO UPDATE
    SET cost = EXCLUDED.cost,
        updated_at = now();
  END IF;

  IF p_units IS NOT NULL THEN
    DELETE FROM public.product_units WHERE product_id = p_product_id AND store_id = p_store_id;
    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
      INSERT INTO public.product_units (
        store_id, product_id, name, multiplier, price, cost, barcode, is_reference
      ) VALUES (
        p_store_id,
        p_product_id,
        TRIM(v_unit->>'name'),
        GREATEST(0.001, COALESCE((v_unit->>'multiplier')::NUMERIC, 1)),
        CASE WHEN NULLIF(v_unit->>'price', '') IS NOT NULL AND (v_unit->>'price')::NUMERIC > 0
             THEN (v_unit->>'price')::NUMERIC ELSE NULL END,
        CASE WHEN NULLIF(v_unit->>'cost', '') IS NOT NULL AND (v_unit->>'cost')::NUMERIC > 0
             THEN (v_unit->>'cost')::NUMERIC ELSE NULL END,
        NULLIF(TRIM(v_unit->>'barcode'), ''),
        COALESCE((v_unit->>'isReference')::BOOLEAN, false)
      )
      ON CONFLICT (product_id, name) DO UPDATE
      SET multiplier = EXCLUDED.multiplier,
          price = EXCLUDED.price,
          cost = EXCLUDED.cost,
          barcode = EXCLUDED.barcode,
          is_reference = EXCLUDED.is_reference;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'conflict', false, 'product_id', p_product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_product_atomic(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, JSONB, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_product_atomic(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, JSONB, TIMESTAMPTZ, BOOLEAN) TO authenticated;

-- E. Upsert paramètres boutique atomique (gère l'ID entier historique sans erreur + stores.name + OCC)
CREATE OR REPLACE FUNCTION public.upsert_store_settings_atomic(
  p_store_id UUID,
  p_settings JSONB,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_force_overwrite BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_existing RECORD;
  v_id_type TEXT;
  v_id_default TEXT;
  v_next_id BIGINT;
  v_name TEXT := COALESCE(p_settings->>'name', 'MaBoutiquePro');
  v_currency TEXT := COALESCE(p_settings->>'currency', 'FCFA');
  v_tax_rate NUMERIC := COALESCE((p_settings->>'taxRate')::NUMERIC, 0);
  v_logo TEXT := COALESCE(p_settings->>'logo', '/logo.png');
  v_city TEXT := p_settings->>'city';
  v_country TEXT := p_settings->>'country';
  v_email TEXT := p_settings->>'email';
  v_phone TEXT := p_settings->>'phone';
  v_manager_name TEXT := p_settings->>'managerName';
  v_allow_negative BOOLEAN := COALESCE((p_settings->>'allowNegativeStock')::BOOLEAN, false);
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = p_store_id AND user_id = v_caller_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = p_store_id AND owner_id = v_caller_id
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Action réservée à l''administrateur de la boutique.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_store_subscription_active')
     AND NOT public.is_store_subscription_active(p_store_id) THEN
    RAISE EXCEPTION 'Abonnement expiré.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM public.settings WHERE store_id = p_store_id FOR UPDATE;
  IF FOUND THEN
    IF NOT p_force_overwrite
       AND p_expected_updated_at IS NOT NULL
       AND v_existing.updated_at > p_expected_updated_at + INTERVAL '10 milliseconds' THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'reason', 'VERSION_MISMATCH',
        'server_updated_at', v_existing.updated_at,
        'server_record', row_to_json(v_existing)
      );
    END IF;

    UPDATE public.settings
    SET
      name = COALESCE(p_settings->>'name', name),
      currency = COALESCE(p_settings->>'currency', currency),
      tax_rate = COALESCE((p_settings->>'taxRate')::NUMERIC, tax_rate),
      logo = COALESCE(p_settings->>'logo', logo),
      city = COALESCE(p_settings->>'city', city),
      country = COALESCE(p_settings->>'country', country),
      email = COALESCE(p_settings->>'email', email),
      phone = COALESCE(p_settings->>'phone', phone),
      manager_name = COALESCE(p_settings->>'managerName', manager_name),
      allow_negative_stock = COALESCE((p_settings->>'allowNegativeStock')::BOOLEAN, allow_negative_stock),
      updated_at = now()
    WHERE store_id = p_store_id;
  ELSE
    SELECT data_type, column_default
    INTO v_id_type, v_id_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'id';

    IF v_id_default IS NOT NULL THEN
      INSERT INTO public.settings (
        store_id, name, currency, tax_rate, logo, city, country, email, phone, manager_name, allow_negative_stock
      ) VALUES (
        p_store_id, v_name, v_currency, v_tax_rate, v_logo, v_city, v_country, v_email, v_phone, v_manager_name, v_allow_negative
      );
    ELSIF v_id_type = 'uuid' THEN
      EXECUTE 'INSERT INTO public.settings (id, store_id, name, currency, tax_rate, logo, city, country, email, phone, manager_name, allow_negative_stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'
      USING gen_random_uuid(), p_store_id, v_name, v_currency, v_tax_rate, v_logo, v_city, v_country, v_email, v_phone, v_manager_name, v_allow_negative;
    ELSIF v_id_type IN ('text', 'character varying') THEN
      EXECUTE 'INSERT INTO public.settings (id, store_id, name, currency, tax_rate, logo, city, country, email, phone, manager_name, allow_negative_stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'
      USING gen_random_uuid()::text, p_store_id, v_name, v_currency, v_tax_rate, v_logo, v_city, v_country, v_email, v_phone, v_manager_name, v_allow_negative;
    ELSE
      PERFORM pg_advisory_xact_lock(hashtext('public.settings.id.seq'));
      EXECUTE 'SELECT COALESCE(MAX(id), 0) + 1 FROM public.settings' INTO v_next_id;
      EXECUTE 'INSERT INTO public.settings (id, store_id, name, currency, tax_rate, logo, city, country, email, phone, manager_name, allow_negative_stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'
      USING v_next_id, p_store_id, v_name, v_currency, v_tax_rate, v_logo, v_city, v_country, v_email, v_phone, v_manager_name, v_allow_negative;
    END IF;
  END IF;

  IF NULLIF(TRIM(p_settings->>'name'), '') IS NOT NULL THEN
    UPDATE public.stores
    SET name = TRIM(p_settings->>'name')
    WHERE id = p_store_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'conflict', false, 'store_id', p_store_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_store_settings_atomic(UUID, JSONB, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_store_settings_atomic(UUID, JSONB, TIMESTAMPTZ, BOOLEAN) TO authenticated;

-- F. Sonde serveur ultra-légère pour distinguer "Wi-Fi captif" vs "Serveur joignable"
CREATE OR REPLACE FUNCTION public.ping_health()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object('ok', true, 'server_time', now());
$$;

REVOKE ALL ON FUNCTION public.ping_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ping_health() TO authenticated;

COMMIT;

SELECT 'Lot 1 Offline-First SQL Hardening appliqué avec succès !' AS resultat;
