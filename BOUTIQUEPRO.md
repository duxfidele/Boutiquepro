# MaBoutiquePro - Documentation Complète & Référence Technique

## 📋 Présentation Générale
**MaBoutiquePro** est une application web moderne conçue pour la gestion commerciale et le point de vente (POS) adaptée aux réalités du marché africain (monnaie FCFA, Mobile Money, relances WhatsApp, utilisation mobile & tablette).

Elle permet à de multiples commerçants de gérer leurs boutiques, leurs stocks, leurs ventes au comptant ou à crédit, et leurs employés depuis une interface unique, moderne et ultra-rapide. L'application est installable (PWA) et déployée sous le domaine officiel **[maboutiquepro.app](https://maboutiquepro.app)**.

---

## 🛠️ Stack Technique
- **Frontend :** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React (Icônes), `@base-ui/react`.
- **Backend & Base de données :** Supabase (PostgreSQL, Authentification, Row Level Security, Triggers & Fonctions RPC en PL/pgSQL).
- **Format monétaire :** Franc CFA (XOF/XAF - FCFA) avec gestion anti-NaN garantie sur tous les calculs.
- **Domaine officiel :** `https://maboutiquepro.app` (associé à Vercel & Supabase Auth).
- **Import / Export Tableurs :** Bibliothèque `xlsx` pour l'import de catalogue et l'export d'inventaire/analytique.
- **PWA :** `@ducanh2912/next-pwa` (Mise en cache locale, mode installable sur écran d'accueil smartphone/tablette).
- **Impression & Documents :** Impression thermique directe (80mm/58mm via CSS `@media print`), factures et quittances PDF (`jspdf`, `html2canvas`, `jspdf-autotable`).
- **Messagerie & Relances :** Intégration WhatsApp Business / Web avec indicatif international Togo (+228 / 00228) et formatage automatique des téléphones à 8 chiffres.
- **Gestionnaire de versions :** Git & GitHub (Dépôt : `https://github.com/duxfidele/Boutiquepro.git`).

---

## 🔐 Architecture SaaS Multi-Tenant & Sécurité
L'application fonctionne selon le modèle **SaaS Multi-Tenant**. Chaque commerçant peut posséder une ou plusieurs boutiques distinctes.

Les données sont strictement cloisonnées grâce aux **Row Level Security (RLS)** de PostgreSQL :
- Chaque requête vérifie que l'utilisateur connecté appartient bien à l'équipe de la boutique (`store_id`) avant de renvoyer la moindre donnée.
- Un caissier ou un propriétaire d'une boutique A ne peut **jamais** lire ni manipuler les données d'une boutique B.

### Tables clés (cloisonnées par `store_id`) :
- `stores` : Boutiques créées (`id`, `name`, `owner_id`, `created_at`).
- `store_members` : Liaison entre les utilisateurs (`user_id`), la boutique (`store_id`) et leur rôle (`role` : admin / cashier).
- `profiles` : Profils publics (nom, email, téléphone, rôle par défaut).
- `products` & `categories` : Catalogue des articles (nom, SKU/code-barres, prix de vente, prix d'achat, stock, stock minimum, image/emoji).
- `sales` & `sale_items` : Historique des ventes comptant et à crédit (`payment_method`, `payment_status`, `amount_paid`, `remaining_amount`, `due_date`).
- `debt_payments` (ou journal de recouvrement) : Historique des remboursements partiels ou totaux des créances (`sale_id`, `amount`, `payment_method`, `paid_at`, `cashier_name`).
- `customers` : Base clients (nom, téléphone, total des achats, solde débiteur).
- `cash_sessions` : Sessions et clôtures de caisse (fonds de caisse initial, ventes encaissées, écarts réels, rapports X & Z).
- `expenses` : Charges opérationnelles (loyer, salaires, factures).
- `orders` & `order_items` : Commandes et réapprovisionnements fournisseurs.
- `inventory_sessions` & `inventory_items` : Sessions d'inventaire physique et régularisation des écarts.
- `settings` : Paramètres personnalisés de chaque boutique (nom, logo, devise, TVA, ville, pays, téléphone, email).

---

## 👥 Rôles et Permissions (RBAC)

### 1. Administrateur / Gérant (`admin`)
- **Multi-Boutiques :** Création de nouvelles boutiques (`+ Créer une boutique`) et bascule instantanée d'un établissement à un autre.
- **Accès complet :**
  - Tableau de bord global (CA Réalisé, CA Encaissé, Dettes en attente, Bénéfice Net, Total des Dépenses, Alertes de stock).
  - Gestion du catalogue : Création manuelle ou **Importation massive par fichier Excel/CSV** avec détection de doublons.
  - Carnet de crédits & recouvrement (`/debts`) : Suivi des impayés, enregistrement des versements, émission des quittances et relances WhatsApp.
  - Inventaire physique, Dépenses, Analytique complète, Commandes fournisseurs, Paramètres.
- **Gestion d'Équipe (`/team`) :**
  - Création directe de comptes caissiers avec email et mot de passe immédiats (via RPC `admin_create_cashier`).
  - Affectation et révocation d'accès en 1 clic.

### 2. Caissier (`cashier`)
- **Tableau de bord personnel (`/`) :**
  - Consulter uniquement ses propres performances de shift (son CA du jour, ses encaissements, son nombre de tickets).
  - **Confidentialité totale du patron :** Les prix d'achat (`cost`), les marges bénéficiaires, le bénéfice net de la boutique, les dépenses et les ventes des collègues sont masqués.
- **Point de Vente (POS) & Caisse :**
  - Vente au comptant (Espèces, Mobile Money, Carte) et vente à crédit avec acompte et date d'échéance.
  - Gestion du tiroir-caisse : Ouverture avec fond initial, point d'étape (Rapport X), clôture journalière et Rapport Z avec détection d'écarts.
- **Accès restreint & Sécurisé :**
  - Redirection automatique si tentative d'accès à `/analytics`, `/expenses`, `/team`, `/settings` ou `/orders`.
  - Pas de modification possible du catalogue ni de suppression d'articles.

---

## 💡 Modules Clés & Fonctionnalités Récentes

### 1. Importation de Produits via Fichier Excel / CSV (`/products`)
- **Bouton vert émeraude « Importer Excel »** placé en tête de page (et bouton d'invitation au centre si le catalogue est vide).
- **Téléchargement d'un Modèle Excel** (`modele_import_produits_boutiquepro.xlsx`) configuré avec les colonnes recommandées (*Nom, Catégorie, Code-barres, Prix de vente, Prix d'achat, Quantité en stock, Stock minimum*).
- **Algorithme d'analyse intelligent et tolérant** :
  - Détection automatique des colonnes même avec des intitulés variés (*Produit, Désignation, Libellé, PV, PA, Qté, etc.*).
  - Nettoyage automatique des montants (anti-NaN garanti).
  - Génération automatique de code SKU s'il est omis.
  - Détection de la catégorie ou création automatique des nouvelles catégories.
  - Attribution d'un emoji/icône adapté selon la dénomination de l'article.
- **Tableau de prévisualisation avant validation** :
  - Statistiques immédiates : nombre de nouveaux articles, articles existants, valeur globale du stock importé.
  - Gestion des doublons : option de mettre à jour le produit existant (en remplaçant le stock ou en l'additionnant) ou d'ignorer les doublons.
- **Enregistrement en masse ultra-rapide (`BATCH_ADD_PRODUCTS`)** :
  - Insertion / mise à jour par lot dans Supabase via `upsert` pour injecter des centaines de produits en quelques secondes.

### 2. Nom de Domaine Personnalisé & Récupération de Mot de Passe
- **Domaine officiel connecté :** `https://maboutiquepro.app`.
- **Lien « Mot de passe oublié ? »** directement intégré dans la fenêtre de connexion (`Login.tsx`).
- Envoi d'un e-mail contenant le lien de réinitialisation sécurisé via `supabase.auth.resetPasswordForEmail` ciblant `https://maboutiquepro.app/reset-password`.
- **Page dédiée `/reset-password`** :
  - Détection automatique des tokens de récupération (aussi bien les liens directs que les flux PKCE `?code=...`).
  - Saisie et confirmation du nouveau mot de passe avec bouton pour afficher/masquer les caractères.
  - Mise à jour sécurisée dans Supabase via `supabase.auth.updateUser`.
  - Redirection automatique vers le tableau de bord une fois validé.
- **Contournement dans `AppWrapper.tsx`** :
  - L'accès à `/reset-password` est garanti sans être bloqué par la page de garde ou les restrictions caissiers.

### 3. Carnet de Crédits & Recouvrement (`/debts` et Point de Vente)
- **Vente à crédit intégrée au panier :**
  - Choix du mode de paiement « À crédit » avec saisie de l'acompte initial, sélection du client et date d'échéance.
- **Journal et suivi des créances :**
  - Statuts dynamiques : *Non payé*, *Partiel*, *Soldé*, *En retard*.
  - Enregistrement des paiements échelonnés avec sélection du moyen de versement (Espèces, Mobile Money, Carte) et traçabilité du caissier.
- **Quittance de recouvrement certifiée :**
  - Ticket thermique et téléchargement PDF officiel récapitulant la dette initiale, les versements antérieurs, le versement du jour et le reste dû.
- **Relances WhatsApp Togo (+228) :**
  - Boutons de relance et d'envoi de quittance avec message pré-formaté et redirection automatique vers WhatsApp.
  - Détection automatique et conversion des numéros de téléphone togolais à 8 chiffres vers l'indicatif international standardisé `+228`.
- **Indicateurs financiers réconciliés :**
  - CA théorique vs CA encaissé réel, taux de recouvrement, montant total des dettes en cours et bénéfice net encaissé.

### 4. Clôture de Caisse Journalière & Réconciliation des Espèces (Rapports X & Z)
- **Bandeau dynamique en temps réel :** État d'ouverture de caisse, nom de l'opérateur, fond de caisse initial et espèces théoriques attendues dans le tiroir.
- **Réconciliation intégrale des flux d'espèces :**
  - **Ventes au comptant (Espèces) :** Additionnées à 100% au tiroir.
  - **Acomptes initiaux sur ventes à crédit (`creditDeposits`) :** L'acompte physique versé au moment de la vente entre directement dans le tiroir de la session.
  - **Remboursements et recouvrements de dettes (`debtRecoveries`) :** Tout règlement de dette perçu en espèces durant le shift est intégré à la caisse du jour.
  - **Dédoublonnage comptable infaillible (`getInitialCreditDeposit`) :** Lorsqu'un client solde sa dette plus tard dans la journée, le système sépare l'acompte d'origine du recouvrement ultérieur, éliminant tout risque de double comptage.
  - **Protection du Chiffre d'Affaires :** Le recouvrement d'une créance n'augmente pas artificiellement le CA facturé (qui reste celui de la vente).
- **Point d'étape provisoire (Rapport X) :** Consultation à tout moment du shift des recettes détaillées par mode de paiement et du contrôle théorique du tiroir.
- **Modal de clôture certifiée (Rapport Z) :**
  - Décomposition détaillée : Fond initial + Ventes espèces + Acomptes crédits + Recouvrements dettes - Monnaie.
  - Comptage physique des billets et pièces avec calcul immédiat de l'écart de caisse (Conforme, Manquant/Déficit, ou Excédent).
- **Impression thermique 80mm/58mm & PDF certifié :** Ticket officiel certifié avec visas du caissier et du gérant pour la traçabilité comptable.
- **Historique Z complet :** Consultation et réimpression des clôtures passées à tout moment.

### 5. Mode Hors-Ligne (Offline Queue) & Supabase Realtime
- Sauvegarde instantanée des ventes en cache local (LocalStorage / IndexedDB) en cas d'interruption du réseau internet.
- Aucune interruption de caisse lors des coupures de connexion.
- Resynchronisation automatique dès le rétablissement de la connexion.
- Canaux WebSockets Supabase Realtime pour la décrémentation instantanée du stock sur tous les terminaux de caisse connectés.

### 6. Chargement Instantané de la Page d'Accueil & Sécurisation des Routes Privées
- **Suppression du blocage au démarrage :** L'écran d'attente « Vérification de l'accès... » a été totalement retiré de la page publique (`/`). La page d'accueil (Landing Page) s'affiche désormais instantanément (0 ms d'attente réseau pour les visiteurs).
- **Vérification optimisée en arrière-plan :** Si un utilisateur possède une session active en mémoire locale (`localStorage`), il est automatiquement basculé vers son tableau de bord sans flash ni friction.
- **Contrôle d'accès strict sur les routes privées :** Les routes protégées (`/pos`, `/products`, `/orders`, `/debts`, `/analytics`, etc.) conservent une vérification d'authentification stricte avant tout affichage de données sensibles. En cas de session absente, l'utilisateur est automatiquement redirigé vers l'interface de connexion.

---


### 7. Intégration de la Passerelle de Paiement Moneriz (Mobile Money & Cartes)
- **Passerelle de paiement SaaS :** Intégration officielle de **Moneriz** selon les spécifications d'octobre 2026 pour encaisser les abonnements en **FCFA (XOF)**.
- **Moyens de paiement acceptés :** Mobile Money (T-Money Togo, Moov Money, Wave, Orange Money, MTN) et Cartes bancaires (Visa, Mastercard via Stripe intégré).
- **Parcours Liveframe (iframe sécurisée) :** Intégration en mode `iframe` responsive via le protocole `postMessage` v1 (`moneriz.ready`, `moneriz.resize`, `moneriz.resume`, `moneriz.payment`).
- **Signature cryptographique stricte :** Vérification HMAC-SHA256 sur le corps brut (`rawBody`) avec comparaison en temps constant (`crypto.timingSafeEqual`) et fenêtre anti-rejeu de 5 minutes (`src/lib/server/moneriz-signature.ts`).
- **Boîte de réception persistante (Inbox dédoublonnée) :** Protection contre les doublons sur `event.id` et activation atomique de l'abonnement après réception de `payment.succeeded` (`src/lib/server/moneriz-app.ts`).
- **Routes API Next.js :**
  - `POST /api/checkout` : Création serveur de la session de paiement avec Idempotency-Key.
  - `POST /api/webhooks/moneriz` : Endpoint webhook public pour recevoir et traiter les notifications signées.
  - `POST /api/subscription/order` : Initialisation d'une commande d'abonnement pour une boutique.
  - `GET /api/subscription/status` : Suivi du statut de la commande en temps réel.
- **Variables d'environnement requises (Serveur uniquement) :**
  - `MONERIZ_SECRET_KEY` : Clé secrète d'API Moneriz (`izp_live_sk_...` ou `izp_test_sk_...`).
  - `MONERIZ_WEBHOOK_SECRET` : Secret webhook de signature Moneriz.
- **Script SQL de migration :** `saas_moneriz_integration.sql` pour configurer les tables de traçabilité et les colonnes d'abonnement dans Supabase.

---

### 8. Sécurisation RLS & Isolation Stricte des Coûts (`product_costs`)
- **Découplage étanche du prix d'achat :**
  - Le coût d'achat (`cost`) a été totalement extrait de la table publique `products` vers une table dédiée `product_costs` (`product_id`, `store_id`, `cost`).
  - **Row Level Security (RLS) stricte :** Seul l'administrateur/gérant de la boutique possède les droits de lecture (`SELECT`) et d'écriture (`INSERT`/`UPDATE`) sur `product_costs`.
  - **Requêtes caissiers sanctuarisées :** Les requêtes des caissiers sélectionnent explicitement les colonnes autorisées (`id, name, sku, category, price, stock, min_stock, image, created_at, user_id, store_id`) sans jamais faire de `SELECT *` ni de jointure sur `product_costs`.
- **Protection des marges et bénéfices :**
  - Les calculs de bénéfice net, de marge commerciale et de valorisation de stock s'exécutent exclusivement côté admin.
  - L'écran du caissier n'affiche ni ne permet la saisie du prix d'achat.
- **Verrouillage des privilèges administrateur :**
  - Neutralisation des failles d'élévation de privilèges sur `store_members` et `stores` : un caissier ne peut en aucun cas modifier son propre rôle ni altérer la configuration d'une boutique.

### 9. Filtre Temporel Intelligent & Calendrier Personnalisé (`DatePeriodFilter`)
- **Intégration universelle :** Disponible sur le Tableau de bord (`/`) et la page Analytique (`/analytics`).
- **Préservation des 4 sélections en 1 clic :**
  - `Aujourd'hui`, `Cette Semaine` (cycle strict du Lundi au Dimanche), `Ce Mois-ci`, `Tout l'historique`.
- **Nouveau sélecteur interactif « 📅 Calendrier / Période » :**
  - **Mode « Jour précis » :**
    - Raccourcis immédiats : `Hier`, `Avant-hier`, `Il y a 3 jours`, `Il y a 4 jours`, `Il y a 7 jours`.
    - Sélecteur de date natif permettant de remonter à n'importe quelle journée historique de la boutique.
  - **Mode « Plage de dates » (Du ... Au ...) :**
    - Raccourcis de plage : `7 derniers jours`, `14 derniers jours`, `30 derniers jours`, `Mois précédent`.
    - Sélecteurs de date de début et de fin.
- **Recalcul dynamique instantané :**
  - Chiffre d'affaires, trésorerie encaissée, bénéfice net réel, écarts de caisse, encaissements de dettes et liste des transactions recalculés spécifiquement pour la journée ou la période sélectionnée.

---

## 💼 Modèles d'Exploitation Commerciale

1. **SaaS B2B par Abonnement sur `maboutiquepro.app` (Principal) :**
   - Inscription libre des commerçants avec période d'essai gratuit.
   - Forfaits mensuels ou annuels (ex: **5 000 à 15 000 FCFA / mois**) payables par Mobile Money (Wave, TMoney, Flooz, MTN Moov, Orange Money).
   - Maintenance et améliorations centralisées sur le cloud.

2. **Déploiement Dédié / Marque Blanche :**
   - Vente clé en main pour grandes surfaces, grossistes ou pharmacies avec domaine sur mesure et branding personnalisé.
   - Facturation forfaitaire (**200 000 à 600 000 FCFA**) + contrat d'assistance annuel.

---

## 📁 Principaux Fichiers et Composants

| Fichier / Dossier | Rôle principal |
|---|---|
| `src/app/products/page.tsx` | Gestion du catalogue, filtres, stock bas, bouton « Importer Excel » et export |
| `src/components/products/ProductExcelImportModal.tsx` | Modal d'importation Excel/CSV, téléchargement modèle, aperçu et validation |
| `src/app/reset-password/page.tsx` | Page de réinitialisation sécurisée du mot de passe |
| `src/components/auth/Login.tsx` | Connexion, inscription et demande de réinitialisation par e-mail |
| `src/app/debts/page.tsx` | Carnet de crédits, historique des versements, quittances PDF et relances WhatsApp Togo |
| `src/components/pos/CashRegisterSessionModal.tsx` | Gestion des ouvertures et clôtures de caisse (Rapports X et Z) |
| `src/components/ui/DatePeriodFilter.tsx` | Sélecteur temporel intelligent (presets, raccourcis jour précis & plage calendrier) |
| `src/components/layout/AppWrapper.tsx` | Routage, protection d'accès selon les rôles et exception pour `/reset-password` |
| `src/context/StoreContext.tsx` | État global réactif, calculs financiers anti-NaN, synchronisation Supabase et actions par lot |
| `src/lib/pdf.ts` | Moteur d'export PDF haute fidélité pour factures et quittances sans page blanche |
| `src/lib/accountingExport.ts` | Générateur universel des exports comptables Excel et CSV |
| `src/lib/server/moneriz-signature.ts` | Vérificateur HMAC-SHA256 temps constant des signatures webhook Moneriz |
| `src/lib/server/moneriz-checkout.ts` | Client serveur pour l'API Checkout Sessions de Moneriz (v1) |
| `src/lib/server/moneriz-app.ts` | Gestion des commandes d'abonnement, idempotence et inbox dédoublonnée |
| `src/app/api/checkout/route.ts` | Route API POST pour initier une session de paiement Moneriz |
| `src/app/api/webhooks/moneriz/route.ts` | Route API POST publique pour la réception des webhooks signés |
| `src/components/subscription/MonerizCheckoutModal.tsx` | Composant React Liveframe (iframe) avec gestion du protocole postMessage v1 |
| `src/components/subscription/SubscriptionModal.tsx` | Modal de sélection d'abonnement (Pro, Business, Mensuel, Annuel) |
| `saas_moneriz_integration.sql` | Migration SQL Supabase pour les tentatives et événements Moneriz |
