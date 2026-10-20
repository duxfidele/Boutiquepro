-- ==============================================================================
-- BOUTIQUEPRO : SCRIPT DE RETOUR ARRIÈRE (ROLLBACK v1.1)
-- ==============================================================================
-- Ce script annule en toute sécurité les modifications de la v1.1 si nécessaire.

-- 1. Supprimer les triggers de restriction Starter
DROP TRIGGER IF EXISTS trg_block_starter_credit ON public.sales;
DROP FUNCTION IF EXISTS public.trg_check_starter_credit_sale();

DROP TRIGGER IF EXISTS trg_block_starter_inventory ON public.inventory_sessions;
DROP FUNCTION IF EXISTS public.trg_check_starter_inventory();

DROP TRIGGER IF EXISTS trg_block_starter_orders ON public.orders;
DROP FUNCTION IF EXISTS public.trg_check_starter_orders();

DROP TRIGGER IF EXISTS trg_protect_store_owner ON public.stores;
DROP FUNCTION IF EXISTS public.trg_prevent_direct_store_tampering();

-- 2. Restaurer les permissions de base
GRANT INSERT, DELETE ON public.stores TO authenticated;
GRANT INSERT, DELETE ON public.store_members TO authenticated;

-- 3. Restaurer la version précédente de create_new_store et admin_create_cashier
-- (Les fonctions de repli du script saas_etape1_hardening_and_cleanup.sql)

-- 4. Conserver les tables admin_subscriptions et subscription_history sans les supprimer
-- pour éviter toute perte de données accidentelle.
