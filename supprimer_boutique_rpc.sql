-- ==============================================================================
-- RPC delete_store : SUPPRESSION SÉCURISÉE D'UNE BOUTIQUE ET DE SES DONNÉES
-- À copier et exécuter dans le SQL Editor de Supabase
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_store(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_store_name TEXT;
  v_store_owner UUID;
  v_owner_total_stores INT;
  v_is_admin BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentification requise.');
  END IF;

  -- 1. Récupérer la boutique
  SELECT name, owner_id INTO v_store_name, v_store_owner
  FROM public.stores
  WHERE id = p_store_id;

  IF v_store_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boutique introuvable.');
  END IF;

  -- 2. Vérifier que l'utilisateur est bien propriétaire ou administrateur
  IF v_store_owner = v_user_id THEN
    v_is_admin := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_id = p_store_id AND user_id = v_user_id AND role = 'admin'
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Action refusée : Seul un administrateur ou le propriétaire peut supprimer cette boutique.');
  END IF;

  -- 3. RÈGLE DE SÉCURITÉ VITALE : Ne pas supprimer la dernière boutique
  SELECT COUNT(*) INTO v_owner_total_stores
  FROM public.stores
  WHERE owner_id = COALESCE(v_store_owner, v_user_id);

  IF v_owner_total_stores <= 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Action impossible : Vous devez toujours conserver au moins une boutique active sur votre compte.'
    );
  END IF;

  -- 4. SUPPRESSION PROPRE ET COMPLÈTE DES DONNÉES ASSOCIÉES
  BEGIN DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE store_id = p_store_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.sales WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE store_id = p_store_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.orders WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.inventory_items WHERE session_id IN (SELECT id FROM public.inventory_sessions WHERE store_id = p_store_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.inventory_sessions WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.expenses WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.cash_sessions WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.product_costs WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.products WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.categories WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.customers WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.settings WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.debts WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.store_members WHERE store_id = p_store_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- 5. Suppression de la boutique
  DELETE FROM public.stores WHERE id = p_store_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'La boutique "' || v_store_name || '" et toutes ses données associées ont été supprimées avec succès.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_store(UUID) TO authenticated;
