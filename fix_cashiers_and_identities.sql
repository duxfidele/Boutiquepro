-- ==============================================================================
-- RÉPARATION COMPLÈTE : ACCÈS CAISSIERS, AUTH.IDENTITIES, RLS ET CONTRÔLE RÉTROGRADATION
-- ==============================================================================

-- 1. S'assurer que tous les comptes existants ont leur email confirmé pour autoriser la connexion GoTrue
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. Créer l'entrée auth.identities pour TOUS les utilisateurs existants
-- Sans auth.identities, GoTrue rejette systématiquement les caissiers avec "Email ou mot de passe incorrect"
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
    u.id::text,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', LOWER(u.email), 'email_verified', true),
    'email',
    u.id::text,
    now(),
    now(),
    now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
)
ON CONFLICT DO NOTHING;

-- 3. POLITIQUE RLS SUR admin_subscriptions : PERMETTRE AUX CAISSIERS DE LIRE L'ABONNEMENT DU PROPRIÉTAIRE
-- Auparavant, la politique limitait la lecture à user_id = auth.uid(), ce qui masquait l'abonnement aux caissiers
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_subscriptions_read_own" ON public.admin_subscriptions;
DROP POLICY IF EXISTS "admin_subscriptions_read_member" ON public.admin_subscriptions;

CREATE POLICY "admin_subscriptions_read_member"
    ON public.admin_subscriptions
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT s.owner_id 
            FROM public.stores s
            JOIN public.store_members sm ON sm.store_id = s.id
            WHERE sm.user_id = auth.uid()
        )
    );

REVOKE INSERT, UPDATE, DELETE ON public.admin_subscriptions FROM authenticated, anon;
GRANT SELECT ON public.admin_subscriptions TO authenticated;

-- 4. MISE À JOUR DE LA FONCTION RPC admin_create_cashier
-- Supporte :
-- a) Saisie d'un simple identifiant (ex: caisse1) ou d'un email (ex: moussa@gmail.com)
-- b) Confirmation immédiate de l'email
-- c) Création synchrone de auth.identities
-- d) Réinitialisation/mise à jour du mot de passe si le compte existe déjà
-- e) Contrôle strict des quotas (0 caissier en Starter, 1 en Pro, 3 en Business)
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
    RETURN jsonb_build_object('success', false, 'message', 'L''identifiant ou l''adresse email est requis.');
  END IF;

  -- Support automatique des simples identifiants (ex: "caisse1" -> "caisse1@caisse.maboutique.app")
  IF v_clean_email NOT LIKE '%@%' THEN
    v_clean_email := v_clean_email || '@caisse.maboutique.app';
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

  -- 3. CONTRÔLE DU QUOTA DE CAISSIERS SELON LA FORMULE EN COURS
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

  -- Si l'utilisateur cible existe déjà et est déjà caissier, on permet la mise à jour de son mot de passe
  SELECT id INTO v_target_user_id FROM auth.users WHERE LOWER(email) = v_clean_email;

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

  -- 4. Si l'utilisateur existe déjà : synchroniser le mot de passe et l'identité
  IF v_target_user_id IS NOT NULL THEN
    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = v_target_user_id;
    END IF;

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_target_user_id::text,
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
      'message', 'Le mot de passe de ' || p_email || ' a été mis à jour et son accès activé pour ' || COALESCE(v_store_name, 'la boutique') || ' !'
    );
  END IF;

  -- 5. Création d'un nouvel utilisateur complet dans auth.users
  v_target_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) VALUES (
    v_target_user_id, '00000000-0000-0000-0000-000000000000', v_clean_email,
    v_encrypted_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name), now(), now(), 'authenticated', 'authenticated'
  );

  -- 6. Création de l'identité auth.identities (obligatoire pour GoTrue)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_target_user_id::text,
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

-- 5. BLOCAGE STRICT EN CAS DE RÉTROGRADATION VERS FORMULE INFÉRIEURE
-- Si un gérant passe de Business à Pro/Starter :
-- A. Interdire aux caissiers de vendre si le forfait est Starter
CREATE OR REPLACE FUNCTION public.trg_check_cashier_starter_sale()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner_id UUID;
    v_plan TEXT;
    v_caller_role TEXT;
BEGIN
    SELECT role INTO v_caller_role FROM public.store_members WHERE store_id = NEW.store_id AND user_id = auth.uid();
    IF v_caller_role = 'cashier' THEN
        SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = NEW.store_id;
        IF v_owner_id IS NOT NULL THEN
            SELECT plan_tier INTO v_plan FROM public.admin_subscriptions WHERE user_id = v_owner_id;
            IF v_plan = 'STARTER' THEN
                RAISE EXCEPTION 'Action refusée : Les caissiers ne sont pas autorisés avec la formule Starter. Veuillez demander au gérant de passer à la formule Pro ou Business.' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_cashier_starter_sale ON public.sales;
CREATE TRIGGER trg_block_cashier_starter_sale
BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_check_cashier_starter_sale();

-- B. Interdire les opérations sur les boutiques 2 et 3 si la formule actuelle n'est pas Business
CREATE OR REPLACE FUNCTION public.trg_check_secondary_store_sale()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner_id UUID;
    v_plan TEXT;
    v_primary_store_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = NEW.store_id;
    IF v_owner_id IS NOT NULL THEN
        SELECT plan_tier INTO v_plan FROM public.admin_subscriptions WHERE user_id = v_owner_id;
        IF v_plan IS NOT NULL AND v_plan != 'BUSINESS' THEN
            -- Récupérer l'identifiant de la première boutique (principale)
            SELECT id INTO v_primary_store_id FROM public.stores WHERE owner_id = v_owner_id ORDER BY created_at ASC LIMIT 1;
            IF NEW.store_id != v_primary_store_id THEN
                RAISE EXCEPTION 'Cette boutique supplémentaire est verrouillée car le forfait actuel (%) est limité à 1 seule boutique. Réabonnez-vous à la formule Business pour la réactiver.', v_plan USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_secondary_store_sale ON public.sales;
CREATE TRIGGER trg_block_secondary_store_sale
BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_check_secondary_store_sale();
