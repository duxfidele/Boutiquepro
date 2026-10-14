Sommaire :

- **Secrets et configuration** : 1. Clés API cachées · 2. Secrets purgés de Git · 3. Bonne clé de base côté client
- **Accès aux données** : 4. Row Level Security · 5. Chiffrement des données sensibles · 6. Autorisation côté serveur · 7. Verrouillage par enregistrement · 8. Champs non modifiables
- **Comptes et sessions** : 9. Cookies de session sécurisés · 10. Mots de passe hachés · 11. Rate limiting sur l'authentification · 12. Protection anti-bot
- **Entrées utilisateur** : 13. Requêtes paramétrées · 14. Validation des entrées · 15. Échappement du contenu · 16. Uploads restreints
- **Transport et surface** : 17. Réponses API épurées · 18. Headers de sécurité · 19. HTTPS forcé · 20. Dépendances scannées

---

## Secrets et configuration

### 1. Cacher les clés API

**Risque.** Une clé OpenAI, Anthropic, Stripe ou Resend présente dans le code du frontend est lisible par n'importe quel visiteur (onglet Sources du navigateur, ou `view-source`). Des robots scannent en permanence les sites publics à la recherche de ces clés. Le scénario habituel : facture d'API à plusieurs centaines de milliers de francs en une nuit.

**Vérifier.**
```bash
grep -rEn "sk-[A-Za-z0-9_-]{16,}|sk_live_|pk_live_|AIza[0-9A-Za-z_-]{20,}|xoxb-|ghp_|AKIA[0-9A-Z]{16}" \
  --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.vue" --include="*.svelte" --include="*.html" --include="*.py" --include="*.json" --include="*.yml" . \
  --exclude-dir={node_modules,.git,dist,build}
```
Vérifier aussi les variables exposées au navigateur : dans Next.js tout ce qui commence par `NEXT_PUBLIC_`, dans Vite `VITE_`, dans Create React App `REACT_APP_`. Une clé secrète derrière un de ces préfixes est publique, quel que soit le nom du fichier.

**Corriger.** Tout appel à une API payante ou privilégiée passe par une route serveur (`/api/...`, une Edge Function, un backend Express). Le frontend appelle cette route ; la clé ne quitte jamais le serveur. Après correction, **révoquer et régénérer** toute clé qui a été exposée : elle doit être considérée comme compromise, même si rien d'anormal n'a été constaté.

### 2. Purger les secrets de l'historique Git

**Risque.** Supprimer un fichier `.env` puis commiter ne l'efface pas : il reste dans l'historique, consultable par quiconque clone le dépôt. Sur un repo public, l'exposition est totale.

**Vérifier.**
```bash
git log --all --full-history --name-only --pretty=format: | sort -u | grep -E "\.env|credentials|secret|\.pem|\.key|serviceAccount"
grep -c "^\.env" .gitignore
```

**Corriger.** Régénérer d'abord toutes les clés concernées — c'est l'étape qui compte réellement, la purge de l'historique n'est que du nettoyage. Puis réécrire l'historique avec `git filter-repo` (ou BFG Repo-Cleaner) et forcer le push. Ajouter `.env*` au `.gitignore` et fournir un `.env.example` sans valeurs.

### 3. Utiliser la clé publique de base de données côté client

**Risque.** Supabase et Firebase distribuent deux clés. La clé publique (`anon` / apiKey web) est conçue pour être visible et n'ouvre que ce que les règles autorisent. La clé `service_role` contourne toutes les règles de sécurité. Placée dans le frontend, elle donne à n'importe quel visiteur un accès administrateur complet à la base : lecture, modification, suppression de toutes les tables.

**Vérifier.**
```bash
grep -rn "service_role\|SUPABASE_SERVICE\|serviceAccountKey\|createClient(" \
  --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" src/ app/ components/ 2>/dev/null
```
Un JWT Supabase se décode : si le champ `role` vaut `service_role`, la clé est administrateur. Vérifier chaque `createClient()` appelé depuis un fichier du frontend.

**Corriger.** Côté client, uniquement la clé `anon`. La `service_role` reste dans les variables d'environnement serveur, sans préfixe public. Si elle a fuité, la régénérer depuis le dashboard.

---

## Accès aux données

