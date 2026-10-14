C'est la stack la plus courante des SaaS vibe-codés, et celle où les erreurs coûtent le plus cher : la base est directement joignable depuis Internet, sans backend pour la protéger. Tout repose donc sur la configuration.

## Requêtes de diagnostic à passer en premier

Dans le SQL Editor du dashboard :

```sql
-- Tables sans RLS : chacune est ouverte à quiconque a la clé anon
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;

-- Policies existantes : lire la colonne qual, une condition "true" ne protège rien
select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename;

-- Tables avec RLS mais sans aucune policy : inaccessibles (bug fonctionnel)
select t.tablename from pg_tables t
left join pg_policies p on p.tablename = t.tablename
where t.schemaname = 'public' and t.rowsecurity = true and p.policyname is null;

-- Fonctions en SECURITY DEFINER : elles s'exécutent avec les droits du créateur
-- et contournent la RLS. Chacune doit être justifiée et vérifier l'appelant.
select proname, prosecdef from pg_proc
where pronamespace = 'public'::regnamespace and prosecdef = true;
```

## Les erreurs récurrentes

**La clé `service_role` côté client.** Elle contourne toute la RLS. Vérifier chaque `createClient()` du frontend, et décoder le JWT en cas de doute : si `role` vaut `service_role`, c'est une clé administrateur. Elle ne doit exister que dans les variables d'environnement serveur, jamais derrière `NEXT_PUBLIC_` ou `VITE_`.

**La policy fourre-tout.** `using (true)` ou `to public` sur un `select` rend la table entièrement lisible : RLS activée, mais sans effet. À lire ligne par ligne, l'activation seule ne prouve rien.

**L'oubli des opérations d'écriture.** Une policy `select` bien écrite ne protège ni l'`insert`, ni l'`update`, ni le `delete`. Vérifier les quatre pour chaque table.

**Le schéma `storage` non couvert.** Les buckets ont leurs propres policies, dans la table `storage.objects`. Un bucket public laisse lire tous les fichiers par URL directe — vérifier si des documents personnels y sont stockés.

```sql
select id, name, public from storage.buckets;
select policyname, cmd, qual from pg_policies where schemaname = 'storage';
```

**Les Edge Functions sans vérification.** Une Edge Function déployée est une URL publique. Elle doit valider le JWT reçu et ne pas se contenter d'un identifiant passé dans le corps de la requête :

```ts
const authHeader = req.headers.get('Authorization');
const { data: { user }, error } = await supabase.auth.getUser(
  authHeader?.replace('Bearer ', '')
);
if (error || !user) return new Response('Non authentifié', { status: 401 });
```

**Les colonnes sensibles dans une table exposée.** Même avec une bonne policy, un `select('*')` renvoie toutes les colonnes de la ligne autorisée. Les données internes (notes d'administration, score de risque, flag `is_banned`) se rangent dans une table séparée, non couverte par la policy de lecture publique.

## Test de validation

Récupérer l'URL du projet et la clé anon depuis le code du frontend, puis, sans être connecté :

```bash
curl "https://<projet>.supabase.co/rest/v1/utilisateurs?select=*" \
  -H "apikey: <cle_anon>"
```

La réponse attendue est un tableau vide ou une erreur de permission. Si des données remontent, la table est publique. Refaire le test sur chaque table sensible.
