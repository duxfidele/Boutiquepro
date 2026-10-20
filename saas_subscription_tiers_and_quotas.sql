-- ==============================================================================
-- BOUTIQUEPRO : SYSTÈME D'ABONNEMENT CENTRALISÉ AU COMPTE ADMIN (v1.1)
-- ==============================================================================
-- Ce script implémente :
-- 1. Table admin_subscriptions (source de vérité unique par compte administrateur)
-- 2. Table subscription_history (traçabilité complète et audit des formules)
-- 3. Migration sans perte des comptes et boutiques existants
-- 4. Contrôle strict des quotas de boutiques (Starter:1, Pro:1, Business:3)
-- 5. Contrôle strict des quotas de caissiers (Starter:0, Pro:1, Business:3 au total)
-- 6. Verrouillage RLS et Triggers anti-bypass au niveau PostgreSQL (Crédit, Inventaire, Commandes)
-- 7. Révocation des accès directs pour sécurisation 100% RPC

-- ------------------------------------------------------------------------------
-- 1. TABLE admin_subscriptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_subscriptions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_tier TEXT NOT NULL DEFAULT 'PRO',             -- 'STARTER', 'PRO', 'BUSINESS'
    status TEXT NOT NULL DEFAULT 'trialing',           -- 'trialing', 'active', 'expired', 'past_due', 'cancelled'
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',     -- 'monthly', 'annual'
    trial_starts_at TIMESTAMPTZ DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    current_period_starts_at TIMESTAMPTZ,
    current_period_ends_at TIMESTAMPTZ,
    max_stores INT NOT NULL DEFAULT 1,
    max_cashiers INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_subscriptions_read_own" ON public.admin_subscriptions;
CREATE POLICY "admin_subscriptions_read_own"
    ON public.admin_subscriptions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Interdire toute modification client directe sur admin_subscriptions
REVOKE INSERT, UPDATE, DELETE ON public.admin_subscriptions FROM authenticated, anon;
GRANT SELECT ON public.admin_subscriptions TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. TABLE subscription_history
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    previous_tier TEXT,
    new_tier TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    amount_paid NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'XOF',
    moneriz_event_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_history_read_own" ON public.subscription_history;
CREATE POLICY "subscription_history_read_own"
    ON public.subscription_history
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.subscription_history FROM authenticated, anon;
GRANT SELECT ON public.subscription_history TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. MIGRATION DES ADMINISTRATEURS ET BOUTIQUES EXISTANTES
-- ------------------------------------------------------------------------------
-- S'assurer que chaque boutique a son owner_id renseigné
UPDATE public.stores s
SET owner_id = sm.user_id
FROM public.store_members sm
WHERE sm.store_id = s.id AND sm.role = 'admin' AND s.owner_id IS NULL;

-- Initialiser admin_subscriptions pour chaque administrateur existant
INSERT INTO public.admin_subscriptions (
    user_id,
    plan_tier,
    status,
    billing_cycle,
    trial_starts_at,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    max_stores,
    max_cashiers,
    created_at,
    updated_at
)
SELECT DISTINCT ON (sm.user_id)
    sm.user_id,
    CASE 
        WHEN UPPER(COALESCE(s.subscription_plan, '')) = 'BUSINESS' THEN 'BUSINESS'
        WHEN UPPER(COALESCE(s.subscription_plan, '')) IN ('PRO', 'PREMIUM') THEN 'PRO'
        ELSE 'PRO'
    END AS plan_tier,
    CASE
        WHEN LOWER(COALESCE(s.subscription_status, '')) = 'active' THEN 'active'
        WHEN LOWER(COALESCE(s.subscription_status, '')) = 'trial' THEN 'trialing'
        ELSE 'trialing'
    END AS status,
    'monthly' AS billing_cycle,
    s.created_at AS trial_starts_at,
    COALESCE(s.subscription_ends_at, s.created_at + INTERVAL '14 days') AS trial_ends_at,
    CASE WHEN LOWER(COALESCE(s.subscription_status, '')) = 'active' THEN s.created_at ELSE NULL END,
    CASE WHEN LOWER(COALESCE(s.subscription_status, '')) = 'active' THEN s.subscription_ends_at ELSE NULL END,
    CASE WHEN UPPER(COALESCE(s.subscription_plan, '')) = 'BUSINESS' THEN 3 ELSE 1 END AS max_stores,
    CASE WHEN UPPER(COALESCE(s.subscription_plan, '')) = 'BUSINESS' THEN 3 ELSE 1 END AS max_cashiers,
    NOW(),
    NOW()
