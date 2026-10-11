-- ==============================================================================
-- BOUTIQUEPRO SAAS : ACTIVATION DU TEMPS RÉEL (SUPABASE REALTIME)
-- ==============================================================================
-- Exécutez cette commande dans l'éditeur SQL de votre tableau de bord Supabase
-- pour permettre la diffusion instantanée des changements de stock et des ventes.

-- 1. Ajouter les tables products et sales à la publication realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
    ALTER PUBLICATION supabase_realtime ADD TABLE sales;
  END IF;
END $$;

-- 2. Vérification des tables activées
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
