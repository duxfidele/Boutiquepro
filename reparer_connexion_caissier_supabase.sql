-- ==============================================================================
-- RÉPARATION IMMÉDIATE : CONNEXION DES CAISSIERS DANS SUPABASE (VERSION CORRIGÉE UUID)
-- À copier et exécuter dans le SQL Editor de votre projet Supabase
-- ==============================================================================

-- 1. RÉPARER LES COLONNES NULL QUI FONT CRASHER GOTRUE AVEC L'ERREUR 500
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false),
  aud = COALESCE(aud, 'authenticated'),
  role = COALESCE(role, 'authenticated'),
  updated_at = now()
WHERE email LIKE '%@caisse.maboutique.app' 
   OR confirmation_token IS NULL 
   OR recovery_token IS NULL;

-- 2. CRÉER L'IDENTITÉ AUTH.IDENTITIES (ID EN TYPE UUID)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    u.id, -- UUID direct (sans cast text)
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', LOWER(u.email), 'email_verified', true),
    'email',
    u.id::text,
    now(),
    now(),
    now()
FROM auth.users u
WHERE u.email LIKE '%@caisse.maboutique.app'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  )
ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();
