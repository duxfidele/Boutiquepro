# BoutiquePro - Documentation Complète & Référence Technique

## 📋 Présentation Générale
**BoutiquePro** est une application web moderne (SaaS) conçue pour la gestion commerciale et le point de vente (POS) adaptée aux réalités du marché africain (monnaie FCFA, Mobile Money, utilisation mobile & tablette). 

Elle permet à de multiples commerçants de gérer leurs boutiques, leurs stocks, leurs ventes et leurs employés depuis une interface unique et ultra-rapide. L'application est installable (PWA) et fonctionne de manière fluide sur ordinateur, tablette ou smartphone.

---

## 🛠️ Stack Technique
- **Frontend :** Next.js 14 (App Router), React, Tailwind CSS, Lucide React (Icônes).
- **Backend & Base de données :** Supabase (PostgreSQL, Authentification, Row Level Security, RPC en PL/pgSQL).
- **Format monétaire :** Franc CFA (XOF/XAF - FCFA).
- **PWA :** `@ducanh2912/next-pwa` (Gère la mise en cache, l'icône sur écran d'accueil et le fonctionnement applicatif).
- **Export & Impression :** Impression thermique directe (80mm/58mm via CSS `@media print`), factures A4 PDF (`jspdf`, `html2canvas`).
- **Gestionnaire de versions :** Git & GitHub (dépôt : `https://github.com/duxfidele/Boutiquepro.git`).

---

## 🔐 Architecture SaaS Multi-Tenant & Sécurité
L'application fonctionne selon le modèle **SaaS Multi-Tenant**. Chaque propriétaire peut posséder une ou plusieurs boutiques distinctes.

Les données sont strictement cloisonnées grâce aux **Row Level Security (RLS)** de PostgreSQL :
- Chaque requête vérifie que l'utilisateur connecté appartient bien à l'équipe de la boutique (`store_id`) avant de renvoyer la moindre donnée.
- Un caissier ou un propriétaire d'une boutique A ne peut **jamais** lire ni manipuler les données d'une boutique B.

### Tables clés (cloisonnées par `store_id`) :
- `stores` : Boutiques créées (avec `id`, `name`, `owner_id`, `created_at`).
- `store_members` : Table de liaison entre les utilisateurs (`user_id`), la boutique (`store_id`) et leur rôle (`role`).
- `profiles` : Profils publics (nom, email, rôle par défaut).
- `products` & `categories` : Catalogue des articles et catégories de la boutique.
- `sales` & `sale_items` : Historique des ventes et détail des lignes d'articles vendus.
- `customers` : Base clients et fidélité.
- `expenses` : Charges et dépenses opérationnelles (loyer, factures, salaires).
- `orders` & `order_items` : Commandes et réapprovisionnements fournisseurs.
- `inventory_sessions` & `inventory_items` : Sessions d'inventaire physique.
- `settings` : Paramètres personnalisés de chaque boutique (nom, logo, devise, TVA, ville, pays, téléphone, email).

---

## 👥 Rôles et Permissions (RBAC)

