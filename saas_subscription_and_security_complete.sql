-- ==============================================================================
-- BOUTIQUEPRO : SCRIPT MAÎTRE UNIFIÉ (ABONNEMENT 14 JOURS + SÉCURITÉ INVIOLABLE)
-- ==============================================================================
-- Ce script est idempotent (peut être exécuté sans risque plusieurs fois).
-- Il active :
-- 1. Les colonnes d'abonnement SaaS (plan, statut, date de fin d'essai).
-- 2. L'attribution automatique de 14 jours d'essai pour toute boutique.
-- 3. La fonction de vérification stricte d'abonnement / essai (is_store_subscription_active).
-- 4. Le verrouillage côté BASE DE DONNÉES (interdiction d'insérer des ventes, produits,
--    dépenses ou commandes dès que les 14 jours sont expirés sans abonnement actif).

-- ==============================================================================
-- 1. STRUCTURE DES ABONNEMENTS DANS LA TABLE STORES
-- ==============================================================================
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'TRIAL';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE;

-- Rattrapage des boutiques existantes : 14 jours après création, ou 14 jours à partir d'aujourd'hui
UPDATE public.stores
SET subscription_ends_at = created_at + INTERVAL '14 days'
WHERE subscription_ends_at IS NULL AND created_at IS NOT NULL;

UPDATE public.stores
SET subscription_ends_at = NOW() + INTERVAL '14 days'
WHERE subscription_ends_at IS NULL;

-- Mise à jour de la fonction de création de boutique pour démarrer à 14 jours d'essai
CREATE OR REPLACE FUNCTION public.create_new_store(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_store_id UUID;
BEGIN
    INSERT INTO public.stores (name, subscription_plan, subscription_status, subscription_ends_at)
    VALUES (
        p_name,
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

-- ==============================================================================
-- 2. FONCTION DE CONTRÔLE D'ABONNEMENT / ESSAI ACTIF
-- ==============================================================================
-- Retourne TRUE uniquement si la boutique a un abonnement payé actif,
-- ou si elle est encore dans sa période d'essai de 14 jours.
CREATE OR REPLACE FUNCTION public.is_store_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.stores
        WHERE id = p_store_id
          AND (
            subscription_status = 'active'
            OR (
                COALESCE(subscription_status, 'trial') = 'trial'
                AND subscription_ends_at >= NOW()
            )
          )
    );
END;
$$;

-- ==============================================================================
-- 3. VERROUILLAGE DES TABLES MÉTIER EN BASE DE DONNÉES (RLS)
-- ==============================================================================
-- Dès que les 14 jours sont expirés sans abonnement actif, toute tentative
-- d'insertion ou modification de données est REJETÉE par Supabase.

-- 3.1 TABLE SALES (Ventes)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
CREATE POLICY "sales_insert" ON public.sales
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND public.is_store_subscription_active(store_id)
);

-- 3.2 TABLE SALE_ITEMS (Articles vendus)
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;
CREATE POLICY "sale_items_insert" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (
  sale_id IN (
    SELECT id FROM public.sales
    WHERE store_id IN (SELECT public.get_user_stores())
      AND public.is_store_subscription_active(store_id)
  )
);

-- 3.3 TABLE PRODUCTS (Produits & Stocks)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
  AND public.is_store_subscription_active(store_id)
);

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products
FOR UPDATE TO authenticated
USING (
  store_id IN (SELECT public.get_user_stores())
  AND public.is_store_subscription_active(store_id)
)
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND public.is_store_subscription_active(store_id)
);

-- 3.4 TABLE CASH_SESSIONS (Sessions de caisse)
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_sessions_insert" ON public.cash_sessions;
CREATE POLICY "cash_sessions_insert" ON public.cash_sessions
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND user_id = auth.uid()
  AND public.is_store_subscription_active(store_id)
);

-- 3.5 TABLE EXPENSES (Dépenses)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
  AND public.is_store_subscription_active(store_id)
);

-- 3.6 TABLE ORDERS (Commandes fournisseurs)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT public.get_user_stores())
  AND public.get_user_role_in_store(store_id) = 'admin'
  AND public.is_store_subscription_active(store_id)
);

-- 3.7 SÉCURITÉ DE LA RPC CREATE_SALE
-- Si la RPC create_sale existe, s'assurer qu'elle vérifie aussi la validité de l'abonnement
CREATE OR REPLACE FUNCTION public.check_store_subscription_before_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_store_subscription_active(NEW.store_id) THEN
        RAISE EXCEPTION 'Abonnement expiré. L''accès en écriture de cette boutique est suspendu.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_store_subscription_sales ON public.sales;
CREATE TRIGGER trg_check_store_subscription_sales
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.check_store_subscription_before_action();

DROP TRIGGER IF EXISTS trg_check_store_subscription_cash ON public.cash_sessions;
CREATE TRIGGER trg_check_store_subscription_cash
BEFORE INSERT ON public.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.check_store_subscription_before_action();

