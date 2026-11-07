# MaBoutiquePro - Documentation Complète & Référence Technique

## 📋 Présentation Générale
**MaBoutiquePro** est une application web moderne conçue pour la gestion commerciale et le point de vente (POS) adaptée aux réalités du marché africain (monnaie FCFA, Mobile Money, relances WhatsApp, utilisation mobile & tablette).

Elle permet à de multiples commerçants de gérer leurs boutiques, leurs stocks, leurs ventes au comptant ou à crédit, et leurs employés depuis une interface unique, moderne et ultra-rapide. L'application est installable (PWA) et déployée sous le domaine officiel **[maboutiquepro.app](https://maboutiquepro.app)**.

---

## 🛠️ Stack Technique
- **Frontend :** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React (Icônes), `@base-ui/react`.
- **Backend & Base de données :** Supabase (PostgreSQL, Authentification, Row Level Security, Triggers & Fonctions RPC en PL/pgSQL).
- **Authentification & Fournisseurs :** Supabase Auth (Email / Mot de passe avec flux PKCE sécurisé) + **Google OAuth 2.0** en 1 clic (écran de consentement configuré sur Google Cloud Console et redirect URLs `maboutiquepro.app`).
- **Protection Anti-CSRF & Middleware Edge :** `src/middleware.ts` avec vérification stricte des requêtes mutantes (`POST`, `PUT`, `DELETE`, `PATCH`), en-tête `Origin` / `Host` validés et exemption HMAC-SHA256 pour les webhooks Moneriz.
- **Stockage Objets & Médias :** Cloudflare R2 (compatible S3) avec client pur Node.js AWS SigV4 (`src/lib/server/r2-storage.ts`), isolation des dossiers par boutique (`stores/[storeId]/...`), quota de 5 Mo et **validation binaire Magic Bytes** (détection réelle des entêtes JPEG, PNG, WEBP, GIF, PDF et rejet strict des fichiers exécutables masqués).
- **Moteur Transactionnel d'Emails & Outbox :** API Resend + **Transactional Outbox Pattern** dans Supabase (`email_outbox`). Déclenchement asynchrone instantané dès la mise en file d'attente avec reprise automatique en cas d'échec réseau.
- **Tâches Planifiées (Crons) :** Vercel Cron Jobs sécurisés par jeton d'authentification `CRON_SECRET` (`/api/cron/...`), configurés pour la compatibilité avec le plan Vercel Hobby (exécution quotidienne nocturne).
- **Audit & Traçabilité Immuable :** Table PostgreSQL `audit_logs` sanctuarisée (révocation des privilèges `UPDATE` et `DELETE` pour garantir l'intégrité légale et comptable).
- **Observabilité & Suivi des Erreurs :** Sentry Store API v7 haute performance intégrée nativement dans les composants d'erreur React (`global-error.tsx`, `error.tsx`) sans impact sur le chargement.
- **Format monétaire :** Franc CFA (XOF/XAF - FCFA) avec gestion anti-NaN garantie sur tous les calculs.
- **Domaine officiel :** `https://maboutiquepro.app` (associé à Vercel & Supabase Auth).
- **Passerelle de Paiement SaaS :** Moneriz (Spécification v1 Liveframe & Webhooks sécurisés HMAC-SHA256).
- **Import / Export Tableurs :** Bibliothèque `xlsx` durcie (validation des types MIME et extensions, limite stricte de 5 Mo, plafond de 5 000 lignes anti-DoS) pour l'import de catalogue et l'export d'inventaire/analytique.
- **PWA :** `@ducanh2912/next-pwa` (Mise en cache locale, mode installable sur écran d'accueil smartphone/tablette).
- **Impression & Documents :** Impression thermique directe (80mm/58mm via CSS `@media print`), factures et quittances PDF (`jspdf`, `html2canvas`, `jspdf-autotable`).
- **Messagerie & Relances :** Intégration WhatsApp Business / Web avec indicatif international Togo (+228 / 00228) et formatage automatique des téléphones à 8 chiffres.
- **Sécurité Réseau & Headers :** HSTS (Strict-Transport-Security 2 ans), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Gestionnaire de versions :** Git & GitHub (Dépôt : `https://github.com/duxfidele/Boutiquepro.git`).

---

## 🔐 Architecture SaaS Multi-Tenant & Sécurité
L'application fonctionne selon le modèle **SaaS Multi-Tenant**. Chaque commerçant peut posséder une ou plusieurs boutiques distinctes.

Les données sont strictement cloisonnées grâce aux **Row Level Security (RLS)** de PostgreSQL et à un partitionnement d'état local par boutique :
- Chaque requête vérifie que l'utilisateur connecté appartient bien à l'équipe de la boutique (`store_id`) avant de renvoyer la moindre donnée.
- Un caissier ou un propriétaire d'une boutique A ne peut **jamais** lire ni manipuler les données d'une boutique B.
- Les états locaux de cache et les sessions d'inventaire sont isolés par boutique (`boutiquepro-state-[storeId]`, `boutiquepro-cart-[storeId]`).

### Tables clés (cloisonnées par `store_id`) :
- `stores` : Boutiques créées (`id`, `name`, `owner_id`, `created_at`).
- `store_members` : Liaison entre les utilisateurs (`user_id`), la boutique (`store_id`) et leur rôle (`role` : admin / cashier).
- `profiles` : Profils publics (nom complet, email, téléphone, rôle par défaut).
- `products` & `categories` : Catalogue des articles (nom, SKU/code-barres, prix de vente, stock, stock minimum, image/emoji).
- `product_costs` : Table sanctuarisée réservée aux administrateurs (coûts d'achat `cost`, RLS étanche, inaccessible aux caissiers).
- `sales` & `sale_items` : Historique des ventes comptant et à crédit (`payment_method`, `payment_status`, `amount_paid`, `remaining_amount`, `due_date`).
- `debt_payments` : Historique des remboursements des créances (`sale_id`, `amount`, `payment_method`, `paid_at`, `cashier_name`).
- `customers` : Base clients (nom, téléphone, total des achats, solde débiteur).
- `cash_sessions` : Sessions et clôtures de caisse (fonds de caisse initial, ventes encaissées, écarts réels, rapports X & Z).
- `expenses` : Charges opérationnelles (loyer, salaires, factures).
- `orders` & `order_items` : Commandes et réapprovisionnements fournisseurs.
- `inventory_sessions` & `inventory_items` : Sessions d'inventaire physique filtrées par boutique et régularisation des écarts.
- `settings` : Paramètres personnalisés de chaque boutique (nom, logo, devise, TVA, ville, pays, téléphone, email).
- `subscription_orders` & `moneriz_events` : Traçabilité des abonnements SaaS et événements de paiement Moneriz.
- `email_outbox` : File d'attente d'envoi d'emails transactionnels (`recipient`, `subject`, `html`, `status`: pending/sent/failed, `attempts`, `error_message`, `created_at`, `processed_at`).
- `audit_logs` : Journal d'audit inviolable des actions administrateur critiques (`store_id`, `actor_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `details`, `created_at`). Révocation absolue des droits d'altération et de suppression (`REVOKE UPDATE, DELETE`).
- `daily_metrics` : Consolidation nocturne quotidienne des agrégats d'activité par boutique (`store_id`, `metric_date`, `total_sales_count`, `gross_revenue`, `cash_collected`, `total_expenses`, `net_profit`, `credit_issued`, `credit_recovered`).

---

## 👥 Rôles et Permissions (RBAC)

### 1. Administrateur / Gérant (`admin`)
- **Multi-Boutiques :** Création de nouvelles boutiques (`+ Créer une boutique`) et bascule instantanée d'un établissement à un autre avec synchronisation immédiate sur ordinateur comme sur mobile.
- **Accès complet :**
  - Tableau de bord global (CA Réalisé, CA Encaissé, Dettes en attente, Bénéfice Net, Total des Dépenses, Alertes de stock).
  - Gestion du catalogue : Création manuelle ou **Importation massive par fichier Excel/CSV** avec détection de doublons et contrôle anti-DoS.
  - Carnet de crédits & recouvrement (`/debts`) : Suivi des impayés, enregistrement des versements, émission des quittances et relances WhatsApp.
  - Inventaire physique, Dépenses, Analytique complète, Commandes fournisseurs, Paramètres.
  - Gestion de l'abonnement SaaS de la boutique via Moneriz.
- **Gestion d'Équipe (`/team`) :**
  - Création directe de comptes caissiers avec email et mot de passe immédiats (via RPC `admin_create_cashier`).
  - Affectation et révocation d'accès en 1 clic.

### 2. Caissier (`cashier`)
- **Tableau de bord personnel (`/`) :**
  - Consulter uniquement ses propres performances de shift (son CA du jour, ses encaissements, son nombre de tickets).
  - **Confidentialité totale du patron :** Les prix d'achat (`product_costs`), les marges bénéficiaires, le bénéfice net de la boutique, les dépenses et les ventes des collègues sont strictement inaccessibles.
- **Point de Vente (POS) & Caisse :**
  - Vente au comptant (Espèces, Mobile Money, Carte) et vente à crédit avec acompte et date d'échéance.
  - Gestion du tiroir-caisse : Ouverture avec fond initial, point d'étape (Rapport X), clôture journalière et Rapport Z avec détection d'écarts.
- **Accès restreint & Sécurisé :**
  - Redirection automatique si tentative d'accès à `/analytics`, `/expenses`, `/team`, `/settings`, `/orders` ou aux endpoints API d'abonnement.
  - Pas de modification possible du catalogue ni de suppression d'articles.

---

## 💡 Modules Clés & Fonctionnalités Récentes

### 1. Importation de Produits via Fichier Excel / CSV (`/products`)
- **Bouton vert émeraude « Importer Excel »** en tête de page et invitation contextuelle si catalogue vide.
- **Téléchargement d'un Modèle Excel** (`modele_import_produits_boutiquepro.xlsx`) configuré avec les colonnes recommandées.
- **Algorithme d'analyse intelligent et tolérant** :
  - Détection automatique des colonnes même avec des intitulés variés (*Produit, Désignation, Libellé, PV, PA, Qté, etc.*).
  - Nettoyage automatique des montants (anti-NaN garanti).
  - Génération automatique de code SKU s'il est omis.
  - Détection ou création automatique des catégories avec emoji/icône adapté.
- **Durcissement de sécurité pré-lancement :**
  - Contrôle strict des extensions acceptées (`.xlsx`, `.xls`, `.csv`).
  - Plafond de taille de fichier fixé à **5 Mo** maximum.
  - Limitation automatique à **5 000 lignes** analysées pour immuniser le navigateur contre les blocages mémoire et attaques par déni de service (ReDoS).
- **Tableau de prévisualisation avant validation** :
  - Statistiques immédiates : nombre de nouveaux articles, articles existants, valeur globale du stock importé.
  - Gestion des doublons : option de mettre à jour le produit existant ou de l'ignorer.
- **Enregistrement en masse ultra-rapide (`BATCH_ADD_PRODUCTS`)** par lot dans Supabase via `upsert`.

### 2. Nom de Domaine Personnalisé & Récupération de Mot de Passe
- **Domaine officiel connecté :** `https://maboutiquepro.app`.
- **Lien « Mot de passe oublié ? »** directement intégré dans la fenêtre de connexion (`Login.tsx`).
- Envoi d'un e-mail contenant le lien de réinitialisation sécurisé via `supabase.auth.resetPasswordForEmail` ciblant `https://maboutiquepro.app/reset-password`.
- **Page dédiée `/reset-password`** avec prise en charge des flux PKCE (`?code=...`) et mise à jour sécurisée via `supabase.auth.updateUser`.
- Exception explicite dans `AppWrapper.tsx` pour garantir l'accès direct sans blocage.

### 3. Carnet de Crédits & Recouvrement (`/debts` et Point de Vente)
- **Vente à crédit intégrée au panier :** Choix du mode « À crédit », acompte initial, sélection client et date d'échéance.
- **Journal et suivi des créances :** Statuts dynamiques (*Non payé*, *Partiel*, *Soldé*, *En retard*), enregistrement des règlements partiels/totaux avec traçabilité de l'opérateur.
- **Quittance de recouvrement certifiée :** Ticket thermique et téléchargement PDF officiel récapitulant dette initiale, versements passés, versement du jour et solde restant dû.
- **Relances WhatsApp Togo (+228) :** Redirection instantanée avec message pré-formaté et conversion automatique des numéros togolais à 8 chiffres vers le format international `+228`.
- **Indicateurs financiers réconciliés :** CA théorique vs CA encaissé réel, taux de recouvrement, montant total des créances et bénéfice net encaissé.

### 4. Clôture de Caisse Journalière & Réconciliation des Espèces (Rapports X & Z)
- **Bandeau dynamique en temps réel :** État d'ouverture de caisse, nom de l'opérateur, fond initial et espèces théoriques dans le tiroir.
- **Réconciliation intégrale des flux d'espèces :** Ventes espèces + Acomptes initiaux crédits + Recouvrements dettes du jour.
- **Dédoublonnage comptable infaillible (`getInitialCreditDeposit`) :** Séparation nette entre l'acompte d'origine et les recouvrements ultérieurs pour éliminer tout double comptage.
- **Rapports X & Z certifiés :** Point d'étape provisoire (X) et clôture journalière définitive (Z) avec comptage physique des coupures, calcul automatique de l'écart (conforme, déficit, excédent) et impression thermique ou PDF.

### 5. Mode Hors-Ligne (Offline Queue) & Supabase Realtime
- Sauvegarde instantanée des ventes en cache local en cas de rupture de connexion internet.
- Aucune interruption de caisse lors des coupures réseau.
- Resynchronisation automatique dès le rétablissement de la connexion.
- Canaux WebSockets Supabase Realtime pour la mise à jour immédiate des stocks sur l'ensemble des terminaux connectés.

### 6. Chargement Instantané de la Page d'Accueil & Sécurisation des Routes Privées
- **Suppression du blocage au démarrage :** Écran d'attente retiré sur `/`. La page d'accueil publique s'affiche en 0 ms.
- **Bascule transparente :** Redirection immédiate vers le tableau de bord si une session valide est en mémoire.
- **Contrôle d'accès strict :** Routes protégées (`/pos`, `/products`, `/orders`, `/debts`, `/analytics`, etc.) inaccessibles sans authentification valide.

### 7. Passerelle de Paiement Moneriz (Mobile Money & Cartes)
- **Intégration officielle Moneriz :** Encaisser les abonnements SaaS en Franc CFA (**XOF**).
- **Moyens de paiement :** T-Money Togo, Moov Money, Wave, Orange Money, MTN, Cartes Visa / Mastercard.
- **Parcours Liveframe (iframe sécurisée) :** Intégration responsive via le protocole `postMessage` v1.
- **Signature HMAC-SHA256 stricte :** Comparaison en temps constant (`crypto.timingSafeEqual`) sur le corps brut (`rawBody`) avec fenêtre anti-rejeu de 5 minutes (`src/lib/server/moneriz-signature.ts`).
- **Idempotence & Inbox dédoublonnée :** Protection contre les doublons sur `event.id` et activation atomique de l'abonnement lors de `payment.succeeded`.
- **Routes API Next.js :**
  - `POST /api/checkout` : Création de la session de paiement avec Idempotency-Key.
  - `POST /api/webhooks/moneriz` : Réception et vérification des notifications signées.
  - `POST /api/subscription/order` : Initialisation sécurisée d'une commande d'abonnement.
  - `GET /api/subscription/status` : Suivi temps réel du statut d'abonnement.

### 8. Sécurisation RLS & Isolation Stricte des Coûts (`product_costs`)
- **Découplage étanche :** Prix d'achat (`cost`) extrait de `products` vers `product_costs`.
- **RLS stricte :** Seul l'administrateur de la boutique possède les droits de lecture et écriture sur `product_costs`.
- **Requêtes caissiers sanctuarisées :** Colonnes autorisées sélectionnées explicitement ; aucun accès possible aux marges ou coûts.
- **Protection des privilèges :** Interdiction stricte pour un utilisateur de modifier son rôle ou ses accès sur `store_members`.

### 9. Filtre Temporel Intelligent & Calendrier Personnalisé (`DatePeriodFilter`)
- Préservation des raccourcis 1 clic : `Aujourd'hui`, `Cette Semaine`, `Ce Mois-ci`, `Tout l'historique`.
- **Mode Jour précis :** Raccourcis `Hier`, `Avant-hier`, `Il y a 3/4/7 jours` et sélecteur de date calendrier.
- **Mode Plage de dates :** Raccourcis `7`, `14`, `30 derniers jours`, `Mois précédent` et sélecteurs Du... Au...
- Recalcul dynamique immédiat des indicateurs financiers et des transactions.

### 10. Architecture Multi-Boutiques & Isolation Étanche (Desktop & Mobile)
- **Harmonisation Mobile & Ordinateur :**
  - Synchronisation synchrone et immédiate dans `localStorage` des clés `activeStoreId` et `activeStoreObj` lors de la sélection d'une boutique dans `Sidebar.tsx` et `AuthContext.tsx`.
  - Résolution du décalage d'affichage : le nom réel de la boutique sélectionnée s'affiche dynamiquement au niveau du logo de la barre latérale sur ordinateur comme sur mobile (au lieu d'un intitulé générique fixe).
- **Élimination des fuites de données inter-boutiques :**
  - Suppression complète du fallback vers le cache global non cloisonné `boutiquepro-state`.
  - Partitionnement strict de l'état par boutique : `boutiquepro-state-[storeId]`.
  - Filtrage explicite de la table `inventory_sessions` par `store_id` (`.eq('store_id', activeStore.id)`) pour une étanchéité absolue de l'inventaire physique.
  - Cloisonnement individuel du panier de caisse par boutique (`boutiquepro-cart-[storeId]`).

### 11. Identité Opérateur sur les Factures, Reçus et Documents Commerciaux
- **Nom officiel garanti :**
  - Résolution de l'affichage du fragment d'adresse email sur les reçus thermiques, factures PDF et quittances de dettes.
  - Le système utilise désormais prioritairement le nom complet enregistré dans le profil (`profile.full_name`) ou dans les paramètres de caisse/boutique (`settings.cashier_name`).
- **Synchronisation Paramètres & Profil :**
  - La mise à jour des coordonnées gérant/caissier dans la page Paramètres (`/settings`) répercute immédiatement l'identité sur tous les documents émis.

### 12. Bilan de l'Audit de Sécurité SaaS Pré-Lancement (20 Contrôles Validés)
Un audit complet et rigoureux a été exécuté sur l'ensemble de l'application selon les 20 contrôles critiques de référence SaaS :

#### Synthèse des Gravités :
| Niveau de Gravité | Nombre | Statut | Détails |
|---|---|---|---|
| 🔴 **Bloquant (Critique)** | **0** | ✅ Conforme | Aucun secret exposé, RLS active, API protégées |
| 🟠 **Important (Moyen)** | **0** | ✅ Corrigé | API `/api/subscription/order` verrouillée en JWT + RBAC Admin, Import Excel immunisé contre les DoS |
| 🟡 **Durcissement (Faible)** | **0 résiduel critique** | ✅ Implémenté | Rate Limiter actif sur les API, Anti-bot Cloudflare Turnstile + Honeypot en place sur l'inscription |

#### Mesures de Durcissement Appliquées :
1. **Protection Serveur de l'API de Commande d'Abonnement (`/api/subscription/order`) :**
   - Extraction et validation cryptographique du jeton de session JWT Supabase dans l'en-tête `Authorization`.
   - Renvoi immédiat d'une erreur `HTTP 401 Unauthorized` si le jeton est manquant ou invalide.
   - Vérification côté base de données de l'appartenance de l'utilisateur à la boutique et de son rôle `admin` dans `store_members`.
   - Renvoi immédiat d'une erreur `HTTP 403 Forbidden` si l'utilisateur est un caissier ou n'appartient pas à la boutique.
2. **Durcissement de l'Import Excel (`ProductExcelImportModal.tsx`) :**
   - Contrôle strict des types MIME et extensions de fichiers autorisées (`.xlsx`, `.xls`, `.csv`).
   - Limitation stricte de la taille du fichier téléversé à 5 Mo.
   - Plafond d'analyse à 5 000 lignes pour éliminer tout risque de dépassement mémoire ou d'attaque ReDoS sur le navigateur.
3. **Étanchéité RLS Supabase validée par tests d'intrusion externes :**
   - Tests HTTP `curl` anonymes directs sur l'API Supabase (`https://cfxdmhkxwuityjskkkkd.supabase.co/rest/v1/`) :
     - Table `product_costs` : `HTTP 401 Unauthorized` (aucun accès anonyme possible).
     - Tables `products`, `sales`, `customers`, `settings`, `cash_sessions` : `[]` (tableau vide retourné, 0 fuite de données).
4. **Sanctuarisation des Clés Secrètes :**
   - Analyse automatisée des bundles compilés `.next/static/` : aucune clé secrète (`SUPABASE_SERVICE_ROLE_KEY`, `MONERIZ_SECRET_KEY`) n'est embarquée dans le code distribué aux navigateurs.
5. **En-têtes HTTP de Sécurité :**
   - Configuration active dans `next.config.mjs` et appliquée par Vercel : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Referrer-Policy: strict-origin-when-cross-origin`.

### 13. Système Multi-Unités & Approvisionnement Séquentiel en 3 Temps (Gros & Détail)
- **Séquence chronologique rigoureuse d'approvisionnement :**
  - **Étape 1 (Stock avant achat)** : Affichage automatique du stock restant en boutique avant toute nouvelle saisie (ex: 10 cartons de 24 + 10 pièces).
  - **Étape 2 (Nouvel arrivage)** : Saisie transparente de la quantité achetée en cartons entiers (ou bidons/sacs) et des pièces supplémentaires détachées.
  - **Étape 3 (Stock global disponible)** : Calcul instantané et réactif du total physique post-achat ($Stock = Stock_{existant} + (Cartons \times Contenance) + Pièces$).
- **Généralisation Gros et Pièces :** Le même flux séquentiel en 3 temps s'applique à la fois aux achats en gros et aux achats directs à la pièce/unité.
- **Calcul automatique du Coût de Revient Unitaire :** Déduction mathématique instantanée du coût unitaire de la pièce à partir du prix d'achat du carton ($Coût\ unitaire = Prix\ carton / Contenance$) sans risque d'erreur humaine.
- **Seuil d'alerte en cartons / colis :** Paramétrage du seuil de réapprovisionnement directement exprimé en nombre de cartons (avec conversion automatique en unités de base physiques pour les déclenchements d'alertes).
- **Tarification libre :** Indépendance totale entre le prix de vente carton et le prix de vente à la pièce.

### 14. Refonte Ergonomique du Panier de Caisse (POS 2 Lignes Anti-Chevauchement)
- **Architecture de carte à 2 niveaux verticaux :**
  - **Ligne 1 (Entête)** : Avatar du produit + Nom de l'article à gauche, Prix total de la ligne en grand et bouton de suppression (poubelle) à droite.
  - **Ligne 2 (Contrôles)** : Menu déroulant de sélection du format (*Carton* ou *Détail*) à largeur contrôlée à gauche, touches de réglage de quantité `[ — ] [ Qté ] [ + ]` et bascule `Montant` à droite.
- **Élimination définitive des chevauchements :** Espace dédié pour chaque élément interactif, prévenant toute collision même avec des intitulés longs (*Unité de base (1 000 000 FCFA)*).
- **Résolution tolérante des formats de vente :** Acceptation sans blocage des libellés de détail (`Unité`, `Pièce`, `Pièce / Unité`, `Litre`, etc.) côté frontend et serveur SQL.

### 15. Sécurisation & Synchronisation Universelle des Abonnements SaaS
- **Synchronisation automatique Compte & Boutiques :** Liaison directe de la période payée de l'administrateur (`admin_subscriptions`) avec l'ensemble de ses boutiques et caisses.
- **Héritage à la création (`create_new_store`) :** Toute nouvelle boutique créée par un utilisateur possédant un abonnement payant actif hérite automatiquement de sa formule et de son échéance au lieu de basculer sur un essai temporaire.
- **Fonction PostgreSQL universelle (`is_store_subscription_active`) :** Contrôle dynamique en temps réel évitant tout blocage intempestif des ventes pour les commerçants abonnés et leurs caissiers.
- **Intercepteur d'erreurs sécurisé (`isSubscriptionExpiredError`) :** Suppression du faux positif sur le code PostgreSQL générique `P0001` ; seuls les véritables blocages de souscription affichent le message d'abonnement expiré.

### 16. Piliers SaaS Avancés & Infrastructure de Production

#### 1. Authentification Google OAuth & Protection Anti-CSRF
- **Bouton officiel Google en 1 clic :** Intégré dans `src/components/auth/Login.tsx` via l'appel `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })`.
- **Écran de consentement Google Cloud Platform :** Configuré sous l'ID client officiel avec les URI de redirection autorisées pour `https://maboutiquepro.app` et le callback d'authentification Supabase.
- **Middleware Anti-CSRF (`src/middleware.ts`) :**
  - Inspection automatique des méthodes mutantes (`POST`, `PUT`, `DELETE`, `PATCH`).
  - Validation croisée des en-têtes `Origin` et `Host` pour bloquer toute falsification de requête inter-sites.
  - **Exemption sécurisée :** Les webhooks externes Moneriz (`/api/webhooks/moneriz`) sont explicitement exemptés du contrôle d'origine car ils sont authentifiés par signature cryptographique HMAC-SHA256.
  - Injection automatique des en-têtes de durcissement HTTP (`X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`).

#### 2. Stockage Cloudflare R2 & Validation Binaire Magic Bytes
- **Client pur Node.js SigV4 (`src/lib/server/r2-storage.ts`) :** Implémentation native de la signature AWS SigV4 sans dépendance vers le SDK AWS lourd, réduisant considérablement la taille du bundle Vercel Serverless.
- **Isolation stricte par boutique :** Tous les médias (logos, images de produits) sont stockés sous la clé `stores/[storeId]/[timestamp]-[filename]`.
- **Validation Binaire Magic Bytes (`validateMagicBytes`) :** Contrôle rigoureux des premiers octets du flux binaire pour valider l'intégrité réelle du fichier avant tout enregistrement :
  - **JPEG :** `FF D8 FF`
  - **PNG :** `89 50 4E 47`
  - **WEBP :** `52 49 46 46` ... `57 45 42 50`
  - **GIF :** `47 49 46 38`
  - **PDF :** `25 50 44 46`
  - *Tout fichier exécutable (`.exe`, `.sh`, `.php`, `.js`) camouflé avec une fausse extension est immédiatement rejeté avec une erreur HTTP 400.*
- **Endpoint Sécurisé (`/api/upload`) :** Limité à 5 Mo par téléversement, réservé aux utilisateurs authentifiés.

#### 3. Moteur d'Emails Transactionnels Resend & Modèle Outbox
- **Patron de Conception Transactional Outbox (`email_outbox`) :**
  - Chaque notification par e-mail est d'abord insérée dans la table `email_outbox` de PostgreSQL avec le statut `pending`. Cela garantit le principe **Zero Data Loss** : aucun email ne peut être perdu en cas de panne temporaire du réseau ou du fournisseur de messagerie.
  - **Expédition asynchrone instantanée (`dispatchOutboxImmediate`) :** Dès l'insertion en base, une tentative d'expédition HTTP vers l'API Resend est déclenchée sans bloquer le thread principal utilisateur. En cas de succès, la ligne passe en `sent` avec son `resend_id`. En cas d'indisponibilité, elle reste en `pending` pour reprise automatique.
- **Templates d'Emails HTML Professionnels (`src/lib/server/email-templates.ts`) :**
  - **Confirmation d'Abonnement (`buildSubscriptionSuccessEmail`) :** Reçu officiel avec badge de paiement vert, intitulé de la formule (Pro / Business), durée, montant en FCFA, date d'échéance et bouton d'accès au tableau de bord.
  - **Alerte d'Échéance J-3 (`buildSubscriptionExpiringEmail`) :** Email préventif envoyé 3 jours avant la fin d'un abonnement ou de la période d'essai, valorisant la continuité de service des caisses et fournissant un lien direct de renouvellement.
  - **Annonce de Mise à Jour de l'Application (`buildAppUpdateEmail`) :** Template de diffusion collective aux commerçants pour présenter les nouveautés, améliorations de performances et fonctionnalités ajoutées.

#### 4. Tâches Planifiées (Vercel Crons) & Protection par CRON_SECRET
- **Contrôle d'accès strict (`src/lib/server/cron-auth.ts`) :** Tous les endpoints `/api/cron/*` vérifient la présence de l'en-tête `Authorization: Bearer <CRON_SECRET>` et rejettent immédiatement les appels non autorisés (`HTTP 401`).
- **5 Tâches d'Arrière-Plan Prêtes à l'Emploi :**
  - `/api/cron/process-outbox` : Dépile et réémet les emails en attente ou échoués avec incrément des tentatives.
  - `/api/cron/subscription-check` : Détecte automatiquement les abonnements et périodes d'essai arrivant à expiration dans 3 jours et planifie l'email d'alerte.
  - `/api/cron/expiry-alerts` : Détecte les stocks de produits approchant de leur date limite d'utilisation optimale (FEFO < 30 jours).
  - `/api/cron/debt-reminders` : Établit la liste hebdomadaire des créances clients en souffrance.
  - `/api/cron/daily-metrics` : Calcule et consolide nocturnement les chiffres d'affaires, marges et dépenses par boutique.
- **Optimisation pour le Plan Vercel Hobby :** Le forfait gratuit Vercel n'autorisant qu'un seul déclenchement de cron par jour au maximum (`0 3 * * *`), le fichier `vercel.json` a été paramétré sur une exécution nocturne quotidienne à 03h00 UTC, tandis que l'envoi des emails transactionnels s'effectue en temps réel dès leur mise en boîte outbox.

#### 5. Journal d'Audit Immuable (`audit_logs`)
- Module serveur `src/lib/server/audit-logger.ts` traçant l'ensemble des opérations d'administration sensibles (création de boutique, attribution de rôles, remboursements, résiliations, mises à jour critiques).
- **Immuabilité garantie par la base de données :** Les permissions `UPDATE` et `DELETE` sur `audit_logs` sont révoquées pour les rôles `authenticated` et `anon`. L'historique d'audit est ainsi inaltérable et constitue une preuve légale et comptable infalsifiable.

#### 6. Observabilité Native Sentry
- Client Sentry léger `src/lib/sentry.ts` utilisant directement l'API Store v7 sans dépendances npm volumineuses.
- Câblé dans `src/app/global-error.tsx` et `src/app/error.tsx` pour capturer et transmettre immédiatement les erreurs d'exécution inattendues avec contexte d'environnement.

#### 7. Système de Diffusion Collective des Mises à Jour (`/api/admin/broadcast-update`)
- Route d'administration sécurisée permettant d'envoyer un email d'annonce officiel à tous les propriétaires de boutiques enregistrés dans l'application.
- Extraction des gérants uniques depuis `stores` et `profiles`, personnalisation de l'email et mise en outbox automatique.

### 17. Refonte Visuelle « Dark Cosmic » (Style Nexora), Identité & Conformité Google

#### 1. Nouvelle Landing Page Sombre « Dark Cosmic » (`src/components/marketing/LandingPage.tsx`)
- **Esthétique Nexora adaptée au commerce africain :** Fond profond `#060517` traversé par des faisceaux lumineux néon (bleu électrique, indigo, violet et magenta) et cartes en verre dépoli (*glassmorphism*).
- **Maquette visuelle interactive du Tableau de Bord + 3 Cartes Flottantes :**
  - **Au centre :** Aperçu sombre du tableau de bord MaBoutiquePro avec barre latérale complète, message d'accueil *« Bonjour, Gérant 👋 »*, graphique en barres verticales dégradées des ventes de la semaine (Lun à Dim) et 3 cartes KPI (*Chiffre d'Affaires*, *Ventes Encaissées*, *Bénéfice Net Réel*).
  - **Autour du dashboard :** 3 cartes flottantes inclinées avec mini-courbes SVG (*CA du Jour en FCFA*, *Articles en Stock*, *Recouvrement Dettes via WhatsApp*).
- **Migration 100 % SVG (`lucide-react`) :** Élimination intégrale des polices d'icônes externes Google Material Symbols pour empêcher tout affichage de texte brut parasite (`arrow_forward`) sur les boutons CTA.

#### 2. Nouveau Logo Officiel MaBoutiquePro (`public/logo.png`)
- Intégration du nouveau logo officiel **Maboutiquepro** (*« Gérez votre boutique. Gagnez plus. »*) sur l'ensemble de l'application (Landing Page, Dashboard, Connexion, Favicon, PWA `manifest.json`).

#### 3. Authentification Directe Google Identity Services & Publication Google Cloud
- **SDK Google Identity Services (`signInWithIdToken`) :** Intégration directe du script `https://accounts.google.com/gsi/client` et de la clé publique `NEXT_PUBLIC_GOOGLE_CLIENT_ID` dans `Login.tsx` pour authentifier les commerçants directement sous l'identité de **`maboutiquepro.app`**.
- **Propriété du domaine certifiée (Google Search Console) :** Balise `google-site-verification` intégrée dans `src/app/layout.tsx` et validée sur Google Search Console.
- **Pages Juridiques Officielles & Publication OAuth :**
  - **`https://maboutiquepro.app/privacy` (`src/app/privacy/page.tsx`) :** Règles de confidentialité complètes conformes à la *Google API Services User Data Policy* (clause *Limited Use* et droit à l'effacement).
  - **`https://maboutiquepro.app/terms` (`src/app/terms/page.tsx`) :** Conditions Générales d'Utilisation (CGU) du SaaS.
  - Écran de consentement Google OAuth officiellement publié et validé en production.

---

## 💼 Modèles d'Exploitation Commerciale

1. **SaaS B2B par Abonnement sur `maboutiquepro.app` (Principal) :**
   - Inscription libre des commerçants avec période d'essai gratuit.
   - Forfaits mensuels ou annuels (ex: **5 000 à 15 000 FCFA / mois**) payables par Mobile Money (Wave, TMoney, Flooz, MTN Moov, Orange Money) via Moneriz.
   - Maintenance et améliorations centralisées sur le cloud.

2. **Déploiement Dédié / Marque Blanche :**
   - Vente clé en main pour grandes surfaces, grossistes ou pharmacies avec domaine sur mesure et branding personnalisé.
   - Facturation forfaitaire (**200 000 à 600 000 FCFA**) + contrat d'assistance annuel.

---

## 📁 Principaux Fichiers et Composants

| Fichier / Dossier | Rôle principal |
|---|---|
| `src/middleware.ts` | Protection Anti-CSRF sur les routes mutantes, exclusion HMAC Moneriz et headers de sécurité |
| `src/components/marketing/LandingPage.tsx` | Landing Page « Dark Cosmic » style Nexora avec maquette Dashboard, cartes flottantes et icônes SVG |
| `src/components/auth/Login.tsx` | Connexion classique, Google Identity Services (`signInWithIdToken`), OAuth 2.0 et mot de passe oublié |
| `src/app/privacy/page.tsx` | Page publique des Règles de Confidentialité conforme à la politique Google User Data |
| `src/app/terms/page.tsx` | Page publique des Conditions Générales d'Utilisation (CGU) |
| `public/logo.png` | Nouveau logo officiel Maboutiquepro (« Gérez votre boutique. Gagnez plus. ») |
| `src/app/products/page.tsx` | Gestion du catalogue, filtres, stock bas, bouton « Importer Excel » et export |
| `src/components/products/ProductExcelImportModal.tsx` | Modal d'importation Excel/CSV durcie (5 Mo, 5 000 lignes max, extensions validées) |
| `src/components/layout/Sidebar.tsx` | Barre latérale avec sélecteur multi-boutiques synchrone et affichage dynamique du logo |
| `src/context/AuthContext.tsx` | Authentification Supabase, sessions, profils et gestion du rôle multi-tenancy |
| `src/context/StoreContext.tsx` | État réactif par boutique (`boutiquepro-state-[id]`), calculs anti-NaN et requêtes RLS |
| `src/app/reset-password/page.tsx` | Page de réinitialisation sécurisée du mot de passe |
| `src/app/debts/page.tsx` | Carnet de crédits, historique des versements, quittances PDF et relances WhatsApp Togo |
| `src/components/pos/CashRegisterSessionModal.tsx` | Gestion des ouvertures et clôtures de caisse (Rapports X et Z) |
| `src/components/ui/DatePeriodFilter.tsx` | Sélecteur temporel intelligent (presets, raccourcis jour précis & plage calendrier) |
| `src/components/layout/AppWrapper.tsx` | Routage, protection d'accès selon les rôles et exception pour `/reset-password` |
| `src/lib/pdf.ts` | Moteur d'export PDF haute fidélité pour factures et quittances avec nom complet de l'opérateur |
| `src/lib/accountingExport.ts` | Générateur universel des exports comptables Excel et CSV |
| `src/lib/sentry.ts` | Client Sentry natif Store API v7 pour la capture des exceptions et observabilité |
| `src/lib/server/r2-storage.ts` | Client Cloudflare R2 pur Node.js SigV4 et validation binaire des Magic Bytes |
| `src/app/api/upload/route.ts` | Route de téléversement sécurisée (5 Mo max, Magic Bytes, isolation par boutique) |
| `src/lib/server/email-outbox.ts` | Moteur transactionnel outbox pour l'envoi fiable d'emails via Resend |
| `src/lib/server/email-templates.ts` | Modèles HTML responsives (Reçu d'abonnement, Alerte échéance J-3, Annonce de mise à jour) |
| `src/lib/server/audit-logger.ts` | Journalisation des actions d'administration dans la table immuable `audit_logs` |
| `src/lib/server/cron-auth.ts` | Vérificateur d'autorisation `CRON_SECRET` pour les tâches planifiées |
| `src/app/api/cron/process-outbox/route.ts` | Cron de dépilage et réémission des emails transactionnels |
| `src/app/api/cron/subscription-check/route.ts` | Cron de détection des abonnements expirant dans 3 jours et alerte email |
| `src/app/api/cron/expiry-alerts/route.ts` | Cron de détection des dates de péremption des produits (FEFO < 30 jours) |
| `src/app/api/cron/debt-reminders/route.ts` | Cron de récapitulatif des créances et impayés clients |
| `src/app/api/cron/daily-metrics/route.ts` | Cron nocturne de consolidation quotidienne des métriques SaaS |
| `src/app/api/admin/broadcast-update/route.ts` | Route d'administration pour diffuser une annonce de mise à jour par email à tous les gérants |
| `src/lib/server/moneriz-signature.ts` | Vérificateur HMAC-SHA256 temps constant des signatures webhook Moneriz |
| `src/lib/server/moneriz-checkout.ts` | Client serveur pour l'API Checkout Sessions de Moneriz (v1) |
| `src/lib/server/moneriz-app.ts` | Gestion des commandes d'abonnement, idempotence, inbox dédoublonnée et envoi d'email de confirmation |
| `src/app/api/checkout/route.ts` | Route API POST pour initier une session de paiement Moneriz |
| `src/app/api/webhooks/moneriz/route.ts` | Route API POST publique pour la réception des webhooks signés |
| `src/app/api/subscription/order/route.ts` | Route API POST protégée (vérification JWT + RBAC admin) pour créer une commande d'abonnement |
| `src/app/api/subscription/status/route.ts` | Route API GET de vérification du statut d'abonnement d'une boutique |
| `src/components/subscription/MonerizCheckoutModal.tsx` | Composant React Liveframe (iframe) avec gestion du protocole postMessage v1 |
| `src/components/subscription/SubscriptionModal.tsx` | Modal de sélection d'abonnement (Pro, Business, Mensuel, Annuel) |
| `migration_email_outbox.sql` | Migration SQL Supabase pour la table transactionnelle `email_outbox` |
| `migration_audit_logs.sql` | Migration SQL Supabase pour `audit_logs` (immuable) et `daily_metrics` |
| `saas_moneriz_integration.sql` | Migration SQL Supabase pour les commandes et événements Moneriz |
| `saas_subscription_permanent_fix.sql` | Migration SQL universelle de synchronisation des abonnements et héritage des boutiques |
| `fix_create_sale_unit_name.sql` | Mise à jour de la RPC create_sale pour la résolution tolérante des formats gros/détail |
| `vercel.json` | Configuration Vercel avec cron journalier compatible avec le forfait Hobby |
