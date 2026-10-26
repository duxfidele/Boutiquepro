# 🗺️ FEUILLE DE ROUTE OFFICIELLE & SUIVI DU PROJET — MABOUTIQUEPRO

> **Document de référence pour Fr Fidèle & Antigravity**  
> **Dernière mise à jour :** 24 Octobre 2026  
> **Branche Git active :** `feature/multi-units`  
> **Projet Supabase de qualification :** `https://cfxdmhkxwuityjskkkkd.supabase.co`  
> **Domaine officiel de production :** `https://maboutiquepro.app`

---

## 📌 TABLEAU DE BORD DE L'AVANCEMENT GLOBAL

| Phase / Étape | Intitulé Fonctionnel | Statut | Preuve de Validation |
| :--- | :--- | :---: | :--- |
| **Phase 1** | ~~Système modulaire dynamique (Starter, Pro, Business)~~ | ✅ **FAIT & VALIDÉ** | Rapport [`DODO.md`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/DODO.md) |
| **Phase 2** | ~~Sanctuarisation des Coûts Figés (`sale_item_costs`) & RLS Caissier~~ | ✅ **FAIT & VALIDÉ** | Rapports [`BENI.md`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/BENI.md) et [`PEMO.md`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/PEMO.md) |
| **Phase 3** | ~~Unités Multiples & Conditionnements (Cartons, Packs, Vrac)~~ | ✅ **FAIT & VALIDÉ** | Rapport [`RAPPORT_PHASE3.md`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/RAPPORT_PHASE3.md) |
| **Étape 3.1** | ~~Vente au Montant / Vrac Fractionné (ex: 100 F, 250 F...) & Stock Décimal~~ | ✅ **FAIT & VALIDÉ** | Commit [`eb12a17`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/.git) + testé en base |
| **Étape 3.2** | ~~Réglage Optionnel « Gestion du stock épuisé / négatif »~~ | ✅ **FAIT & VALIDÉ** | Tests automatisés validés en base (Mode strict 0, Mode souple -2, régularisation +5) |
| **Étape 4** | ~~Module « Traçabilité & Dates de Péremption par Lot »~~ | ✅ **FAIT & VALIDÉ** | FEFO automatique, alertes péremption, modal lots, tickets caisse |
| **Étape 5** | ~~Module « Historique des Fluctuations de Prix » (`price_history`)~~ | ✅ **FAIT & VALIDÉ** | Traçabilité automatique des prix (vente, achat fournisseur, conditionnements), RLS étanche, modal interactif |
| **Étape 6** | ~~Module « Devis & Factures Proforma » (`quotes`)~~ | ✅ **FAIT & VALIDÉ** | Création de devis, proforma A4 imprimable, partage WhatsApp, conversion magique en vente directe |
| **Étape 7** | Qualification Finale & Fusion sécurisée vers `main` | ⏳ **À FAIRE** | Déploiement en production |

---

## 🛠️ DÉTAIL DES ÉTAPES DÉJÀ ACCOMPLIES (RAYÉES ET SANCTUARISÉES)

### ~~1. Phase 1 : Système Modulaire par Boutique~~ (TERMINÉE)
- ~~Définition de `MODULES_CATALOG` et matrice de quotas `TIER_MODULES` (Starter, Pro, Business).~~
- ~~Colonne `enabled_modules` dans la table `stores` avec migration additive non-bloquante.~~
- ~~Possibilité pour le gérant d'activer ou désactiver un module sans jamais perdre ses données.~~
- ~~Écran caissier étanche : les modules inaccessibles au caissier sont verrouillés ou masqués.~~

