-- ==============================================================================
-- Migration : Verrouillage Automatique et Sécurisation de l'essai 14 jours SaaS
-- ==============================================================================

-- 1. S'assurer que les colonnes d'abonnement existent sur stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'TRIAL';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE;

-- 2. Pour les boutiques existantes : initialiser l'échéance à created_at + 14 jours si null
UPDATE stores
SET subscription_ends_at = created_at + INTERVAL '14 days'
WHERE subscription_ends_at IS NULL AND created_at IS NOT NULL;

-- Pour les boutiques où created_at serait également null : fixer à 14 jours à partir de maintenant
UPDATE stores
SET subscription_ends_at = NOW() + INTERVAL '14 days'
WHERE subscription_ends_at IS NULL;

-- 3. Mettre à jour la fonction RPC de création de boutique pour inclure l'échéance exacte de 14 jours
CREATE OR REPLACE FUNCTION public.create_new_store(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_store_id UUID;
BEGIN
    INSERT INTO stores (name, subscription_plan, subscription_status, subscription_ends_at)
    VALUES (
        p_name,
        'TRIAL',
        'trial',
        NOW() + INTERVAL '14 days'
    )
    RETURNING id INTO new_store_id;

    INSERT INTO store_members (store_id, user_id, role)
    VALUES (new_store_id, auth.uid(), 'admin');

    RETURN new_store_id;
END;
$$;
