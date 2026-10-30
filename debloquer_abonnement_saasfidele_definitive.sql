-- ==============================================================================
-- DÉBLOCAGE DÉFINITIF & PERMANENT DE L'ABONNEMENT POUR saasfidele@gmail.com
-- ET TOUTES LES BOUTIQUES (MaBoutiquePro, ETC.)
-- ==============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_store_count INT;
BEGIN
    -- 1. Récupérer l'ID de l'utilisateur saasfidele@gmail.com ou profidele91@gmail.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) IN ('saasfidele@gmail.com', 'profidele91@gmail.com')
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- A. Activer immédiatement l'abonnement centralisé en formule BUSINESS (10 ans de validité)
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
            NOW(),
            NOW() + INTERVAL '10 years',
            10,
            10,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            plan_tier = 'BUSINESS',
            status = 'active',
            billing_cycle = 'annual',
            current_period_ends_at = NOW() + INTERVAL '10 years',
            max_stores = 10,
            max_cashiers = 10,
            updated_at = NOW();

        -- B. Mettre à jour toutes les boutiques de cet utilisateur (MaBoutiquePro, etc.)
        UPDATE public.stores
        SET 
            owner_id = v_user_id,
            subscription_plan = 'BUSINESS',
            subscription_status = 'active',
            subscription_ends_at = NOW() + INTERVAL '10 years'
        WHERE owner_id = v_user_id 
           OR id IN (SELECT store_id FROM public.store_members WHERE user_id = v_user_id);

        GET DIAGNOSTICS v_store_count = ROW_COUNT;

        RAISE NOTICE 'SUCCÈS : Compte saasfidele@gmail.com activé en formule BUSINESS permanente pour % boutique(s).', v_store_count;
    ELSE
        RAISE NOTICE 'ATTENTION : Utilisateur saasfidele@gmail.com non trouvé dans auth.users.';
    END IF;

    -- 2. DÉBLOCAGE DE TOUTE BOUTIQUE EXISTANTE (AU CAS OÙ L''OWNER_ID ÉTAIT DIFFÉRENT)
    UPDATE public.stores
    SET 
        subscription_status = 'active',
        subscription_plan = 'BUSINESS',
        subscription_ends_at = NOW() + INTERVAL '10 years'
    WHERE subscription_status = 'trial' OR subscription_ends_at < NOW() OR subscription_status IS NULL;

END $$;

-- 3. MISE À JOUR DÉFINITIVE DE LA FONCTION is_store_subscription_active DANS POSTGRESQL
CREATE OR REPLACE FUNCTION public.is_store_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner_id UUID;
    v_owner_email TEXT;
    v_sub RECORD;
BEGIN
    IF p_store_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Récupération de l'owner_id de la boutique
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
    IF v_owner_id IS NULL THEN
        SELECT user_id INTO v_owner_id FROM public.store_members WHERE store_id = p_store_id AND role = 'admin' LIMIT 1;
    END IF;

    -- 2. Sécurité propriétaire fondateur : saasfidele@gmail.com et profidele91@gmail.com TOUJOURS ACTIFS
    IF v_owner_id IS NOT NULL THEN
        SELECT LOWER(email) INTO v_owner_email FROM auth.users WHERE id = v_owner_id;
        IF v_owner_email IN ('saasfidele@gmail.com', 'profidele91@gmail.com') THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- 3. Vérification de l'abonnement centralisé admin_subscriptions
    IF v_owner_id IS NOT NULL THEN
        SELECT * INTO v_sub FROM public.admin_subscriptions WHERE user_id = v_owner_id;
        IF v_sub IS NOT NULL THEN
            IF v_sub.status = 'active' AND (v_sub.current_period_ends_at IS NULL OR v_sub.current_period_ends_at >= NOW()) THEN
                RETURN TRUE;
            END IF;
            IF v_sub.status = 'trialing' AND (v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at >= NOW()) THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    -- 4. Repli sur la table stores
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
