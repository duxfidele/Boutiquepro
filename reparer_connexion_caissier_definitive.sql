-- ==============================================================================
-- RÉPARATION COMPLÈTE & DÉFINITIVE DE L'ACCÈS DES CAISSIERS (SUPABASE GOTRUE)
-- ==============================================================================
-- Ce script fait 3 actions :
-- 1. Répare IMMÉDIATEMENT tous les comptes caissiers existants ou créés récemment (remplace les NULL par '' et active l'identité GoTrue)
-- 2. Met à jour DÉFINITIVEMENT la fonction admin_create_cashier pour que tout futur caissier soit créé sans aucun bug GoTrue
-- 3. Permet de réinitialiser le mot de passe d'un caissier existant simplement en le ré-enregistrant avec son nouvel accès
-- ==============================================================================

-- ÉTAPE 1 : RÉPARATION IMMÉDIATE DE TOUS LES CAISSIERS EXISTANTS DANS auth.users
UPDATE auth.users
SET 
  confirmation_token = COALESCE(NULLIF(confirmation_token, NULL), ''),
  recovery_token = COALESCE(NULLIF(recovery_token, NULL), ''),
  email_change_token_new = COALESCE(NULLIF(email_change_token_new, NULL), ''),
  email_change = COALESCE(NULLIF(email_change, NULL), ''),
  email_change_token_current = COALESCE(NULLIF(email_change_token_current, NULL), ''),
  phone_change = COALESCE(NULLIF(phone_change, NULL), ''),
  phone_change_token = COALESCE(NULLIF(phone_change_token, NULL), ''),
  reauthentication_token = COALESCE(NULLIF(reauthentication_token, NULL), ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false),
  is_super_admin = COALESCE(is_super_admin, false),
  aud = 'authenticated',
  role = 'authenticated',
  updated_at = now()
WHERE email LIKE '%@caisse.maboutique.app' 
   OR confirmation_token IS NULL 
   OR recovery_token IS NULL;

-- ÉTAPE 2 : ASSURER LES IDENTITÉS (auth.identities) POUR TOUS LES CAISSIERS
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', LOWER(u.email), 'email_verified', true),
    'email',
    u.id::text,
    now(),
    now(),
    now()
FROM auth.users u
WHERE u.email LIKE '%@caisse.maboutique.app'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  )
ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

-- ÉTAPE 3 : MISE À JOUR DÉFINITIVE DE LA FONCTION admin_create_cashier
CREATE OR REPLACE FUNCTION public.admin_create_cashier(
  p_store_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
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

  -- Vérifier si l'utilisateur existe déjà
  SELECT id INTO v_target_user_id FROM auth.users WHERE LOWER(email) = v_clean_email;

  -- Si l'utilisateur n'existe pas encore et que le quota est déjà atteint : bloquer
  IF v_target_user_id IS NULL AND v_total_cashiers >= v_sub.max_cashiers THEN
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

  -- 4. CAS OÙ L'UTILISATEUR EXISTE DÉJÀ : MISE À JOUR PROPRE DU MOT DE PASSE ET DES JETONS
  IF v_target_user_id IS NOT NULL THEN
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
    
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      email_change_token_current = '',
      phone_change = '',
      phone_change_token = '',
      reauthentication_token = '',
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      is_sso_user = false,
      is_anonymous = false,
      aud = 'authenticated',
      role = 'authenticated',
      updated_at = now()
    WHERE id = v_target_user_id;

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_target_user_id,
      v_target_user_id,
      jsonb_build_object('sub', v_target_user_id::text, 'email', v_clean_email, 'email_verified', true),
      'email',
      v_target_user_id::text,
      now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = now();

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_target_user_id, v_clean_email, p_name, 'cashier')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'cashier';

    INSERT INTO public.store_members (id, store_id, user_id, role)
    VALUES (gen_random_uuid(), p_store_id, v_target_user_id, 'cashier')
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'cashier';

    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Le compte caissier existant (' || p_email || ') a été synchronisé, son mot de passe mis à jour et relié à ' || COALESCE(v_store_name, 'la boutique') || ' !'
    );
  END IF;

  -- 5. CAS D'UN NOUVEAU CAISSIER : CRÉATION AVEC JETONS PROPRES (ZÉRO NULL)
  v_target_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) VALUES (
    v_target_user_id, '00000000-0000-0000-0000-000000000000', v_clean_email,
    v_encrypted_pw, now(),
    '', '', '', '',
    '', '', '', '',
    false, false,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name), now(), now(), 'authenticated', 'authenticated'
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_target_user_id,
    v_target_user_id,
    jsonb_build_object('sub', v_target_user_id::text, 'email', v_clean_email, 'email_verified', true),
    'email',
    v_target_user_id::text,
    now(), now(), now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

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
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_cashier(UUID, TEXT, TEXT, TEXT) TO authenticated;
