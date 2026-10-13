# BoutiquePro - Documentation Complète & Référence Technique

## 📋 Présentation Générale
**BoutiquePro** est une application web moderne (SaaS) conçue pour la gestion commerciale et le point de vente (POS) adaptée aux réalités du marché africain (monnaie FCFA, Mobile Money, relances WhatsApp, utilisation mobile & tablette).

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

### 4. Clôture de Caisse Journalière (Rapport Z & Rapport X)
- Bandeau dynamique sur la caisse : état d'ouverture, fond initial, cumul des espèces en temps réel.
- Point d'étape provisoire en cours de journée (Rapport X).
- Modal de clôture de shift : comptage physique des espèces avec détection et calcul instantané des écarts de caisse (Caisse juste, Excédent, ou Manquant).
- Impression thermique 80mm et PDF certifié du Rapport Z officiel avec visas du caissier et du gérant.
- Historique complet des clôtures antérieures.

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
| `src/components/layout/AppWrapper.tsx` | Routage, protection d'accès selon les rôles et exception pour `/reset-password` |
| `src/context/StoreContext.tsx` | État global réactif, calculs financiers anti-NaN, synchronisation Supabase et actions par lot |
| `src/lib/pdf.ts` | Moteur d'export PDF haute fidélité pour factures et quittances sans page blanche |
| `src/lib/accountingExport.ts` | Générateur universel des exports comptables Excel et CSV |
