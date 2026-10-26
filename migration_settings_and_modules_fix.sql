-- ==============================================================================
-- BOUTIQUEPRO : FIX PERSISTANCE DES PARAMÈTRES & MODULES (RLS + RPC)
-- À exécuter dans le SQL Editor de Supabase
-- ==============================================================================

-- 1. Politique RLS pour permettre à l'administrateur de modifier sa boutique
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_admin_update" ON public.stores;
CREATE POLICY "stores_admin_update" ON public.stores
FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid() OR
  id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  owner_id = auth.uid() OR
  id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. Politiques RLS pour la table settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.settings;
CREATE POLICY "settings_select" ON public.settings
FOR SELECT TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
);

DROP POLICY IF EXISTS "settings_insert" ON public.settings;
CREATE POLICY "settings_insert" ON public.settings
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR store_id IN (
    SELECT id FROM public.stores WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "settings_update" ON public.settings;
CREATE POLICY "settings_update" ON public.settings
FOR UPDATE TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR store_id IN (
    SELECT id FROM public.stores WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR store_id IN (
    SELECT id FROM public.stores WHERE owner_id = auth.uid()
  )
);

-- 3. RPC ultra-sécurisée SECURITY DEFINER pour mettre à jour les modules
CREATE OR REPLACE FUNCTION public.update_store_modules(
  p_store_id UUID,
  p_modules TEXT[],
  p_business_sector TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_updated public.stores%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = p_store_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = p_store_id AND owner_id = auth.uid()
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action réservée à l''administrateur de la boutique');
  END IF;

  UPDATE public.stores
  SET 
    enabled_modules = p_modules,
    business_sector = COALESCE(p_business_sector, business_sector)
  WHERE id = p_store_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boutique introuvable');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'store_id', v_updated.id,
    'enabled_modules', v_updated.enabled_modules,
    'business_sector', v_updated.business_sector
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_store_modules(UUID, TEXT[], TEXT) TO authenticated;
