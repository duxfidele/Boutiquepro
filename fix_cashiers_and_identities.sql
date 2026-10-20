-- ==============================================================================
-- RÉPARATION DES CAISSIERS : AUTH.IDENTITIES ET MOTS DE PASSE GOTRUE
-- ==============================================================================

-- 1. S'assurer que tous les utilisateurs ont leur email confirmé pour autoriser la connexion
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. Créer l'identité manquante dans auth.identities pour TOUS les utilisateurs existants
-- C'est la raison pour laquelle les caissiers créés ne pouvaient pas se connecter !
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
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email',
    u.id::text,
    now(),
    now(),
    now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 3. Mettre à jour la RPC admin_create_cashier pour TOUJOURS créer auth.identities
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
    -- Mettre à jour son mot de passe s'il a été saisi
    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = crypt(p_password, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = v_target_user_id;
    END IF;

    -- Créer ou mettre à jour son identité dans auth.identities
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

    INSERT INTO public.store_members (id, store_id, user_id, role)
    VALUES (gen_random_uuid(), p_store_id, v_target_user_id, 'cashier')
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'cashier';

    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Le compte de ' || p_email || ' a été mis à jour et lié avec succès à ' || COALESCE(v_store_name, 'la boutique') || ' en tant que caissier !'
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

  -- 6. Créer l'identité dans auth.identities
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
