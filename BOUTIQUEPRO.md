# BoutiquePro - Documentation de l'Application

## 📋 Présentation
BoutiquePro est une application web moderne (SaaS) conçue pour la gestion commerciale et le point de vente (POS). Elle permet à de multiples commerçants de gérer leurs boutiques, leurs stocks, leurs ventes et leurs employés depuis une interface unique. L'application est installable (PWA) et est actuellement au stade de **MVP fonctionnel** (la base de données pouvant être corrompue si le réseau coupe lors d'une vente, une sécurisation est prévue en Phase 1).

## 🛠️ Stack Technique
- **Frontend :** Next.js 14 (App Router), React, Tailwind CSS, Lucide React (Icônes)
- **Backend & Base de données :** Supabase (PostgreSQL, Auth, RLS)
- **Déploiement :** Vercel
- **PWA :** `@ducanh2912/next-pwa` (Gère la mise en cache et le mode hors-ligne)

## 🔐 Architecture SaaS et Sécurité (Multi-tenant)
L'application fonctionne selon le modèle **SaaS Multi-Tenant**. Chaque utilisateur peut avoir une ou plusieurs boutiques. 
Les données sont strictement cloisonnées grâce aux **Row Level Security (RLS)** de Supabase.
Chaque requête vérifie que l'utilisateur appartient à l'équipe de la boutique (`store_id`) avant de renvoyer la donnée.

### Tables clés (cloisonnées par `store_id`) :
- `stores` : Les boutiques créées.
- `store_members` : Liaison entre un utilisateur (`user_id`), une boutique (`store_id`) et son rôle (`role`).
- `profiles` : Profils publics pour la recherche de caissiers par email.
- `products`, `sales`, `sale_items`, `customers`, `expenses`, `inventory_items` : Tables de données cloisonnées.

## 👥 Rôles et Permissions (RBAC)
Le système gère 2 niveaux d'accès configurés à la fois dans le frontend (UI) et le backend (Postgres RLS) :

### 1. Administrateur / Gérant (`admin`)
- **Création de la boutique :** Automatique lors de l'inscription via un trigger PostgreSQL.
- **Accès complet :** Tableau de bord détaillé (CA, Bénéfice Net, Dépenses), Point de Vente, Inventaire (ajustements), Commandes fournisseurs, Dépenses, Analytique, Gestion de l'Équipe.
- **Gestion d'Équipe :** Peut inviter des caissiers via leur adresse email (si l'email existe dans `profiles`).

### 2. Caissier (`cashier`)
- **Accès restreint :** Point de Vente (POS), Catalogue Produits, Clients.
- **Tableau de bord sur-mesure :** Le caissier voit un tableau de bord spécifique qui masque les données financières sensibles (Bénéfice Net, Dépenses) et n'affiche que ses propres ventes de la journée et le panier moyen.
- **Isolation des ventes (RLS) :** La base de données filtre automatiquement les requêtes pour que le caissier ne puisse lire ou modifier **que** les ventes qu'il a lui-même initiées (`user_id = auth.uid()`).

## ⚙️ Logique Frontend Spécifique
- `AuthContext.tsx` : Gère la session utilisateur, récupère les boutiques auxquelles l'utilisateur appartient, et stocke la boutique active (`activeStore`) ainsi que le `role` actuel dans le localStorage.
- `StoreContext.tsx` : Gère le cache local et les interactions CRUD avec Supabase. Toutes les requêtes intègrent le `store_id` actif. En cas d'erreur de `store_id` manquant, un Trigger Postgres (`saas_auto_store_trigger`) force l'insertion pour éviter les crashs RLS.
- `AppWrapper.tsx` & `Sidebar.tsx` : Gèrent le routage conditionnel pour bloquer l'accès aux pages interdites selon le `role`.

## 📌 État Actuel (Ce qui a été fait en dernier)
- Mise en place complète du système SaaS.
- Création du menu "Mon Équipe" pour l'admin.
- Masquage des onglets sensibles (Analytique, Dépenses, Inventaire, Commandes) pour les caissiers.
- Partitionnement des données de ventes : un caissier ne voit que ses propres ventes dans son tableau de bord.
- Migration des anciens utilisateurs (avant le mode SaaS) et backfill de la table `profiles` pour permettre la recherche d'email.

## 🚀 Prochaines étapes / Idées (À reprendre)
- Développer la génération de rapports avancés (PDF).
- Implémenter l'impression des tickets de caisse.
- Affiner la gestion des remises spécifiques au niveau des caissiers.

## 🚀 Roadmap & Points de Vigilance (Priorisation)

Afin de passer de l'état de **MVP fonctionnel** à un logiciel de production robuste, la suite du développement est structurée en 3 phases prioritaires :

### Phase 1 : Sécurité et Intégrité (Avant tout vrai client)
- **Transaction Atomique des Ventes :** Actuellement, l'enregistrement se fait en 3 appels (Création vente -> Ajout items -> Baisse du stock). Si le réseau coupe, la base est corrompue. Il faut utiliser une fonction Postgres (`RPC`) pour garantir l'atomicité.
- **Vérification RLS en écriture :** S'assurer que les politiques RLS interdisent fermement l'écriture (modification de stock, suppression de produits, etc.) aux caissiers. Écriture réservée à l'admin.
- **Sécurisation stricte de la table Profils :** Restreindre la politique RLS (ex: utiliser une fonction RPC qui répond uniquement "vrai/faux" lors de l'ajout d'un caissier au lieu d'exposer les profils).
- **Validation stricte du `store_id` :** Suppression du trigger d'urgence `saas_auto_store_trigger`, remplacé par une validation stricte `WITH CHECK` dans les policies RLS.
- **Performance des RLS :** Ajouter un index SQL sur `(user_id, store_id)` dans `store_members` pour éviter les ralentissements.

### Phase 2 : Le minimum pour vendre le produit
- **Impression des tickets de caisse :** Fonctionnalité POS basique incontournable.
- **Paiements multiples :** Intégration de Mobile Money (en priorité), paiements mixtes et espèces.
- **Retours et annulations de ventes :** Avec un journal d'audit détaillé pour la traçabilité.
- **Clôture de caisse :** Ouverture/fermeture de session avec calcul des écarts d'espèces.

### Phase 3 : Différenciation et mise à l'échelle
- **Ventes à crédit :** Pour les clients réguliers (très demandé sur le marché ouest-africain).
- **Scan de code-barres :** Via l'appareil photo du téléphone ou de la tablette.
- **Offline-First Réel :** Implémenter une base de données locale (IndexedDB) avec file d'attente de synchronisation. Chantier complexe, à lancer seulement s'il devient un argument de vente décisif.
- **Facturation de l'abonnement SaaS :** Privilégier des solutions comme Paystack, Flutterwave ou une intégration directe Mobile Money (plus réalistes que Stripe pour le marché ciblé).
- **Sauvegardes et Exports :** Export CSV/PDF des données pour les commerçants.