FROM public.store_members sm
JOIN public.stores s ON s.id = sm.store_id
WHERE sm.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. FONCTION UNIFIÉE DE VÉRIFICATION DE L'ABONNEMENT D'UNE BOUTIQUE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_store_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS 6503
DECLARE
    v_owner_id UUID;
    v_sub RECORD;
BEGIN
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
    IF v_owner_id IS NULL THEN
        -- Repli : retrouver l'admin de la boutique dans store_members
        SELECT user_id INTO v_owner_id FROM public.store_members WHERE store_id = p_store_id AND role = 'admin' LIMIT 1;
    END IF;

    IF v_owner_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_sub FROM public.admin_subscriptions WHERE user_id = v_owner_id;
    IF v_sub IS NULL THEN
        -- Si non encore migré, repli de sécurité sur la table stores
        RETURN EXISTS (
            SELECT 1 FROM public.stores
            WHERE id = p_store_id
              AND (
                (subscription_status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at >= NOW()))
                OR (COALESCE(subscription_status, 'trial') = 'trial' AND (subscription_ends_at IS NULL OR subscription_ends_at >= NOW()))
              )
        );
    END IF;

    -- Statut actif payant
    IF v_sub.status = 'active' THEN
        IF v_sub.current_period_ends_at IS NULL OR v_sub.current_period_ends_at >= NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Statut essai gratuit (trialing)
    IF v_sub.status = 'trialing' THEN
        IF v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at >= NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
6503;

