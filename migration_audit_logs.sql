-- ==============================================================================
-- BOUTIQUEPRO : JOURNAL D'AUDIT SÉCURISÉ & MÉTRIQUES QUOTIDIENNES
-- ==============================================================================
-- 1. Table audit_logs : Traçabilité absolue et infalsifiable des actions critiques.
--    (Toute mise à jour ou suppression est formellement révoquée).
-- 2. Table daily_metrics : Synthèse nocturne pré-calculée par le Cron Vercel.

-- 1. TABLE AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB DEFAULT NULL,
  new_values JSONB DEFAULT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche rapide et filtrage
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_created ON public.audit_logs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- Activation de RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les administrateurs de la boutique peuvent lire le journal d'audit
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  store_id IS NULL OR store_id IN (
    SELECT store_id FROM public.store_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Les membres authentifiés peuvent émettre des logs pour leur boutique
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  store_id IS NULL OR store_id IN (
    SELECT public.get_user_stores()
  )
);

-- Interdiction stricte de modifier ou supprimer un log d'audit (Immutabilité garantie)
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;


-- 2. TABLE DAILY_METRICS (AGRÉGATION VERCEL CRON)
CREATE TABLE IF NOT EXISTS public.daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_sales_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_store_date ON public.daily_metrics(store_id, date DESC);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_metrics_select" ON public.daily_metrics;
CREATE POLICY "daily_metrics_select" ON public.daily_metrics
FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_user_stores()));

