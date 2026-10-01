# BoutiquePro - Documentation de l'Application

## 📋 Présentation
BoutiquePro est une application web moderne (SaaS) conçue pour la gestion commerciale et le point de vente (POS). Elle permet à de multiples commerçants de gérer leurs boutiques, leurs stocks, leurs ventes et leurs employés depuis une interface unique. L'application est installable (PWA) et fonctionne parfaitement sur ordinateur comme sur mobile.

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

## ⚠️ Points de Vigilance & Optimisations Techniques (Recommandations Architecturales)
Pour passer d'un prototype fonctionnel à un logiciel de production à grande échelle, les points suivants devront être traités :

1. **Transaction Atomique des Ventes :** Actuellement, l'enregistrement d'une vente se fait en 3 appels (Création vente -> Ajout items -> Baisse du stock). Si le réseau coupe au milieu, la base est corrompue. Il faut tout regrouper dans une fonction Postgres (`RPC`) pour garantir l'atomicité.
2. **Offline-First Réel :** Le cache PWA permet d'afficher l'interface sans internet, mais pour *créer* une vente hors-ligne, il faut implémenter une base de données locale (IndexedDB) avec une file d'attente de synchronisation et une gestion des conflits de stock au retour du réseau.
3. **Sécurisation stricte de la table Profils :** Restreindre la politique RLS sur la table `profiles` pour éviter d'exposer les emails de tous les utilisateurs (ex: utiliser une fonction RPC qui répond uniquement "vrai/faux" lors de l'ajout d'un caissier).
4. **Validation stricte du `store_id` :** Remplacer le trigger d'urgence `saas_auto_store_trigger` par une vérification stricte `WITH CHECK` dans les policies RLS. Le frontend doit impérativement fournir le bon ID.
5. **Vérification RLS en écriture :** S'assurer que les politiques RLS interdisent fermement l'écriture (modification de stock, suppression de produits) aux caissiers au niveau de la base, pour ne pas dépendre uniquement du masquage de l'interface.
6. **Performance des RLS :** Ajouter des index SQL sur `(user_id, store_id)` dans `store_members` et optimiser les fonctions pour éviter les ralentissements sur les grosses requêtes.

## 🌟 Nouvelles Fonctionnalités à Développer (Roadmap)
- Impression des tickets de caisse (Fonctionnalité POS basique).
- Clôture de caisse (Ouverture/fermeture de session avec calcul des écarts d'espèces).
- Paiements multiples (Espèces, Mobile Money, Carte) et paiements mixtes.
- Ventes à crédit pour les clients réguliers (très demandé en Afrique).
- Retours et annulations de ventes avec un journal d'audit détaillé.
- Scan de code-barres via l'appareil photo du téléphone/tablette.
- Facturation de l'abonnement SaaS (Stripe/Paystack) pour la monétisation.
- Sauvegardes et export CSV/PDF des données pour les commerçants.
