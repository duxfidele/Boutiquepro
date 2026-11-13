-- ==============================================================================
-- Migration : Super Administrateur SaaS MaBoutiquePro (profidele91@gmail.com)
-- ==============================================================================

-- 1. Fonction PostgreSQL pour identifier le Super Administrateur SaaS
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp

AS $$
DECLARE
    v_email TEXT;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT LOWER(email) INTO v_email FROM auth.users WHERE id = p_user_id;
    RETURN (v_email = 'profidele91@gmail.com');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, anon;

-- 2. Initialisation ou prolongation permanente de l'accès Fondateur Super Admin
DO $$
DECLARE
    v_super_admin_id UUID;
    v_count INT;
BEGIN
    SELECT id INTO v_super_admin_id 
    FROM auth.users 
    WHERE LOWER(email) = 'profidele91@gmail.com'
    LIMIT 1;

    IF v_super_admin_id IS NOT NULL THEN
        -- Insertion / Mise à jour dans admin_subscriptions : BUSINESS Illimité
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
            v_super_admin_id,
            'BUSINESS',
            'active',
            'annual',
            NOW(),
            NOW() + INTERVAL '100 years',
            9999,
            9999,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            plan_tier = 'BUSINESS',
            status = 'active',
            billing_cycle = 'annual',
            current_period_ends_at = NOW() + INTERVAL '100 years',
            max_stores = 9999,
            max_cashiers = 9999,
            updated_at = NOW();

        -- Mise à jour des boutiques du Super Admin
        UPDATE public.stores
        SET 
            owner_id = v_super_admin_id,
            subscription_plan = 'BUSINESS',
            subscription_status = 'active',
            subscription_ends_at = NOW() + INTERVAL '100 years'
        WHERE owner_id = v_super_admin_id 
           OR id IN (SELECT store_id FROM public.store_members WHERE user_id = v_super_admin_id);

        -- Promotion explicite au rôle ADMIN PLEIN sur toutes les boutiques associées
        UPDATE public.store_members
        SET role = 'admin'
        WHERE user_id = v_super_admin_id;

        -- Mise à jour du rôle principal dans profiles
        UPDATE public.profiles
        SET role = 'admin'
        WHERE id = v_super_admin_id;

        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Super Admin profidele91@gmail.com configuré avec succès (% boutique(s) rattachée(s)).', v_count;
    ELSE
        RAISE NOTICE 'Information : Compte profidele91@gmail.com en attente de première inscription ou connexion.';
    END IF;
END $$;

-- 3. Mise à jour de la fonction de contrôle de validité d'abonnement boutique
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

    -- 1. Récupération du propriétaire
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
    IF v_owner_id IS NULL THEN
        SELECT user_id INTO v_owner_id FROM public.store_members WHERE store_id = p_store_id AND role = 'admin' LIMIT 1;
    END IF;

    -- 2. Privilège Fondateur / Super Admin : profidele91@gmail.com et saasfidele@gmail.com TOUJOURS ACTIFS
    IF v_owner_id IS NOT NULL THEN
        SELECT LOWER(email) INTO v_owner_email FROM auth.users WHERE id = v_owner_id;
        IF v_owner_email IN ('profidele91@gmail.com', 'saasfidele@gmail.com') THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- 3. Vérification dans admin_subscriptions
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

