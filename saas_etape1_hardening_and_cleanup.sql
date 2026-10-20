-- ==============================================================================
-- BOUTIQUEPRO : ÉTAPE 1 - BLINDAGE HISTORIQUE ESSAIS & NETTOYAGE BOUTIQUES TESTS
-- ==============================================================================
-- Ce script réalise 3 actions critiques :
-- 1. Crée la table indélébile user_trial_history pour empêcher la réinitialisation des 14 jours
-- 2. Couvre les tables product_costs et inventaires par les politiques RESTRICTIVES
-- 3. Propose une requête sûre pour nettoyer les boutiques parasites (bcbchdhd, doublons vides)

-- ------------------------------------------------------------------------------
-- 1. HISTORIQUE INDÉLÉBILE DES ESSAIS GRATUITS (Anti-triche suppression/recréation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_trial_history (
    user_id UUID PRIMARY KEY,
    first_store_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_trial_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_trial_history_read" ON public.user_trial_history;
CREATE POLICY "user_trial_history_read" 
    ON public.user_trial_history 
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid());

-- Initialiser l'historique avec les créateurs de boutiques existantes
INSERT INTO public.user_trial_history (user_id, first_store_name, created_at)
SELECT DISTINCT sm.user_id, s.name, s.created_at
FROM public.store_members sm
JOIN public.stores s ON s.id = sm.store_id
WHERE sm.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- Mettre à jour create_new_store avec vérification indélébile
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

    -- VÉRIFICATION PERMANENTE : L'utilisateur a-t-il déjà bénéficié d'un essai ?
    IF EXISTS (
        SELECT 1 FROM public.user_trial_history WHERE user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Vous avez déjà utilisé votre période d''essai gratuit.'
            USING ERRCODE = '42501';
    END IF;

    -- Création de la boutique avec 14 jours d'essai
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

-- ------------------------------------------------------------------------------
-- 2. VERROUILLAGE RESTRICTIVE SUR product_costs ET INVENTAIRES
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_costs', 'inventory_sessions', 'inventory_items'] LOOP
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

-- Nettoyer l'ancienne politique doublon sur product_costs si présente
DROP POLICY IF EXISTS "costs admin only" ON public.product_costs;

-- ------------------------------------------------------------------------------
-- 3. NETTOYAGE DES BOUTIQUES PARASITES VIDES CRÉÉES LORS DES TESTS
-- ------------------------------------------------------------------------------
-- Supprime uniquement les boutiques tests 'bcbchdhd' ou 'Ma Boutique' sans produits ni ventes
DELETE FROM public.stores
WHERE (name = 'bcbchdhd' OR name = 'Ma Boutique')
  AND NOT EXISTS (SELECT 1 FROM public.products WHERE store_id = stores.id)
  AND NOT EXISTS (SELECT 1 FROM public.sales WHERE store_id = stores.id);
