-- ==============================================================================
-- BOUTIQUEPRO : MIGRATION EMAIL OUTBOX PATTERN (RÉSILIENCE TRANSACTIONNELLE)
-- ==============================================================================
-- Cette table garantit que TOUS les emails (factures, alertes, clôtures, relances)
-- sont enregistrés dans la transaction SQL avant d'être expédiés.
-- Si le serveur ou le réseau flanche, aucun email n'est perdu et le Cron réessaie.

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  template_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Index pour accélérer le dépilage périodique par le Cron Vercel
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending ON public.email_outbox (status, created_at)
WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_outbox_store_id ON public.email_outbox (store_id);

-- Activation du Row Level Security
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- 1. Lecture : uniquement les administrateurs de la boutique concernée
CREATE POLICY "email_outbox_select_admin" ON public.email_outbox
FOR SELECT TO authenticated
USING (
  store_id IS NULL OR store_id IN (
    SELECT store_id FROM public.store_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. Insertion : autorisée pour les membres authentifiés de la boutique
CREATE POLICY "email_outbox_insert_store" ON public.email_outbox
FOR INSERT TO authenticated
WITH CHECK (
  store_id IS NULL OR store_id IN (
    SELECT public.get_user_stores()
  )
);

-- 3. Mise à jour / Dépilage : réservé au Service Role (Cron serveur)
-- Supabase Service Role contourne RLS nativement pour le traitement automatique.

