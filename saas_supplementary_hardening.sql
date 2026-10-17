-- ==============================================================================
-- BOUTIQUEPRO : COMPLÉMENT DE SÉCURITÉ SAAS (AUDIT CLAUDE - PARTIE 2)
-- ==============================================================================
-- 1. Table d'historique indélébile des essais (anti-suppression / recréation)
-- 2. Couverture RESTRICTIVE sur product_costs, order_items, inventory_*
-- 3. Nettoyage des doublons de politiques sur product_costs

-- 1. HISTORIQUE INDÉLÉBILE DES ESSAIS GRATUITS
CREATE TABLE IF NOT EXISTS public.user_trial_history (
    user_id UUID PRIMARY KEY,
    first_store_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_trial_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_trial_history_read" ON public.user_trial_history;
CREATE POLICY "user_trial_history_read" ON public.user_trial_history FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Mise à jour de create_new_store pour vérifier l'historique permanent
CREATE OR REPLACE FUNCTION public.create_new_store(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    new_store_id UUID;
    v_clean_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise pour créer une boutique'
            USING ERRCODE = '42501';
    END IF;

    v_clean_name := TRIM(p_name);
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Le nom de la boutique ne peut pas être vide'
            USING ERRCODE = '22023';
    END IF;

    -- Vérification permanente : cet utilisateur a-t-il déjà bénéficié d'un essai ?
    IF EXISTS (
        SELECT 1 FROM public.user_trial_history WHERE user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Vous avez déjà utilisé votre période d''essai gratuit.'
            USING ERRCODE = '42501';
    END IF;

    -- Création de la boutique avec 14 jours
    INSERT INTO public.stores (
        name,
        subscription_plan,
        subscription_status,
        subscription_ends_at
    )
    VALUES (
        v_clean_name,
        'TRIAL',
        'trial',
        NOW() + INTERVAL '14 days'
    )
    RETURNING id INTO new_store_id;

    -- Enregistrer l'empreinte de l'essai
    INSERT INTO public.user_trial_history (user_id, first_store_name)
    VALUES (auth.uid(), v_clean_name)
    ON CONFLICT (user_id) DO NOTHING;

    -- Attribuer le rôle admin
    INSERT INTO public.store_members (store_id, user_id, role)
    VALUES (new_store_id, auth.uid(), 'admin');

    RETURN new_store_id;
END;
$$;

-- 2. VERROUILLAGE RESTRICTIVE SUR LES TABLES SECONDAIRES (product_costs, order_items, inventory_*)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_costs', 'order_items', 'inventory_sessions', 'inventory_items'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS sub_gate_ins ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS sub_gate_upd ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS sub_gate_del ON public.%I', t);
      
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'store_id') THEN
        EXECUTE format('CREATE POLICY sub_gate_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
          WITH CHECK (public.is_store_subscription_active(store_id))', t);
        EXECUTE format('CREATE POLICY sub_gate_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
          USING (public.is_store_subscription_active(store_id))
          WITH CHECK (public.is_store_subscription_active(store_id))', t);
        EXECUTE format('CREATE POLICY sub_gate_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
          USING (public.is_store_subscription_active(store_id))', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. NETTOYAGE DU DOUBLON SUR product_costs
DROP POLICY IF EXISTS "costs admin only" ON public.product_costs;

