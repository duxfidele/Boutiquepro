-- ==============================================================================
-- BOUTIQUEPRO : SCRIPT D'ABONNEMENT ET VERROUILLAGE SAAS (VERSION AUDITÉE)
-- ==============================================================================

-- 1. ACTIVATION EXPLICITE DU RLS SUR TOUTES LES TABLES
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','sale_items','products','cash_sessions','expenses','orders','customers','categories'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 2. COLONNES D'ABONNEMENT
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'TRIAL';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE;

-- Rattrapage uniquement pour les boutiques sans statut (les boutiques déjà passées en 'active' restent intactes)
UPDATE public.stores
SET 
    subscription_plan = 'TRIAL',
    subscription_status = 'trial',
    subscription_ends_at = NOW() + INTERVAL '14 days'
WHERE subscription_status IS NULL OR subscription_status = '';

-- 3. FONCTION DE CONTRÔLE D'ABONNEMENT ACTIF / ESSAI EN COURS
CREATE OR REPLACE FUNCTION public.is_store_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.stores
        WHERE id = p_store_id
          AND (
            -- Abonnement payant ou permanent actif (et date non dépassée si date renseignée)
            (
                subscription_status = 'active'
                AND (subscription_ends_at IS NULL OR subscription_ends_at >= NOW())
            )
            -- Ou essai gratuit de 14 jours en cours
            OR (
                COALESCE(subscription_status, 'trial') = 'trial'
                AND subscription_ends_at >= NOW()
            )
          )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_store_subscription_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_subscription_active(UUID) TO authenticated;

-- 4. PROTECTION DES COLONNES D'ABONNEMENT (ANTI-AUTO-ATTRIBUTION)
CREATE OR REPLACE FUNCTION public.protect_subscription_columns()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp 
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND (
        NEW.subscription_plan    IS DISTINCT FROM OLD.subscription_plan    OR
        NEW.subscription_status  IS DISTINCT FROM OLD.subscription_status  OR
        NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
    ) THEN
        RAISE EXCEPTION 'Modification de l''abonnement non autorisée'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END; 
$$;

DROP TRIGGER IF EXISTS trg_protect_subscription ON public.stores;
CREATE TRIGGER trg_protect_subscription
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_columns();

REVOKE INSERT ON public.stores FROM authenticated, anon;

-- 5. RPC CREATE_NEW_STORE AVEC LIMITE D'UN SEUL ESSAI GRATUIT PAR COMPTE
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

    -- LIMITE STRICTE : UN SEUL ESSAI GRATUIT PAR UTILISATEUR
    IF EXISTS (
        SELECT 1
        FROM public.store_members m
        JOIN public.stores s ON s.id = m.store_id
        WHERE m.user_id = auth.uid()
          AND m.role = 'admin'
          AND s.subscription_plan = 'TRIAL'
    ) THEN
        RAISE EXCEPTION 'Vous avez déjà utilisé votre période d''essai gratuit.'
            USING ERRCODE = '42501';
    END IF;

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

    INSERT INTO public.store_members (store_id, user_id, role)
    VALUES (new_store_id, auth.uid(), 'admin');

    RETURN new_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_new_store(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_new_store(TEXT) TO authenticated;

-- 6. POLITIQUES RESTRICTIVES (RLS - ET LOGIQUE)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','products','cash_sessions','expenses','orders','customers','categories'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS sub_gate_ins ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS sub_gate_upd ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS sub_gate_del ON public.%I', t);
      
      EXECUTE format('CREATE POLICY sub_gate_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (public.is_store_subscription_active(store_id))', t);
        
      EXECUTE format('CREATE POLICY sub_gate_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (public.is_store_subscription_active(store_id))
        WITH CHECK (public.is_store_subscription_active(store_id))', t);
        
      EXECUTE format('CREATE POLICY sub_gate_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
        USING (public.is_store_subscription_active(store_id))', t);
    END IF;
  END LOOP;
END $$;

-- Table sale_items (liée via sales)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
    DROP POLICY IF EXISTS sub_gate_ins ON public.sale_items;
    DROP POLICY IF EXISTS sub_gate_upd ON public.sale_items;
    DROP POLICY IF EXISTS sub_gate_del ON public.sale_items;

    CREATE POLICY sub_gate_ins ON public.sale_items AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
                  AND public.is_store_subscription_active(s.store_id)));

    CREATE POLICY sub_gate_upd ON public.sale_items AS RESTRICTIVE FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
             AND public.is_store_subscription_active(s.store_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
             AND public.is_store_subscription_active(s.store_id)));

    CREATE POLICY sub_gate_del ON public.sale_items AS RESTRICTIVE FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
             AND public.is_store_subscription_active(s.store_id)));
  END IF;
END $$;

-- 7. TRIGGERS ANTI-BYPASS POUR RPCS & SÉCURISATION DU CASCADE DELETE
CREATE OR REPLACE FUNCTION public.check_store_subscription_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_store_id := OLD.store_id;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id) THEN
            RETURN OLD;
        END IF;
    ELSE
        v_store_id := NEW.store_id;
    END IF;

    IF v_store_id IS NOT NULL AND NOT public.is_store_subscription_active(v_store_id) THEN
        RAISE EXCEPTION 'Abonnement expiré. L''accès en écriture de cette boutique est suspendu.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_sub_sales ON public.sales;
CREATE TRIGGER trg_check_sub_sales
BEFORE INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.check_store_subscription_trigger();

DROP TRIGGER IF EXISTS trg_check_sub_cash ON public.cash_sessions;
CREATE TRIGGER trg_check_sub_cash
BEFORE INSERT OR UPDATE OR DELETE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.check_store_subscription_trigger();

DROP TRIGGER IF EXISTS trg_check_sub_products ON public.products;
CREATE TRIGGER trg_check_sub_products
BEFORE INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.check_store_subscription_trigger();

DROP TRIGGER IF EXISTS trg_check_sub_expenses ON public.expenses;
CREATE TRIGGER trg_check_sub_expenses
BEFORE INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.check_store_subscription_trigger();

