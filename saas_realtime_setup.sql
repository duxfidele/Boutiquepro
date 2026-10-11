-- ==============================================================================
-- BOUTIQUEPRO SAAS : ACTIVATION DU TEMPS RÉEL (SUPABASE REALTIME)
-- ==============================================================================
-- Exécutez cette commande dans l'éditeur SQL de votre tableau de bord Supabase.
-- Le script vérifie automatiquement si la table est déjà active pour éviter toute erreur.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Ajouter la table 'products' seulement si elle n'est pas déjà présente
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'products'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE products;
      RAISE NOTICE 'Table products ajoutée à la publication supabase_realtime';
    ELSE
      RAISE NOTICE 'Table products est déjà dans la publication supabase_realtime';
    END IF;

    -- Ajouter la table 'sales' seulement si elle n'est pas déjà présente
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'sales'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE sales;
      RAISE NOTICE 'Table sales ajoutée à la publication supabase_realtime';
    ELSE
      RAISE NOTICE 'Table sales est déjà dans la publication supabase_realtime';
    END IF;
  END IF;
END $$;

-- 2. Vérification des tables actuellement actives en temps réel
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
