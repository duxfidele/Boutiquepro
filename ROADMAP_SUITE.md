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
| **Étape 4** | Module « Traçabilité & Dates de Péremption par Lot » | ⏳ **À FAIRE** | Prévu pour l'alimentation/dépôts |
| **Étape 5** | Module « Historique des Fluctuations de Prix » (`price_history`) | ⏳ **À FAIRE** | Traçabilité des hausses/baisses |
| **Étape 6** | Module « Devis & Factures Proforma » (`quotes`) | ⏳ **À FAIRE** | Conversion devis en vente directe |
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

### ⏳ Étape 4 : Module « Traçabilité & Dates de Péremption par Lot » (Priorité Fr Fidèle)
* **Objectif :** Permettre le suivi des produits périssables (alimentation, supérette, cosmétique, pharmacie).
* **Fonctionnalités :**
  1. **À la commande / réception fournisseur (`/orders`) :** Saisie du numéro de lot (ex: `LOT-2026-A`) et de la date limite de consommation (DLC / DLUO).
  2. **Au Tableau de bord & Catalogue (`/products`) :**
     * Badge orange : *"Périme dans moins de 30 jours"*
     * Badge rouge : *"Article périmé — Retirer de la vente"*
  3. **À la caisse (`/pos`) :** Priorisation automatique du lot qui périme le plus tôt (principe FEFO).

### ⏳ Étape 5 : Module « Historique des Fluctuations de Prix » (`price_history`)
* **Objectif :** Enregistrer chaque changement de prix d'achat fournisseur ou de prix de vente public :
  * Qui a modifié le prix ?
  * Quel était l'ancien prix et quel est le nouveau prix ?
  * À quelle date exacte ?
* **Bénéfice :** Permet au patron de voir l'impact de l'inflation et de justifier ses marges.

### ⏳ Étape 6 : Module « Devis & Factures Proforma » (`quotes`)
* **Objectif :** Émettre un devis professionnel imprimable ou envoyable par WhatsApp à un client.
* **Bouton magique :** Un simple bouton *"Convertir en Vente"* transforme le devis validé en vente réelle à la caisse sans ressaisie.

### ⏳ Étape 7 : Grand Bilan, Qualification & Fusion vers `main`
* Audit complet de non-régression.
* Validation finale par Fr Fidèle.
* Fusion propre de `feature/multi-units` vers `main` pour publication officielle sur [maboutiquepro.app](https://maboutiquepro.app).

---

## 🔒 NOTRE PACTE « ZÉRO CASSE & RLS SOLIDE »

1. **Aucun travail direct sur `main`** : Toutes les étapes sont isolées.
2. **Double filet SQL permanent** : Chaque script de migration possède obligatoirement son script de `rollback` testé.
3. **Étanchéité des Rôles** : Le caissier ne peut en aucun cas espionner les marges du patron ni altérer la configuration des prix.
4. **Validation pas à pas** : Chaque étape est testée par un automate en base avant de passer à la suivante.

---

### 💬 COMMENT REPRENDRE AU PROCHAIN CONTACT ?

Quand vous serez prêt à reprendre, Fr Fidèle, vous n'aurez qu'à me dire simplement :
> *"Shalom, on reprend le travail !"*  
> (ou *"On commence l'étape 3.2"* / *"On fait les dates de péremption"*).

Je saurai exactement où nous en sommes grâce à ce fichier et à notre mémoire partagée. Reposez-vous en paix, tout est en ordre et sécurisé !
