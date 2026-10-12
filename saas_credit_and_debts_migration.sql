-- ==============================================================================
-- MIGRATION SUPABASE : GESTION DES CRÉDITS, DETTES ET ACOMPTES DE CAISSE
-- À exécuter dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Ajouter les colonnes de suivi de dette et crédit sur la table sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- 2. Initialiser proprement les anciennes ventes pour éviter tout reste dû indéfini
UPDATE public.sales
SET 
  amount_paid = COALESCE(amount_paid, CASE WHEN payment_method = 'credit' THEN 0 ELSE total END),
  remaining_amount = COALESCE(remaining_amount, CASE WHEN payment_method = 'credit' THEN total ELSE 0 END),
  payment_status = COALESCE(payment_status, CASE WHEN payment_method = 'credit' THEN 'unpaid' ELSE 'paid' END)
WHERE amount_paid IS NULL OR remaining_amount IS NULL OR payment_status IS NULL;

-- 3. Notification de succès
SELECT 'Migration des crédits et dettes exécutée avec succès !' AS message;
