-- ==============================================================================
-- BOUTIQUEPRO : SESSIONS DE CAISSE ET RAPPORT Z DE CLÔTURE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cashier_name TEXT,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC,
  expected_amount NUMERIC,
  difference NUMERIC,
  total_cash_sales NUMERIC DEFAULT 0,
  total_mobile_money_sales NUMERIC DEFAULT 0,
  total_card_sales NUMERIC DEFAULT 0,
  total_sales_count INT DEFAULT 0,
  total_sales_amount NUMERIC DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activation du Row Level Security
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cash sessions isolation by store" ON public.cash_sessions;
CREATE POLICY "Cash sessions isolation by store"
ON public.cash_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = cash_sessions.store_id
      AND sm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = cash_sessions.store_id
      AND sm.user_id = auth.uid()
  )
);

-- Index pour requêtes instantanées
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_status ON public.cash_sessions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_store ON public.cash_sessions(user_id, store_id);

-- Ajout optionnel de session_id dans sales si non présent
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'session_id'
    ) THEN
      ALTER TABLE public.sales ADD COLUMN session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
