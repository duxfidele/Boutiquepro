-- ==============================================================================
-- CORRECTION DÉFINITIVE & AUTOMATIQUE DU SYSTÈME D'ABONNEMENT SAAS
-- 1. Pour votre compte saasfidele@gmail.com (355 jours restants de votre abonnement annuel)
-- 2. Pour TOUT futur client qui s'abonne : ses boutiques et caisses sont toujours actives automatiquement
-- ==============================================================================

-- ÉTAPE 1 : Synchroniser votre abonnement annuel légitime sur votre compte et vos boutiques
DO $$
DECLARE
    v_user_id UUID;
    v_count INT;
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) IN ('saasfidele@gmail.com', 'profidele91@gmail.com')
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Enregistrement de votre formule BUSINESS avec vos 355 jours restants
        INSERT INTO public.admin_subscriptions (
            user_id,
            plan_tier,
            status,
            billing_cycle,
            current_period_starts_at,
            current_period_ends_at,
            max_stores,
            max_cashiers,
            updated_at
        ) VALUES (
            v_user_id,
            'BUSINESS',
            'active',
            'annual',
            NOW() - INTERVAL '10 days',
            NOW() + INTERVAL '355 days',
            3,
            3,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            plan_tier = 'BUSINESS',
            status = 'active',
            billing_cycle = 'annual',
            current_period_ends_at = NOW() + INTERVAL '355 days',
            max_stores = 3,
            max_cashiers = 3,
            updated_at = NOW();

        -- Synchronisation directe sur votre boutique MaBoutiquePro et toutes vos boutiques
        UPDATE public.stores
        SET 
            owner_id = v_user_id,
            subscription_plan = 'BUSINESS',
            subscription_status = 'active',
            subscription_ends_at = NOW() + INTERVAL '355 days'
        WHERE owner_id = v_user_id 
           OR id IN (SELECT store_id FROM public.store_members WHERE user_id = v_user_id);

        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'SUCCÈS : Vos 355 jours de formule BUSINESS sont synchronisés sur % boutique(s).', v_count;
    END IF;
END $$;

-- ÉTAPE 2 : Fonction PostgreSQL universelle pour TOUS les clients actuels et futurs
-- Dès qu'un client paie son abonnement, TOUTES ses boutiques et TOUS ses caissiers sont automatiquement actifs !
CREATE OR REPLACE FUNCTION public.is_store_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner_id UUID;
    v_sub RECORD;
BEGIN
    IF p_store_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Récupérer l'administrateur propriétaire de la boutique
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
    IF v_owner_id IS NULL THEN
        SELECT user_id INTO v_owner_id FROM public.store_members WHERE store_id = p_store_id AND role = 'admin' LIMIT 1;
    END IF;

    -- 2. Vérification directe dans l'abonnement centralisé du commerçant (admin_subscriptions)
    IF v_owner_id IS NOT NULL THEN
        SELECT * INTO v_sub FROM public.admin_subscriptions WHERE user_id = v_owner_id;
        IF v_sub IS NOT NULL THEN
            -- Abonnement payant actif et date non expirée
            IF v_sub.status = 'active' AND (v_sub.current_period_ends_at IS NULL OR v_sub.current_period_ends_at >= NOW()) THEN
                RETURN TRUE;
            END IF;
            -- Essai gratuit 14 jours en cours
            IF v_sub.status = 'trialing' AND (v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at >= NOW()) THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    -- 3. Repli de sécurité direct sur la table stores
    RETURN EXISTS (
        SELECT 1 FROM public.stores
        WHERE id = p_store_id
          AND (
            (subscription_status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at >= NOW()))
            OR (COALESCE(subscription_status, 'trial') = 'trial' AND (subscription_ends_at IS NULL OR subscription_ends_at >= NOW()))
          )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_store_subscription_active(UUID) TO authenticated, anon;

-- ÉTAPE 3 : Héritage automatique lors de la création d'une nouvelle boutique
-- Si un commerçant abonné crée une nouvelle boutique, elle hérite automatiquement de son abonnement actif
CREATE OR REPLACE FUNCTION public.create_new_store(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_name TEXT;
    v_sub RECORD;
    v_current_store_count INT;
    v_new_store_id UUID;
    v_plan TEXT;
    v_status TEXT;
    v_ends_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise pour créer une boutique' USING ERRCODE = '42501';
    END IF;

    v_clean_name := TRIM(p_name);
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Le nom de la boutique ne peut pas être vide' USING ERRCODE = '22023';
    END IF;

    -- Récupérer l'abonnement du propriétaire
    SELECT * INTO v_sub FROM public.admin_subscriptions WHERE user_id = v_user_id;

    -- Si l'administrateur a un abonnement payant actif, la boutique l'hérite directement
    IF v_sub IS NOT NULL AND v_sub.status = 'active' THEN
        v_plan := v_sub.plan_tier;
        v_status := 'active';
        v_ends_at := v_sub.current_period_ends_at;
    ELSE
        v_plan := COALESCE(v_sub.plan_tier, 'TRIAL');
        v_status := 'trial';
        v_ends_at := COALESCE(v_sub.trial_ends_at, NOW() + INTERVAL '14 days');
    END IF;

    -- Insertion de la boutique avec son statut synchronisé
    INSERT INTO public.stores (
        name,
        owner_id,
        subscription_plan,
        subscription_status,
        subscription_ends_at
    ) VALUES (
        v_clean_name,
        v_user_id,
        v_plan,
        v_status,
        v_ends_at
    )
    RETURNING id INTO v_new_store_id;

    -- Liaison dans store_members comme administrateur
    INSERT INTO public.store_members (store_id, user_id, role)
    VALUES (v_new_store_id, v_user_id, 'admin');

    RETURN v_new_store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_new_store(TEXT) TO authenticated;