GRANT EXECUTE ON FUNCTION public.is_store_subscription_active(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. RPC create_new_store AVEC CONTRÔLE DE QUOTA PAR FORMULE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_new_store(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 6503
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_name TEXT;
    v_sub RECORD;
    v_current_store_count INT;
    v_new_store_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise pour créer une boutique' USING ERRCODE = '42501';
    END IF;

    v_clean_name := TRIM(p_name);
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Le nom de la boutique ne peut pas être vide' USING ERRCODE = '22023';
    END IF;

    -- Vérifier ou initialiser l'abonnement du propriétaire
    SELECT * INTO v_sub FROM public.admin_subscriptions WHERE user_id = v_user_id;
    IF v_sub IS NULL THEN
        INSERT INTO public.admin_subscriptions (
            user_id, plan_tier, status, billing_cycle,
            trial_starts_at, trial_ends_at, max_stores, max_cashiers
        ) VALUES (
            v_user_id, 'PRO', 'trialing', 'monthly',
            NOW(), NOW() + INTERVAL '14 days', 1, 1
        )
        RETURNING * INTO v_sub;

        -- Enregistrer l'essai unique
        INSERT INTO public.user_trial_history (user_id, first_store_name)
        VALUES (v_user_id, v_clean_name)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Compter les boutiques actuelles détenues par cet administrateur
    SELECT COUNT(*) INTO v_current_store_count
    FROM public.stores
    WHERE owner_id = v_user_id;

    -- VÉRIFICATION DU QUOTA DE BOUTIQUES
    IF v_current_store_count >= v_sub.max_stores THEN
        IF v_sub.max_stores <= 1 THEN
            RAISE EXCEPTION 'Votre formule actuelle (%) est limitée à 1 boutique. Passez à la formule Business pour gérer jusqu''à 3 boutiques.', v_sub.plan_tier
                USING ERRCODE = '42501';
        ELSE
            RAISE EXCEPTION 'Vous avez atteint le quota maximal de % boutiques autorisées sur la formule Business.', v_sub.max_stores
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Insertion de la boutique avec son propriétaire
    INSERT INTO public.stores (
        name,
        owner_id,
        subscription_plan,
        subscription_status,
        subscription_ends_at
    ) VALUES (
        v_clean_name,
        v_user_id,
        v_sub.plan_tier,
        v_sub.status,
        COALESCE(v_sub.current_period_ends_at, v_sub.trial_ends_at)
    )
    RETURNING id INTO v_new_store_id;

    -- Liaison dans store_members comme admin
    INSERT INTO public.store_members (store_id, user_id, role)
    VALUES (v_new_store_id, v_user_id, 'admin');

    RETURN v_new_store_id;
END;
6503;

GRANT EXECUTE ON FUNCTION public.create_new_store(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. RPC admin_create_cashier AVEC CONTRÔLE DE QUOTA PAR FORMULE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_cashier(
  p_store_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 6503
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_owner_id UUID;
  v_sub RECORD;
  v_total_cashiers INT;
  v_clean_email TEXT;
  v_target_user_id UUID;
  v_store_name TEXT;
  v_encrypted_pw TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentification requise.');
  END IF;

  v_clean_email := LOWER(TRIM(p_email));
  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'L''adresse email est requise.');
  END IF;

  -- 1. Vérifier que l'appelant est bien administrateur de cette boutique
  SELECT role INTO v_caller_role 
  FROM public.store_members 
  WHERE store_id = p_store_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Action refusée : vous devez être administrateur de cette boutique.');
  END IF;

  -- 2. Récupérer le propriétaire et son abonnement
  SELECT owner_id, name INTO v_owner_id, v_store_name FROM public.stores WHERE id = p_store_id;
  IF v_owner_id IS NULL THEN v_owner_id := v_caller_id; END IF;

  SELECT * INTO v_sub FROM public.admin_subscriptions WHERE user_id = v_owner_id;
  IF v_sub IS NULL THEN
    -- Initialiser par défaut
    INSERT INTO public.admin_subscriptions (user_id, plan_tier, status, max_stores, max_cashiers)
    VALUES (v_owner_id, 'PRO', 'trialing', 1, 1)
    RETURNING * INTO v_sub;
  END IF;

  -- 3. CONTRÔLE DU QUOTA DE CAISSIERS SELON LA FORMULE
  IF v_sub.plan_tier = 'STARTER' OR v_sub.max_cashiers = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'La formule Starter ne permet pas d''ajouter de caissier (0 caissier). Passez à la formule Pro (1 caissier) ou Business (jusqu''à 3 caissiers).'
    );
  END IF;

  -- Compter le nombre de caissiers distincts déjà créés sur l'ensemble des boutiques de cet admin
  SELECT COUNT(DISTINCT sm.user_id) INTO v_total_cashiers
  FROM public.store_members sm
  JOIN public.stores s ON s.id = sm.store_id
  WHERE s.owner_id = v_owner_id AND sm.role = 'cashier';

  IF v_total_cashiers >= v_sub.max_cashiers THEN
    IF v_sub.plan_tier = 'PRO' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'La formule Pro est limitée à 1 caissier au total sur votre compte. Passez à la formule Business pour ajouter jusqu''à 3 caissiers.'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Vous avez atteint le quota maximal de 3 caissiers au total pour votre compte Business.'
      );
    END IF;
  END IF;

  -- 4. Vérifier si l'utilisateur existe déjà
  SELECT id INTO v_target_user_id FROM auth.users WHERE LOWER(email) = v_clean_email;

  IF v_target_user_id IS NOT NULL THEN
    INSERT INTO public.store_members (id, store_id, user_id, role)
    VALUES (gen_random_uuid(), p_store_id, v_target_user_id, 'cashier')
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'cashier';

    RETURN jsonb_build_object(
      'success', true, 
      'message', 'L''utilisateur ' || p_email || ' existe déjà et a été relié avec succès à ' || COALESCE(v_store_name, 'la boutique') || ' en tant que caissier !'
    );
  END IF;

  -- 5. Créer l'utilisateur dans auth.users
  v_target_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) VALUES (
    v_target_user_id, '00000000-0000-0000-0000-000000000000', v_clean_email,
    v_encrypted_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name), now(), now(), 'authenticated', 'authenticated'
  );

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_target_user_id, v_clean_email, p_name, 'cashier')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'cashier';

  INSERT INTO public.store_members (id, store_id, user_id, role)
  VALUES (gen_random_uuid(), p_store_id, v_target_user_id, 'cashier')
  ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'cashier';

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Compte caissier créé avec succès pour ' || p_name || ' (' || p_email || '). Le caissier peut se connecter immédiatement !'
  );