### 4. Activer la Row Level Security

**Risque.** Sans RLS, la clé publique suffit à lire n'importe quelle table. Le scénario : ouvrir la console du navigateur, récupérer l'URL du projet et la clé anon dans le code, exécuter une requête, récupérer la table complète des utilisateurs. C'est la première chose que fait un curieux sur un projet vibe-codé.

**Vérifier.** Dans le SQL Editor :
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public';
```
Toute table avec `rowsecurity = false` est ouverte. Une table avec RLS activée mais **aucune** policy est fermée à tous (bug fonctionnel, pas faille). Une policy dont la condition est `true` équivaut à pas de RLS.

**Corriger.**
```sql
alter table public.projets enable row level security;

create policy "lecture de ses propres projets"
  on public.projets for select
  using (auth.uid() = user_id);

create policy "création de ses propres projets"
  on public.projets for insert
  with check (auth.uid() = user_id);
```
Une policy par opération (`select`, `insert`, `update`, `delete`). Tester ensuite avec deux comptes différents : le compte A ne doit rien voir des données du compte B.

### 5. Chiffrer les données sensibles

**Risque.** Numéros de téléphone, pièces d'identité, tokens d'API de clients, coordonnées bancaires stockés en clair : une seule fuite de base expose tout, définitivement.

**Vérifier.** Parcourir le schéma à la recherche de colonnes sensibles stockées en `text` brut. Vérifier aussi les logs applicatifs — les données sensibles y atterrissent souvent via des `console.log` de débogage laissés en place.

**Corriger.** Chiffrer au niveau applicatif avant insertion (AES-GCM avec une clé en variable d'environnement), ou utiliser `pgcrypto`. Meilleure option quand elle est possible : ne pas stocker. Pour les cartes bancaires, ne jamais stocker — déléguer à Stripe, PayDunya ou Wave et ne conserver que l'identifiant de transaction.

### 6. Imposer l'authentification côté serveur

**Risque.** `if (user.role === 'admin')` dans un composant React masque un bouton, mais n'empêche rien : l'attaquant appelle directement l'API. Toute vérification faite uniquement dans le navigateur est décorative — le code du frontend est sous le contrôle total du visiteur.

**Vérifier.** Lister chaque route API et confirmer qu'elle commence par une vérification de session côté serveur. Chercher les routes qui font confiance à un `userId` reçu dans le corps de la requête plutôt que de le lire depuis la session :
```bash
grep -rn "req.body.userId\|req.query.userId\|body.user_id" --include="*.js" --include="*.ts" .
```

**Corriger.** L'identité vient de la session vérifiée côté serveur, jamais du client :
```js
const { data: { user } } = await supabase.auth.getUser();
if (!user) return res.status(401).json({ error: 'Non authentifié' });
// utiliser user.id — jamais req.body.userId
```

### 7. Verrouiller l'accès par enregistrement

**Risque.** L'utilisateur est bien authentifié, mais rien ne vérifie qu'il est propriétaire de la ressource demandée. Changer `/facture/1042` en `/facture/1043` affiche la facture d'un autre client. C'est la faille la plus répandue et la plus simple à exploiter — aucun outil nécessaire, juste la barre d'adresse.

**Vérifier.** Pour chaque route qui prend un identifiant en paramètre, confirmer que la requête filtre aussi sur le propriétaire. Test manuel : se connecter avec le compte A, demander une ressource du compte B, vérifier qu'on obtient bien une erreur.

**Corriger.**
```js
const { data } = await supabase
  .from('factures')
  .select('*')
  .eq('id', factureId)
  .eq('user_id', user.id)   // le filtre qui change tout
  .single();
