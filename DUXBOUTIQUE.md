# DUXBOUTIQUE - Documentation Projet (BoutiquePro)

Ce fichier est le **cerveau du projet**. Il sert de guide pour comprendre l'architecture, les fonctionnalités et les règles de conception de l'application SaaS BoutiquePro. Tout futur modèle IA travaillant sur ce projet doit lire ce fichier en premier pour comprendre le contexte.

## 1. Ce que l'application fait
BoutiquePro est une solution logicielle SaaS complète de **Gestion Commerciale** destinée aux boutiques physiques et en ligne. Elle permet de gérer les ventes au comptoir (Point de Vente - POS), de suivre le stock en temps réel, de réaliser des inventaires, d'analyser les statistiques de vente et de personnaliser les documents commerciaux (tickets de caisse, factures, rapports PDF) à l'image de la boutique cliente.

## 2. Fonctionnalités implémentées
- **Tableau de Bord (Dashboard) :** KPIs globaux (Chiffre d'affaires, Marge, Commandes), graphiques des ventes récentes.
- **Point de Vente (POS) :** Interface de caisse tactile, ajout rapide de produits au panier, calcul automatique de la monnaie, impression de Ticket de Caisse (format thermique 80mm) et Facture (format A4 PDF).
- **Produits & Stock :** Liste des produits, alertes de rupture de stock (badge rouge visuel dynamique), recherche et filtrage, tri alphabétique global.
- **Inventaire :** Session d'inventaire interactive (Stock Théorique vs Stock Physique), calcul automatique de la démarque (écarts en quantité et valeur financière), génération d'un rapport PDF personnalisé.
- **Analytique :** Top des ventes classées par chiffre d'affaires, statistiques avancées des produits.
- **Commandes :** Suivi basique des commandes clients (En attente, Expédié, Livré).
- **Paramètres ("Marque Blanche") :** Personnalisation complète (Nom, Logo, Ville, Pays, Email, Téléphone, Taux de Taxe, Devise). Ces informations se reflètent automatiquement sur l'interface et tous les documents officiels générés.
- **Aide & Support :** FAQ interactive (accordeons), liens de contact directs (WhatsApp, Email) vers le support technique.

## 3. Technologies utilisées
- **Framework :** Next.js 14 (App Router), React.
- **Langage :** TypeScript (strict typing).
- **Styling :** Tailwind CSS (utilisant des variables CSS natives pour les couleurs thématiques).
- **Icônes :** Lucide React.
- **Génération PDF :** `html2pdf.js` (exécuté côté client).
- **État Global :** React Context API (`StoreContext.tsx` avec un reducer complexe simulant une base de données).

## 4. Structure des fichiers clés
- `src/app/` : Routes de l'application.
  - `page.tsx` (Tableau de Bord)
  - `pos/page.tsx` (Point de Vente)
  - `inventory/page.tsx` (Inventaire & Export PDF)
  - `products/page.tsx` (Gestion des Stocks)
  - `settings/page.tsx` (Configuration)
  - `support/page.tsx` (Aide & FAQ)
- `src/components/` : Composants réutilisables.
  - `layout/Sidebar.tsx` (Menu latéral de navigation principal)
  - `layout/Header.tsx` (Barre de recherche supérieure)
  - `ui/ProductAvatar.tsx` (Générateur visuel de miniatures pour les produits)
- `src/context/` :
  - `StoreContext.tsx` : LE fichier central gérant tout l'état de l'application (Produits, Ventes, Paramètres, Sessions d'Inventaire).

## 5. Décisions de Design (UX/UI)
- **Aesthétique "Vibe Coding" Premium :** Design extrêmement moderne, utilisation d'effets "glassmorphism" (backdrop-blur), bordures très arrondies (rounded-2xl, rounded-xl), ombres douces (shadow-sm, shadow-soft-lg), et micro-animations fluides (animate-fade-in, animate-scale-in).
- **Couleurs :** Utilisation intensive des variables CSS (ex: `bg-primary/10`, `text-primary`) pour permettre l'intégration future de thèmes dynamiques (Light/Dark).
- **Responsivité Globale :** L'interface doit être utilisable sur mobile sans scroll horizontal indésirable (`no-scrollbar`).
- **Accessibilité Mobile :** La taille de police des champs de saisie (`input`) doit être d'au moins 16px (ou utiliser des utilitaires CSS spécifiques) pour empêcher le zoom automatique sous iOS Safari.

## 6. Instructions Strictes pour les Futurs Modèles IA
1. **Toujours lire ce fichier en premier** avant de proposer des modifications d'architecture.
2. **Gestion de l'État :** Toute nouvelle donnée persistante doit obligatoirement être intégrée dans `StoreContext.tsx` (interfaces `StoreState` et type `Action`). Ne pas multiplier les contextes isolés.
3. **Règles de Tri :** Les listes de produits doivent être classées de **A à Z** par défaut dans toutes les vues, **SAUF** dans la page "Analytique" où le classement se fait par Chiffre d'Affaires décroissant.
4. **Documents & Exports :** Lors de la modification des factures, reçus ou rapports d'inventaire, il faut TOUJOURS s'assurer que les données dynamiques de la boutique (`state.settings.logo`, `state.settings.name`, contacts) sont présentes. Penser à masquer les éléments d'interface (boutons, scrolls) lors des exports PDF via `print:hidden` ou manipulation DOM.
5. **Composants d'UI :** Éviter d'installer des librairies de composants externes lourdes (Material UI, Ant Design). L'UI doit rester 100% "Custom" construite avec Tailwind CSS pour préserver les performances et l'esthétique unique.
6. **Prochaine Étape (Backend / SaaS - Phase 3) :** 
L'application est déployée sur Vercel. Le processus de migration vers **Supabase** (PostgreSQL) a commencé !
- **Phase 1 et 2 (Terminées) :** Les tables `settings`, `categories` et `products` ont été créées sur Supabase (Option A: base ouverte, RLS désactivé via des policies publiques pour les tests). Le fichier `StoreContext.tsx` a été mis à jour pour lire et écrire dans ces tables.
- **Phase 3 (En attente) :** Il reste à migrer les tables `sales`, `sale_items`, `customers` et `inventory_sessions`. Actuellement, ces données utilisent un "fallback" sur le `localStorage`. La prochaine IA devra créer ces tables et mettre à jour `StoreContext.tsx` pour elles.
- Ensuite viendra l'Authentification (Option B) pour verrouiller la base de données.
Ne JAMAIS supprimer le `dispatchBase` dans StoreContext, le modèle "Wrapper Async" fonctionne parfaitement pour l'optimistic UI.