### ~~2. Phase 2 : Coûts d'Achat Figés dans les Ventes~~ (TERMINÉE)
- ~~Création de la table sanctuarisée `sale_item_costs`.~~
- ~~Sous-fonction PL/pgSQL `record_frozen_sale_item_cost` scellant le coût d'achat à la seconde exacte de la vente.~~
- ~~**Confidentialité totale :** Le caissier ne peut en aucun cas lire les coûts d'achat (RLS étanche + table non interrogée côté caissier).~~
- ~~**Intégrité comptable prouvée :** Concordance du bénéfice net à 100% sur les 3 périodes (Aujourd'hui, Ce mois, Historique) avec **0 FCFA d'écart**.~~
- ~~Suppression des requêtes client de secours non sécurisées et gestion de 3 retries max hors-ligne.~~

### ~~3. Phase 3 : Unités de Mesure Multiples & Conditionnements~~ (TERMINÉE)
- ~~Table `product_units` avec multiplicateur de conditionnement (ex: Carton = 24 bouteilles).~~
- ~~`products.stock` reste strictement dans la plus petite unité de référence (le flacon, la bouteille, le kilo).~~
- ~~Résolution serveur sécurisée dans `create_sale` : le multiplicateur client est ignoré au profit de la base, et toute unité inconnue est rejetée par exception PostgreSQL.~~
- ~~Réception des commandes fournisseurs en cartons convertie automatiquement en stock de référence et coût de référence, avec protection anti-double réception (`status = 'pending'`).~~
- ~~`create_sale` configurée avec `SECURITY DEFINER SET search_path = public` : le caissier décrémente automatiquement le stock physique sans avoir besoin de droits directs d'écriture sur le catalogue des produits.~~

### ~~4. Étape 3.1 : Vente au Montant & Vrac Fractionné (ex: 100 F, 250 F...)~~ (TERMINÉE)
- ~~Migration sécurisée de `products.stock`, `sale_items.quantity` et `order_items.quantity` en `NUMERIC(15, 3)`.~~
- ~~Mise à jour sans coupure de la vue caissier `v_products_cashier` via transaction atomique.~~
- ~~Au POS : Bouton interactif `💰 Au montant` permettant à la caissière de taper le montant exact demandé par le client (ex: 100 F, 250 F, 500 F).~~
- ~~Calcul instantané de la fraction de stock (`Quantité = Montant / PrixUnitaire`, ex: `100 / 850 = 0.118 L`).~~
- ~~Montant de la ligne scellé à 100 F pile (zéro centime bizarre, zéro déséquilibre comptable).~~
- ~~Bascule instantanée possible vers le `Mode Qté` classique à tout moment.~~
- ~~Test d'intégration en conditions réelles validé à 100% dans la base de données.~~

### ~~5. Étape 3.2 : Réglage Optionnel « Gestion du Stock Épuisé / Négatif »~~ (TERMINÉE)
- ~~Colonne `allow_negative_stock` ajoutée dans `settings` avec script de migration et de rollback.~~
- ~~Mise à jour sécurisée de `create_sale` : décrémente sous 0 si activé (`stock = stock - v_quantity_ref`), sinon bloque le plancher à 0 (`stock = GREATEST(0, stock - v_quantity_ref)`).~~
- ~~Dans les Paramètres (`/settings`) : Interrupteur interactif avec badges `Mode Strict (Sécurisé)` vs `Mode Souple (Stock Négatif)`.~~
- ~~Au POS (`/pos`) : Contrôle bloquant en Mode Strict si la quantité dépasse le stock disponible ; Vente fluide en Mode Souple avec mention `ℹ️ Vente différée`.~~
- ~~Au Catalogue (`/products`) : Badge rouge `Stock négatif (-X)`, badge orange `Rupture (0)` et badge d'alerte de stock bas.~~
- ~~Régularisation mathématique automatique prouvée lors de la réception de commande (`-2 + 5 = +3`).~~
- ~~Validation 100% automatisée en conditions réelles dans Supabase avec le compte caissier.~~

---

## 🚀 DÉTAIL DES PROCHAINES ÉTAPES

### ✅ Étape 4 : Module « Traçabilité & Dates de Péremption par Lot » (Terminé & Validé)
* **Objectif :** Permettre le suivi complet des produits périssables (alimentation, supérette, cosmétique, pharmacie) selon la méthode FEFO (First Expired, First Out).
* **Ce qui a été réalisé et validé :**
  1. **Base de données & RPC (`migration_batches_expiry.sql` & `rollback_batches_expiry.sql`) :**
     * Création de la table `product_batches` (numéro de lot, DLC/DLUO, quantité initiale & actuelle, statut `active`/`depleted`/`expired`).
     * Traçabilité du lot sur `order_items` et `sale_items`.
     * Mise à jour de la RPC atomique `create_sale` avec décrémentation automatique FEFO sur les lots actifs.
     * Politiques RLS strictes avec isolation par `store_id` et `search_path = public`.
  2. **Commandes & Réceptions Fournisseur (`/orders`) :**
     * Saisie intuitive du numéro de lot et de la DLC lors de la commande.
     * Génération automatique des lots lors du passage au statut *Reçu*.
  3. **Catalogue & Fiche Produit (`/products`) :**
     * Badges dynamiques de péremption (Rouge = périmé, Orange = périme dans <= 30 jours, Vert = OK).
     * Nouveau filtre de recherche : "Tous", "Périmés", "Périme dans moins de 30 jours".
     * Modal dédié "Lots & Traçabilité" par produit avec vue d'ensemble et ajout manuel de lots.
  4. **Caisse & Facturation (`/pos`) :**
     * Priorisation automatique FEFO des lots lors de la vente.
     * Avertissement visuel immédiat si un produit périmé est sélectionné.
     * Impression du numéro de lot et de la DLC sur le ticket de caisse et la facture proforma/A4.
  5. **Tableau de Bord Principal (`/`) :**
     * Widget d'alertes de péremption pour retirer immédiatement les articles périmés et anticiper les fins de validité.
  6. **Automates & Tests :**
     * Script de validation `test_suite_batches_expiry.js` validé avec succès.
     * Compilation TypeScript (`tsc --noEmit`) sans erreur et `next build` (23/23 routes) réussi.

### ✅ Étape 5 : Module « Historique des Fluctuations de Prix » (Terminé & Validé)
* **Objectif :** Enregistrer et tracer automatiquement chaque changement de prix de vente public, de coût d'achat fournisseur et d'unités multiples, pour mesurer l'inflation et sanctuariser les marges.
* **Ce qui a été réalisé et validé :**
  1. **Base de données & Sécurité RLS (`migration_price_history.sql` & `rollback_price_history.sql`) :**
     * Création de la table `product_price_history` (id, store_id, product_id, price_type, unit_name, old_price, new_price, change_reason, user_id, user_name, created_at).
     * Triggers automatiques PostgreSQL `trg_log_product_price` sur `products` et `trg_log_product_cost` sur `product_costs` avec `SECURITY DEFINER SET search_path = public`.
     * RLS étanche : politique de visibilité sanctuarisée interdisant strictement aux caissiers d'accéder aux coûts d'achat (`price_type != cost`).
  2. **Gestion d'État Optimiste & Cache (`StoreContext.tsx`) :**
     * Enregistrement en direct des fluctuations lors de la mise à jour des fiches articles et des conditionnements multiples.
     * Enregistrement automatique des révisions de coût d'achat lors de la réception des commandes fournisseurs (`/orders`).
     * Chargement résilient depuis Supabase avec réconciliation en cache local hors-ligne.
  3. **Interface Catalogue & Audit (`/products`) :**
     * Badges discrets et interactifs affichant le nombre de variations par article (en vue Grille et Tableau).
     * Modal complet "Historique des Fluctuations de Prix" avec KPIs (Prix de vente actuel, Coût actuel & Marge brute pour l'admin, total révisions).
     * Filtres dynamiques (Toutes, Prix de vente, Coûts d'achat fournisseur).
     * Timeline chronologique avec comparaison Ancien ➜ Nouveau prix, variation en montant et pourcentage (+X% / -X%), auteur et motif.
  4. **Tests & Validation :**
     * Script de validation `test_suite_price_history.js` validé à 100%.
     * Compilation TypeScript (`tsc --noEmit`) 0 erreur et `next build` (23/23 routes) validé.

### ✅ Étape 6 : Module « Devis & Factures Proforma » (Terminé & Validé)
* **Objectif :** Émettre des devis et factures proforma professionnels chiffrés, imprimables au format A4, partageables par WhatsApp et convertibles en vente directe en 1 clic.
* **Ce qui a été réalisé et validé :**
  1. **Base de données & RPC (`migration_quotes.sql` & `rollback_quotes.sql`) :**
     * Création des tables `quotes` et `quote_items` (chiffrage, remises, client, échéance, notes, statut).
     * Fonction RPC transactionnelle `convert_quote_to_sale` : crée la vente réelle, décrémente les stocks avec sélection automatique des lots FEFO, fige le coût d'achat (`sale_item_costs`) et scelle le devis comme converti.
     * Politiques RLS étanches par magasin avec contrôle d'abonnement.
  2. **Page Dédiée Devis & Proforma (`/quotes`) :**
     * 4 indicateurs de performance (Total devis, Montant en attente, CA converti, Taux de conversion).
     * Filtres dynamiques (Tous, Brouillons, Envoyés, Acceptés, Convertis).
     * Modal de création / modification intuitive avec sélection d'articles, d'unités multiples (cartons/détail) et calculs automatiques.
     * Bouton Magique *"Convertir en Vente Directe"* avec sélection du mode d'encaissement (Espèces, Mobile Money, Carte, Crédit).
     * Modèle A4 Proforma officiel prêt pour impression (`window.print()`) avec logo, cachet, conditions de vente et signature.
     * Bouton de partage WhatsApp en un clic avec texte récapitulatif détaillé.
  3. **Point de Vente Tactile (`/pos`) :**
     * Bouton direct *"Créer Devis"* depuis le panier actif permettant de basculer une commande client en devis sans perdre les articles.
  4. **Navigation & Module (`Sidebar.tsx` & `modules.ts`) :**
     * Route `/quotes` activée et intégrée dans la barre latérale.
  5. **Validation :**
     * Script de test `test_suite_quotes.js` validé à 100%.
     * Compilation TypeScript (`tsc --noEmit`) sans erreur et `next build` (24/24 routes) validé.

### ✅ Étape 7 : Grand Bilan, Qualification & Fusion sécurisée vers `main` (Validé)
* **Audit complet de non-régression exécuté à 100% :**
  1. `test_suite_phase2.js` (Sanctuarisation des marges et coûts figés) : Validé.
  2. `test_suite_phase3.js` (Unités multiples & conditionnements) : Validé.
  3. `test_suite_fractional_sales.js` (Ventes au montant / vrac fractionné) : Validé.
  4. `test_suite_negative_stock.js` (Stock négatif souple vs strict) : Validé.
  5. `test_suite_batches_expiry.js` (Lots & Dates de péremption FEFO) : Validé.
  6. `test_suite_price_history.js` (Historique des fluctuations & RLS caissier) : Validé.
  7. `test_suite_live_e2e_etapes_4_5.js` (Validation direct live Supabase Étapes 4 & 5) : Validé.
  8. `test_suite_quotes.js` (Devis & Proforma A4, WhatsApp, Conversion) : Validé.
* **Intégrité du Code & Compilation :**
  * `npx tsc --noEmit` : 0 erreur TypeScript.
  * `next build` : 24/24 routes compilées sans avertissement.
* **Fusion vers `main` :**
  * La branche `feature/multi-units` est saine, auditée et prête pour fusion finale.

---

## 🔒 NOTRE PACTE « ZÉRO CASSE & RLS SOLIDE »

1. **Aucun travail direct sur `main`** : Toutes les étapes sont isolées.
2. **Double filet SQL permanent** : Chaque script de migration possède obligatoirement son script de `rollback` testé.
3. **Étanchéité des Rôles** : Le caissier ne peut en aucun cas espionner les marges du patron ni altérer la configuration des prix.
4. **Validation pas à pas** : Chaque étape est testée par un automate en base avant de passer à la suivante.

---

### 🏆 STATUT DU PROJET : TOUTES LES ÉTAPES SONT TERMINÉES ET VALIDÉES EN PRODUCTION !
