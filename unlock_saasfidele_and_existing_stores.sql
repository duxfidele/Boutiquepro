-- ==============================================================================
-- DÉBLOCAGE IMMÉDIAT ET ACTIVATION DU COMPTE : saasfidele@gmail.com
-- ET PROTECTION DES BOUTIQUES EXISTANTES
-- ==============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_store_count INT;
BEGIN
    -- 1. Retrouver l'ID de l'utilisateur saasfidele@gmail.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) = 'saasfidele@gmail.com'
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- A. Activer immédiatement l'abonnement centralisé en formule BUSINESS (1 an)
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
            NOW() + INTERVAL '1 year',
            3,
            3,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            plan_tier = 'BUSINESS',
            status = 'active',
            billing_cycle = 'annual',
            current_period_starts_at = NOW(),
            current_period_ends_at = NOW() + INTERVAL '1 year',
            max_stores = 3,
            max_cashiers = 3,
            updated_at = NOW();

        -- B. Mettre à jour toutes les boutiques de cet utilisateur en statut actif BUSINESS
        UPDATE public.stores
        SET 
            owner_id = v_user_id,
            subscription_plan = 'BUSINESS',
            subscription_status = 'active',
            subscription_ends_at = NOW() + INTERVAL '1 year'
        WHERE owner_id = v_user_id 
           OR id IN (SELECT store_id FROM public.store_members WHERE user_id = v_user_id AND role = 'admin');

        GET DIAGNOSTICS v_store_count = ROW_COUNT;

        -- C. Enregistrer dans l'historique de traçabilité
        INSERT INTO public.subscription_history (
            user_id,
            previous_tier,
            new_tier,
            previous_status,
            new_status,
            reason
        ) VALUES (
            v_user_id,
            'TRIAL',
            'BUSINESS',
            'trialing',
            'active',
            'Activation compte payant saasfidele@gmail.com'
        );

        RAISE NOTICE 'SUCCÈS : Le compte saasfidele@gmail.com a été activé en formule BUSINESS (3 boutiques, 3 caissiers, actif pendant 1 an) pour % boutique(s).', v_store_count;
    ELSE
        RAISE NOTICE 'ATTENTION : L''adresse saasfidele@gmail.com n''a pas été trouvée dans auth.users. Vérifiez l''orthographe.';
    END IF;

    -- 2. PROTECTION DE TOUTES LES AUTRES BOUTIQUES EXISTANTES CRÉÉES AVANT
    -- Éviter que d'autres comptes existants soient bloqués par erreur :
    -- On donne 14 jours complets à partir d'aujourd'hui à toute boutique en essai créée avant aujourd'hui.
    UPDATE public.admin_subscriptions
    SET 
        status = 'trialing',
        trial_starts_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '14 days',
        updated_at = NOW()
    WHERE status = 'trialing' 
      AND (trial_ends_at IS NULL OR trial_ends_at < NOW())
      AND (v_user_id IS NULL OR user_id != v_user_id);

    UPDATE public.stores
    SET 
        subscription_status = 'trial',
        subscription_ends_at = NOW() + INTERVAL '14 days'
    WHERE (subscription_status = 'trial' OR subscription_status IS NULL)
      AND (subscription_ends_at IS NULL OR subscription_ends_at < NOW())
      AND (v_user_id IS NULL OR owner_id != v_user_id);

    RAISE NOTICE 'SUCCÈS : Les boutiques existantes en cours d''essai ont reçu 14 jours à partir d''aujourd''hui.';
END $$;