### 1. Administrateur / Gérant (`admin`)
- **Création de la boutique :** Automatique lors de l'inscription via trigger PostgreSQL (`handle_new_saas_user`).
- **Multi-Boutiques :** Peut créer de nouvelles boutiques (`+ Créer une boutique`) et basculer instantanément d'une boutique à l'autre depuis le menu.
- **Accès complet :** 
  - Tableau de bord complet (Chiffre d'affaires, Bénéfice Net, Total des Dépenses, Stock critique).
  - Point de Vente (POS) et Catalogue Produits (création, modification, prix d'achat, marges, suppression).
  - Inventaire physique, Dépenses, Analytique complète, Commandes fournisseurs.
  - Paramètres de la boutique (nom, logo, coordonnées).
- **Gestion d'Équipe (`/team`) :**
  - **Création directe de compte caissier :** Définition immédiate de l'email et du mot de passe (sans dépendre des quotas d'envoi d'emails Supabase).
  - **Attribution par email :** Rattachement d'un compte déjà existant à la boutique choisie.
  - **Révocation :** Retrait d'un caissier d'une boutique en 1 clic.

### 2. Caissier (`cashier`)
- **Tableau de bord personnalisé (`/`) :**
  - Le caissier a accès à son propre tableau de bord pour évaluer ses performances de la journée.
  - Il y consulte **exclusivement ses propres ventes** : CA personnel du jour, nombre de tickets encaissés, panier moyen et ses transactions récentes.
  - **Protection des données sensibles du patron :** Le bénéfice net, les prix d'achat, les marges, les dépenses du gérant et les ventes des autres collègues sont **totalement masqués**.
- **Isolation stricte de l'interface d'administration :**
  - L'analytique globale (`/analytics`), les dépenses (`/expenses`), les commandes fournisseurs (`/orders`), l'équipe (`/team`) et les paramètres (`/settings`) lui sont **totalement inaccessibles**.
  - Il ne peut **pas changer de boutique** ni créer de boutique : son interface est verrouillée sur la boutique qui lui a été affectée.
- **Catalogue Produits (`/products`) sécurisé :**
  - Consultation du stock et des prix de vente uniquement.
  - Les prix d'achat (`cost`) et les marges bénéficiaires sont **masqués**.
  - Les boutons de création, modification et suppression de produits sont désactivés pour son profil.
- **Point de Vente (POS) :**
  - Enregistrement des ventes, choix du mode de paiement (Espèces, Mobile Money, Carte).
  - Gestion de session de caisse : fond initial, point d'étape (Rapport X), clôture journalière et Rapport Z.

---

## ⚙️ Logique Frontend Spécifique
- **`AuthContext.tsx` :** Gère la session Supabase Auth, charge les boutiques accessibles, isole la boutique active (`activeStore`) et le rôle (`role`).
- **`StoreContext.tsx` :** Moteur central de l'application. Gère le cache local réactif (`boutiquepro-state`), la synchronisation Supabase, le calcul du CA, des bénéfices, des dépenses et l'exécution atomique des ventes via la fonction RPC `create_sale`.
- **`AppWrapper.tsx` :** Filtre de routage global qui bloque les accès non autorisés en fonction du rôle utilisateur et gère la page d'accueil marketing (`LandingPage.tsx`) pour les visiteurs non connectés.
- **`Sidebar.tsx` :** Barre de navigation responsive avec adaptation dynamique des liens selon le rôle (`adminOnly: true/false`), sélecteur de boutiques et affichage du caissier actif.

---

## 🚀 Évolutions & Améliorations Réalisées Récemment

1. **Résolution définitive de l'erreur 400 (PGRST200)** :
   - Mise en place de la fonction RPC `get_store_team_members` pour l'affichage de l'équipe sans dépendre de jointures PostgREST défaillantes.
2. **Attribution fluide Caissier-Boutique** :
   - Ajout d'un sélecteur de boutique dans l'onglet équipe et création directe des comptes caissiers via `admin_create_cashier`.
3. **Nettoyage automatique des boutiques parasites** :
   - Élimination des fausses boutiques "Ma Boutique" créées par défaut lors de la connexion d'un caissier.
4. **Concordance Financière & Réconciliation Comptable** :
   - Harmonisation du calcul du bénéfice net entre le Tableau de bord et la page Analytique : la remise est désormais déduite de façon rigoureuse (`Bénéfice Net = Total Ventes Net - Coût d'achat - Dépenses`).
   - Correction de la jauge de pourcentage par catégorie (qui ne dépasse plus 100%).
5. **Remise POS en Pourcentage (%)** :
   - Remplacement de la remise brute par un mode pourcentage `%` par défaut avec raccourcis rapides `[5%] [10%] [15%] [20%] [25%]`, calcul automatique de la déduction en FCFA et bascule optionnelle en FCFA fixe.
6. **Persistance Multi-Boutiques des Paramètres (`StoreContext.tsx`)** :
   - Modification de la sauvegarde des paramètres pour cibler strictement `store_id = activeStore.id` plutôt qu'un identifiant fixe `id = 1`.
7. **Déblocage des accès légitimes du Caissier** :
   - Autorisation des pages `/support` et `/profile` dans le garde de navigation `AppWrapper.tsx`.
8. **Script SQL Consolidé** :
   - Création et enrichissement du fichier `saas_team_and_stores_management.sql` contenant toutes les fonctions sécurisées (`admin_create_cashier`, `assign_cashier_by_email`, `get_store_team_members`, `remove_cashier_from_store`, `create_new_store`).
9. **Clôture de Caisse Journalière (Rapport Z & Rapport X)** :
   - Table `cash_sessions` avec isolation RLS multi-boutiques (`saas_cash_register_sessions.sql`).
   - Bandeau dynamique sur la caisse : état d'ouverture, fond initial, cumul des espèces en temps réel.
   - Modal d'ouverture de caisse avec saisie du fond initial et raccourcis rapides.
   - Point d'étape provisoire en cours de journée (Rapport X).
   - Modal de clôture de shift : comptage physique des espèces avec détection et calcul instantané des écarts de caisse (Caisse juste, Excédent, ou Manquant).
   - Impression certifiée du Ticket Thermique 80mm / PDF du Rapport Z officiel avec visas du caissier et du gérant.
   - Historique des clôtures passées avec réimpression à la demande.

---

## 💼 Perspectives Commerciales & Vente en SaaS

L'application a été conçue pour pouvoir être exploitée selon deux modèles commerciaux très rentables :

### Modèle 1 : SaaS B2B par Abonnement (Recommandé)
- Hébergement unique sur Vercel avec nom de domaine propre (ex: `app.boutiquepro.africa`).
- Chaque commerçant s'inscrit en ligne et gère sa boutique en toute autonomie grâce au cloisonnement RLS.
- Tarification récurrente mensuelle ou annuelle (ex: **5 000 à 15 000 FCFA / mois**) encaissée automatiquement via Mobile Money (Wave, Orange Money, MTN, Moov) avec des passerelles comme **FedaPay, KKiaPay, CinetPay ou Paystack**.
- Mises à jour centralisées : toute amélioration apportée au code profite instantanément à l'ensemble des clients.

### Modèle 2 : Vente de Licence Dédiée / Marque Blanche
- Déploiement d'une instance exclusive pour de grands commerces souhaitant leur propre logo, nom de domaine et base de données privée.
- Vente forfaitaire clé en main (**150 000 à 500 000 FCFA**) assortie d'un contrat de maintenance annuel.

---

## 📌 Feuille de Route / Prochaines Étapes Recommandées

1. ✅ **Clôture de Caisse Journalière (Rapport Z)** : *(TERMINÉ & OPÉRATIONNEL)*
2. ✅ **File d'Attente Hors-Ligne (Offline Sync Queue)** : *(TERMINÉ & OPÉRATIONNEL)*
   - Sauvegarde instantanée des ventes dans IndexedDB/LocalStorage en cas de coupure de connexion internet ou d'indisponibilité serveur.
   - Impression des tickets et mise à jour des stocks sans interruption de caisse.
   - Resynchronisation automatique en arrière-plan vers Supabase dès le retour du réseau avec prévention des doublons (idempotence) et bouton de synchronisation manuelle.
3. **Export Comptable Excel & CSV** :
   - Téléchargement en un clic de l'historique des ventes, des dépenses et de l'état des stocks pour la comptabilité.
4. **Synchronisation Temps Réel du Stock (Supabase Realtime)** :
   - Décrémentation visuelle instantanée du stock sur tous les terminaux de caisse connectés lorsqu'un article est vendu sur l'une des caisses.