```

### 8. Bloquer la modification de champs sensibles

**Risque.** Une route de mise à jour de profil qui accepte l'objet entier envoyé par le client permet d'y glisser `{"role": "admin"}` ou `{"credits": 999999}`. L'utilisateur se promeut lui-même.

**Vérifier.** Chercher les mises à jour qui passent le corps de requête tel quel :
```bash
grep -rn "update(req.body)\|update({ ...req.body\|\.update(body)" --include="*.js" --include="*.ts" .
```

**Corriger.** N'extraire que les champs autorisés, explicitement :
```js
const { nom, avatar_url } = req.body;   // liste blanche
await supabase.from('profils').update({ nom, avatar_url }).eq('id', user.id);
```
Côté base, une policy `with check` peut empêcher la modification du rôle. Les champs comme `role`, `credits`, `is_premium` ne se modifient que par du code serveur privilégié.

---

## Comptes et sessions

### 9. Sécuriser les cookies de session

**Risque.** Un token stocké dans `localStorage` est lisible par tout script JavaScript s'exécutant sur la page — une seule faille XSS suffit à voler la session. Un cookie sans `Secure` circule en clair sur une connexion HTTP.

**Vérifier.** Chercher `localStorage.setItem` avec un token, et contrôler les options des cookies posés côté serveur.

**Corriger.** Cookies `httpOnly: true`, `secure: true`, `sameSite: 'lax'` (ou `'strict'`), avec une durée d'expiration explicite. Prévoir l'invalidation à la déconnexion et une rotation du token à la connexion.

### 10. Hacher les mots de passe

**Risque.** Mots de passe stockés en clair ou en MD5/SHA1 : au premier accès à la base, tous les comptes tombent — et comme les mots de passe sont réutilisés, les comptes email des utilisateurs avec.

**Vérifier.** Si l'authentification est déléguée (Supabase Auth, Clerk, Auth0), c'est géré : marquer conforme après avoir confirmé qu'aucune table maison ne stocke de mot de passe. Sinon, chercher `md5`, `sha1`, `createHash` sur un mot de passe.

**Corriger.** `bcrypt` (coût ≥ 12) ou `argon2`. Jamais de chiffrement réversible, jamais de hachage sans sel. Le plus simple reste de ne pas gérer les mots de passe soi-même.

### 11. Limiter les tentatives de connexion

**Risque.** Sans limite, un script teste des milliers de mots de passe par minute. Sur un formulaire d'inscription, il crée des milliers de comptes. Sur un envoi d'email ou de SMS, il fait exploser la facture.

**Vérifier.** Chercher un middleware de rate limiting sur les routes `/login`, `/signup`, `/reset-password`, `/otp`.

**Corriger.** `express-rate-limit`, `upstash/ratelimit` ou l'équivalent : environ 5 tentatives par 15 minutes et par IP sur la connexion, avec verrouillage progressif du compte. Renvoyer un message identique en cas d'email inexistant ou de mot de passe faux, pour ne pas révéler quels comptes existent.

### 12. Ajouter une protection anti-bot

**Risque.** Formulaires publics submergés de spam, comptes créés en masse pour épuiser un quota d'essai gratuit, scraping de contenu.

**Vérifier.** Présence d'un CAPTCHA ou équivalent sur les formulaires ouverts.

**Corriger.** Cloudflare Turnstile ou hCaptcha sur l'inscription et les formulaires publics — vérification faite côté serveur, jamais seulement dans le navigateur. Un champ honeypot invisible arrête déjà une partie des robots simples.

---

## Entrées utilisateur

### 13. Paramétrer les requêtes SQL

**Risque.** Une requête construite par concaténation permet l'injection SQL : un champ de recherche devient un outil pour lire ou supprimer n'importe quelle table.

**Vérifier.**
```bash
grep -rnE "query\(.*\+|query\(\`.*\\\$\{|execute\(.*%s.*%" --include="*.js" --include="*.ts" --include="*.py" .
```
Les clients Supabase et les ORM (Prisma, Drizzle) paramètrent par défaut ; le risque se concentre dans le SQL écrit à la main et dans les fonctions Postgres personnalisées.

**Corriger.** Requêtes préparées avec placeholders (`$1`, `?`), jamais de concaténation. Dans les fonctions Postgres, `execute ... using` plutôt que la construction de chaîne.

### 14. Valider toutes les entrées

**Risque.** Le serveur qui fait confiance à ce qu'il reçoit se retrouve avec des données corrompues, des erreurs 500 exploitables, ou un fichier de 2 Go en base. La validation faite dans le formulaire est contournable en une requête `curl`.

**Vérifier.** Chaque route API valide-t-elle le type, la longueur et le format de ce qu'elle reçoit ?

**Corriger.** Un schéma par route avec Zod, Yup ou Joi, appliqué côté serveur en plus du formulaire. Valider aussi les paramètres d'URL et de pagination (une limite non bornée permet de tout aspirer en une requête).

### 15. Échapper le contenu utilisateur

**Risque.** XSS : un utilisateur poste `<script>` dans un commentaire, le code s'exécute chez tous les visiteurs et vole leurs sessions.

**Vérifier.**
```bash
grep -rn "dangerouslySetInnerHTML\|innerHTML\s*=\|v-html" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.vue" .
```

**Corriger.** React échappe automatiquement — le danger vient précisément des contournements ci-dessus. Si du HTML riche doit être affiché, le nettoyer avec DOMPurify avant rendu. Assainir à l'affichage plutôt qu'au stockage, pour conserver la donnée d'origine.

### 16. Restreindre les uploads de fichiers

**Risque.** Upload sans contrôle : hébergement de contenus illégaux sur le domaine, saturation du stockage, ou fichier exécutable servi aux visiteurs.

**Vérifier.** Y a-t-il une limite de taille, une liste blanche d'extensions, une vérification du type réel du fichier ? Les policies du bucket de stockage sont-elles configurées ?

**Corriger.** Liste blanche d'extensions **et** vérification des octets d'en-tête (le `Content-Type` envoyé par le client se falsifie). Limite de taille explicite. Renommer les fichiers avec un UUID à l'arrivée. Servir depuis un domaine ou un bucket séparé, avec des policies de stockage restreignant l'écriture au propriétaire.

---

## Transport et surface

### 17. Épurer les réponses d'API

**Risque.** Un `select('*')` sur une table utilisateurs renvoie aussi les emails, les hachages, les rôles et les notes internes — même si l'interface n'en affiche qu'une partie. Il suffit d'ouvrir l'onglet Réseau pour tout lire.

**Vérifier.** Chercher les `select('*')` et les objets renvoyés en bloc sur les routes publiques.

**Corriger.** Sélectionner explicitement les colonnes nécessaires. Prévoir des vues publiques distinctes pour les données affichables par des tiers.

### 18. Ajouter les headers de sécurité

**Risque.** Sans headers, l'application est vulnérable au clickjacking (mise en iframe), au sniffing de type MIME et aux fuites de referrer.

**Vérifier.** `curl -sI https://mon-app.com | grep -iE "content-security-policy|x-frame|strict-transport|x-content-type"`

