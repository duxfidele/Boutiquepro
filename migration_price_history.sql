-- ==============================================================================
-- MIGRATION ÉTAPE 5 : MODULE « HISTORIQUE DES FLUCTUATIONS DE PRIX »
-- ==============================================================================
-- Auteur : Fr Fidèle & Antigravity
-- Projet : MaBoutiquePro (SaaS Multi-Tenant)
-- Objectif :
--   1. Créer la table product_price_history pour tracer toutes les variations
--      de prix de vente public, de prix de revient / d'achat et d'unités multiples.
--   2. Garantir la sanctuarisation des marges et du coût (accessible uniquement
--      aux administrateurs / propriétaires du magasin via RLS).
--   3. Mettre en place des triggers automatiques sur products et product_costs
--      pour une traçabilité sans faille (même lors de mises à jour directes).
-- ==============================================================================

BEGIN;

-- 1. Création de la table product_price_history
CREATE TABLE IF NOT EXISTS public.product_price_history (
  id TEXT PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('selling', 'cost', 'unit_selling')),
  unit_name TEXT DEFAULT NULL,
  old_price NUMERIC(15, 3) NOT NULL,
  new_price NUMERIC(15, 3) NOT NULL,
  change_reason TEXT DEFAULT NULL,
  user_id UUID DEFAULT auth.uid(),
  user_name TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour optimiser le tri chronologique et les requêtes par boutique / produit
CREATE INDEX IF NOT EXISTS idx_price_history_store_product ON public.product_price_history(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON public.product_price_history(created_at DESC);

-- 2. Sécurité Row Level Security (RLS)
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Les administrateurs peuvent tout voir et modifier sur leur boutique
DROP POLICY IF EXISTS price_history_admin_all ON public.product_price_history;
CREATE POLICY price_history_admin_all ON public.product_price_history
FOR ALL TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
  )
)
WITH CHECK (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
  )
);

-- Les membres non-administrateurs (ex: caissiers) ne peuvent voir QUE les prix de vente publics
DROP POLICY IF EXISTS price_history_member_select ON public.product_price_history;
CREATE POLICY price_history_member_select ON public.product_price_history
FOR SELECT TO authenticated
USING (
  store_id IN (
    SELECT sm.store_id 
    FROM public.store_members sm 
    WHERE sm.user_id = auth.uid()
  )
  AND (
    price_type != 'cost'
    OR store_id IN (
      SELECT sm.store_id 
      FROM public.store_members sm 
      WHERE sm.user_id = auth.uid() AND sm.role = 'admin'
    )
  )
);

-- 3. Fonction & Trigger automatique sur products (Prix de vente)
CREATE OR REPLACE FUNCTION public.fn_log_product_price_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT := 'Système';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.price IS DISTINCT FROM NEW.price THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', email, 'Utilisateur')
    INTO v_user_name
    FROM auth.users
    WHERE id = auth.uid();

    INSERT INTO public.product_price_history (
      id, store_id, product_id, price_type, old_price, new_price, change_reason, user_id, user_name, created_at
    ) VALUES (
      'ph_' || gen_random_uuid()::text,
      NEW.store_id,
      NEW.id,
      'selling',
      OLD.price,
      NEW.price,
      'Ajustement du prix de vente',
      auth.uid(),
      COALESCE(v_user_name, 'Système'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_price ON public.products;
CREATE TRIGGER trg_log_product_price
AFTER UPDATE OF price ON public.products
FOR EACH ROW
WHEN (OLD.price IS DISTINCT FROM NEW.price)
EXECUTE FUNCTION public.fn_log_product_price_history();

-- 4. Fonction & Trigger automatique sur product_costs (Prix de revient / d'achat)
CREATE OR REPLACE FUNCTION public.fn_log_product_cost_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT := 'Système';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.cost IS DISTINCT FROM NEW.cost THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', email, 'Utilisateur')
    INTO v_user_name
    FROM auth.users
    WHERE id = auth.uid();

    INSERT INTO public.product_price_history (
      id, store_id, product_id, price_type, old_price, new_price, change_reason, user_id, user_name, created_at
    ) VALUES (
      'ph_' || gen_random_uuid()::text,
      NEW.store_id,
      NEW.product_id,
      'cost',
      OLD.cost,
      NEW.cost,
      'Ajustement du coût d''achat fournisseur',
      auth.uid(),
      COALESCE(v_user_name, 'Système'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_cost ON public.product_costs;
CREATE TRIGGER trg_log_product_cost
AFTER UPDATE OF cost ON public.product_costs
FOR EACH ROW
WHEN (OLD.cost IS DISTINCT FROM NEW.cost)
EXECUTE FUNCTION public.fn_log_product_cost_history();

COMMIT;
