-- ==============================================================================
-- Migration : Intégration Moneriz pour MaBoutiquePro (Mobile Money & Cartes)
-- ==============================================================================

-- 1. Table des tentatives de paiement Moneriz (Idempotence & Suivi des sessions)
CREATE TABLE IF NOT EXISTS moneriz_checkout_attempts (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    mode TEXT NOT NULL DEFAULT 'live',
    reference TEXT UNIQUE NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    session_id TEXT,
    checkout_url TEXT,
    embed_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    customer_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moneriz_checkout_order_id ON moneriz_checkout_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_moneriz_checkout_reference ON moneriz_checkout_attempts(reference);
CREATE INDEX IF NOT EXISTS idx_moneriz_checkout_idempotency ON moneriz_checkout_attempts(idempotency_key);

-- 2. Table Inbox dédoublonnée des événements Webhook Moneriz (Protection double-traitement)
CREATE TABLE IF NOT EXISTS moneriz_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ajout des colonnes de gestion de l'abonnement dans la table des boutiques (stores)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'TRIAL';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days');

-- Sécurité RLS
ALTER TABLE moneriz_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE moneriz_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'moneriz_checkout_attempts' 
        AND policyname = 'Allow store members to view attempts'
    ) THEN
        CREATE POLICY "Allow store members to view attempts" ON moneriz_checkout_attempts
            FOR SELECT
            USING (
                store_id IS NULL OR 
                EXISTS (
                    SELECT 1 FROM store_members 
                    WHERE store_members.store_id = moneriz_checkout_attempts.store_id 
                    AND store_members.user_id = auth.uid()
                )
            );
    END IF;
END $$;