END;
6503;

GRANT EXECUTE ON FUNCTION public.admin_create_cashier(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. TRIGGERS ANTI-BYPASS STARTER (CRÉDITS, INVENTAIRES, COMMANDES)
-- ------------------------------------------------------------------------------
-- A. Interdiction des ventes à crédit en formule Starter
CREATE OR REPLACE FUNCTION public.trg_check_starter_credit_sale()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS 6503
DECLARE
    v_owner_id UUID;
    v_plan TEXT;
BEGIN
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = NEW.store_id;
    IF v_owner_id IS NOT NULL THEN
        SELECT plan_tier INTO v_plan FROM public.admin_subscriptions WHERE user_id = v_owner_id;
        IF v_plan = 'STARTER' AND NEW.payment_method = 'credit' THEN
            RAISE EXCEPTION 'La vente à crédit est réservée aux formules Pro et Business.' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
6503;

DROP TRIGGER IF EXISTS trg_block_starter_credit ON public.sales;
CREATE TRIGGER trg_block_starter_credit
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_check_starter_credit_sale();

-- B. Interdiction des inventaires en formule Starter
CREATE OR REPLACE FUNCTION public.trg_check_starter_inventory()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS 6503
DECLARE
    v_owner_id UUID;
    v_plan TEXT;
BEGIN
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = NEW.store_id;
    IF v_owner_id IS NOT NULL THEN
        SELECT plan_tier INTO v_plan FROM public.admin_subscriptions WHERE user_id = v_owner_id;
        IF v_plan = 'STARTER' THEN
            RAISE EXCEPTION 'Les sessions d''inventaire sont réservées aux formules Pro et Business.' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
6503;

DROP TRIGGER IF EXISTS trg_block_starter_inventory ON public.inventory_sessions;
CREATE TRIGGER trg_block_starter_inventory
BEFORE INSERT OR UPDATE ON public.inventory_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_check_starter_inventory();

-- C. Interdiction des commandes fournisseurs manuelles en formule Starter
CREATE OR REPLACE FUNCTION public.trg_check_starter_orders()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS 6503
DECLARE
    v_owner_id UUID;
    v_plan TEXT;
BEGIN
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = NEW.store_id;
    IF v_owner_id IS NOT NULL THEN
        SELECT plan_tier INTO v_plan FROM public.admin_subscriptions WHERE user_id = v_owner_id;
        IF v_plan = 'STARTER' THEN
            RAISE EXCEPTION 'Les commandes fournisseurs sont réservées aux formules Pro et Business.' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
6503;

DROP TRIGGER IF EXISTS trg_block_starter_orders ON public.orders;
CREATE TRIGGER trg_block_starter_orders
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_check_starter_orders();

-- ------------------------------------------------------------------------------
-- 8. ANTI-TAMPERING & REVOCATION DES ACCÈS DIRECTS SUR stores ET store_members
-- ------------------------------------------------------------------------------
REVOKE INSERT, DELETE ON public.stores FROM authenticated, anon;
REVOKE INSERT, DELETE ON public.store_members FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.trg_prevent_direct_store_tampering()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS 6503
BEGIN
    IF auth.uid() IS NOT NULL AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
        RAISE EXCEPTION 'Modification non autorisée du propriétaire de la boutique' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
6503;

DROP TRIGGER IF EXISTS trg_protect_store_owner ON public.stores;
CREATE TRIGGER trg_protect_store_owner
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_direct_store_tampering();