**Corriger.** `helmet` sur Express, ou les headers dans `next.config.js` / `netlify.toml` / `vercel.json` : `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`.

### 19. Forcer HTTPS

**Risque.** En HTTP, les identifiants et les cookies transitent en clair — interceptables sur un wifi partagé.

**Vérifier.** Une requête sur `http://` doit répondre par une redirection 301 vers `https://`.

**Corriger.** Redirection permanente au niveau de l'hébergeur, plus HSTS. Vérifier qu'aucune ressource n'est chargée en `http://` dans les pages (contenu mixte).

### 20. Scanner les dépendances

**Risque.** Une faille dans un paquet installé est une faille dans l'application. Les projets vibe-codés accumulent des dépendances jamais mises à jour.

**Vérifier.**
```bash
npm audit --omit=dev
npx depcheck        # repérer les paquets installés puis oubliés
```

**Corriger.** Traiter les vulnérabilités `high` et `critical` avant la mise en ligne. Supprimer les dépendances inutilisées : chacune est une surface d'attaque. Activer Dependabot sur le dépôt pour la suite.

---

## Test final avant mise en ligne

Une fois les corrections faites, ces quatre tests manuels valent tous les scans automatiques :

1. **Test des deux comptes.** Créer A et B, se connecter avec A, essayer d'atteindre les données de B en modifiant les identifiants dans l'URL et dans les appels API.
2. **Test de la console.** Ouvrir l'onglet Réseau sur les pages principales et lire les réponses : y a-t-il des champs qui ne devraient pas sortir du serveur ?
3. **Test de la clé anon.** Récupérer l'URL du projet et la clé publique depuis le code, tenter une requête sur chaque table sensible depuis un terminal, sans être connecté. Tout doit être refusé.
4. **Test du client déloyal.** Appeler les routes d'API sans passer par l'interface, avec des valeurs inattendues : identifiant d'un autre utilisateur, champ `role` ajouté, chaîne de 10 000 caractères.
