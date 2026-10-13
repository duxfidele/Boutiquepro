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

-- 4. Sécurité & Droits d'écriture RLS (Permet la création des sessions et la réception des webhooks)
ALTER TABLE moneriz_checkout_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on moneriz_checkout_attempts" ON moneriz_checkout_attempts;
CREATE POLICY "Allow all on moneriz_checkout_attempts" ON moneriz_checkout_attempts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE moneriz_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on moneriz_webhook_events" ON moneriz_webhook_events;
CREATE POLICY "Allow all on moneriz_webhook_events" ON moneriz_webhook_events FOR ALL USING (true) WITH CHECK (true);
