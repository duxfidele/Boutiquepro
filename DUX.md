# DUX.md - Spécifications & Architecture du Système de Modules (MaBoutiquePro)

Ce document consigne l'analyse complète (Phase 0 validée), les réponses techniques détaillées issues de la lecture du code source, l'architecture technique, le schéma de données, la sécurité RLS, les règles d'affichage conditionnel, le comportement de repli (fallback) et le plan de migration pour le **Système de Modules** de MaBoutiquePro.

---

## 1. Contexte & Principes Directeurs

MaBoutiquePro est une application SaaS multi-tenant en production (Next.js 14, Supabase RLS, PWA, mode hors-ligne) avec des abonnés actifs.
L'objectif est d'introduire un **système de modules configurables par boutique** au sein d'une **application unique, sans duplication de code**.

### Les 7 Principes Fondamentaux :
1. **Affichage, pas sécurité :** Le module est un commutateur d'affichage (UI/UX). La sécurité reste assurée par Supabase RLS, les rôles (`store_members`) et l'abonnement (`sub_gate_*`). Masquer un module ne modifie aucun droit d'accès en base.
2. **Préservation absolue des données :** Désactiver un module le masque uniquement de l'interface. Aucune donnée n'est supprimée ou altérée.
3. **Migration 100% additive :** Pour toutes les boutiques existantes, l'ensemble des modules opérationnels actuels (`debts`, `receipts_invoices`, `inventory`, `orders`, `expenses`, `analytics`, `team`, `multi_store`) est activé par défaut. Leur expérience utilisateur reste strictement inchangée.
4. **Cloisonnement des rôles :** Seul l'administrateur peut activer/désactiver les modules dans les Paramètres. Le caissier a un accès en lecture seule et ne voit que les modules activés pour sa boutique.
5. **Gouvernance des données :** Toute nouvelle table ou colonne intègre `store_id`, RLS activée, et respecte les politiques d'abonnement (écriture bloquée si abonnement échu, lecture libre).
6. **Confidentialité financière :** Le caissier ne voit **jamais** les prix d'achat ni les marges bénéficiaires, quelle que soit la combinaison de modules actifs.
7. **Déploiement sécurisé :** Environnement de test, sauvegardes préalables, migration en transaction atomique et script de retour arrière (rollback) ordonné (code puis base).

---

## 2. Réponses Techniques Validées par Lecture du Code

### (a) Types SQL de `products.stock` et `sale_items.quantity`
- **`products.stock`** : Type `NUMERIC` (ou `INTEGER` supporté comme `NUMERIC` dans les fonctions de calcul).
- **`sale_items.quantity`** : Type `NUMERIC` (dans les migrations `saas_security_hardening.sql` et `fix_credit_sales_and_debts.sql`, le champ est typé et casté explicitement via `(item->>'quantity')::NUMERIC`).

### (b) Enregistrement du coût d'achat et calcul du bénéfice
- **Non, `sale_items` n'enregistre PAS le coût d'achat au moment de la vente.** Les colonnes insérées dans `sale_items` sont exclusivement :
  `id, sale_id, store_id, product_id, product_name, quantity, unit_price, total`.
- **Calcul du bénéfice :**  
  Dans `StoreContext.tsx` (lignes 2273-2285), le coût de revient des marchandises vendues (`totalCOGS`) est calculé **dynamiquement** en rattachant chaque article vendu à son produit actuel dans `state.products` (alimenté par la table sanctuarisée `product_costs`) :
  ```typescript
  let totalCOGS = 0;
  state.sales.forEach(sale => {
    sale.items.forEach(item => {
      const product = state.products.find(p => p.id === item.productId);
      if (product && product.cost) {
        totalCOGS += (product.cost * item.quantity);
      }
    });
  });
  const netProfit = totalRevenue - totalCOGS - totalExpenses;
  ```

### (c) Décrémentation du stock (Client vs SQL)
**Aux deux endroits de façon coordonnée :**
1. **Côté client (Optimistic UI)** dans le reducer React (`StoreContext.tsx` lignes 522-525) pour un retour visuel instantané :
   `stock = Math.max(0, p.stock - soldItem.quantity)`.
2. **Côté SQL** de manière atomique et transactionnelle via la RPC Postgres `create_sale` (`saas_security_hardening.sql` ligne 326) :
   `UPDATE public.products SET stock = GREATEST(0, stock - v_quantity) WHERE id = v_product_id AND store_id = p_store_id;`.

### (d) Format exact d'une vente dans la file hors-ligne
Dans `src/lib/offlineQueue.ts`, la file d'attente IndexedDB (`BoutiquePro_Offline`, objectStore: `pending_sales`) avec fallback `localStorage` (`boutiquepro_offline_sales`) stocke des objets du type exact suivant :
```typescript
export interface OfflineSaleItem {
  id: string;          // ID de la vente (ex: "v_172970...")
  storeId: string;     // UUID de la boutique
  sale: Sale;          // Objet complet de la vente
  createdAt: string;   // Date ISO
  retryCount: number;  // Nombre de tentatives de resynchronisation
  lastError?: string;  // Dernière erreur éventuelle rencontrée
}
```
L'objet `Sale` imbriqué contient : `id, items[], subtotal, tax, discount, total, paymentMethod, amountGiven, change, customerName, customerPhone, createdAt, userId, amountPaid, remainingAmount, paymentStatus, dueDate, cashSessionId, cashierName`.

---

## 3. Accès Réels Actuels par Formule d'Abonnement

Après audit exhaustif du code :
- **`/expenses` (Dépenses) : OUI, accessible aux Starter.**  
  Dans `Sidebar.tsx` ligne 39 : `{ href: "/expenses", label: "Dépenses", icon: Receipt, adminOnly: true }`. Il est réservé à l'administrateur, mais **sans restriction Pro**. Un admin Starter a donc un accès complet à `/expenses`. Le module `expenses` reste donc **intégralement dans Starter**.
- **`/analytics` (Analytique) : NON, verrouillé pour Starter.**  
  Dans `Sidebar.tsx` ligne 40 et 206 : `proFeature: true` et vérifié par `if (item.href === "/analytics" && !canUseAdvancedAnalytics) isLockedForUser = true;`. Il affiche le cadenas PRO et redirige vers le modal de mise à niveau.
- **Ticket de caisse simple : OUI, accessible aux Starter.**  
  Dans `pos/page.tsx`, aucun filtre ne bloque le bouton d'impression ticket ni le modal de reçu thermique pour l'utilisateur. Toute vente au comptoir peut générer le ticket standard.  
  👉 **Règle adoptée :** Le ticket de caisse standard fait partie du module `core` (toujours actif). Le module `receipts_invoices` régit la facturation formelle A4 et les quittances de solde.

---

## 4. Sécurité RLS et Triggers sur `stores`

### Politiques réelles et triggers en base :
1. **`protect_subscription_columns()`** (`saas_subscription_final.sql` lignes 61-83) :
   Empêche la modification de `subscription_plan`, `subscription_status` et `subscription_ends_at`.
2. **`trg_prevent_direct_store_tampering()`** (`saas_subscription_tiers_and_quotas.sql` lignes 556-574) :
   Empêche la modification directe de `owner_id`.
3. **Absence de conflit :**  
   La mise à jour des colonnes `enabled_modules` et `business_sector` par l'administrateur de la boutique ne modifie ni l'abonnement ni le propriétaire. Elle s'exécute donc sans **aucun conflit avec les triggers d'abonnement**.

---

## 5. « Les Trois Caisses » et le Rôle de `team`

- « Les trois caisses » correspond au quota **`maxCashiers: 3`** de la formule **Business** (`subscriptionPlans.ts` ligne 68) :
  - Starter : 0 caissier (gérant seul).
  - Pro : 1 caissier assigné.
  - Business : jusqu'à 3 caissiers / caisses actives en parallèle.
- Chaque caissier connecté dispose de sa propre session de caisse indépendante (`cash_sessions`) avec son fond de caisse propre et sa clôture X/Z.
- **Organisation modulaire :** L'attribution et l'activation des caisses supplémentaires passent directement par l'écran `/team` ("Mon Équipe"). Le module `team` couvre la création et l'assignation des caissiers/caisses sans qu'il soit nécessaire de créer un module artificiel séparé.

---

## 6. Comportement de Repli (Fallback)

Pour garantir que l'application ne soit **jamais plus restrictive** qu'aujourd'hui :

| Scénario | État des données | Comportement de repli de l'UI |
| :--- | :--- | :--- |
| **Configuration absente** (`enabled_modules` est `NULL` ou vide) | Boutique ancienne ou non initialisée | **Tous les modules sont considérés activés** : repli sur `DEFAULT_ALL_MODULES`. L'affichage est strictement identique à aujourd'hui. |
| **Chargement en cours** (`loading: true`) | Réseau lent, attente session | Aucun élément de menu n'est masqué prématurément ; conservation du state précédent ou affichage complet. |
| **Cache vide hors-ligne** (`localStorage` nettoyé ou premier démarrage offline) | Pas de données en cache local | Repli sur la liste complète des modules de la formule souscrite. Aucun écran blanc, la PWA continue de fonctionner. |
| **Essai gratuit (Trial 14j)** | Statut `trial` en cours | Bénéficie de l'accès **PRO** complet (identique au fonctionnement actuel). |
| **Abonnement expiré** | Statut `expired` | Les modules restent **visibles en lecture seule** pour consulter l'historique et les données, conformément au principe n°5 (seule l'écriture est bloquée par `sub_gate_*`). |

---

## 7. Protection des Futurs Modules

Pour que les futurs modules (`multi_units`, `price_history`, `quotes`) ne soient **jamais ajoutés automatiquement** aux boutiques existantes lors de leur déploiement futur :
- Le tableau `DEFAULT_ALL_MODULES` utilisé pour la migration initiale et les boutiques actuelles ne contiendra **que** les modules opérationnels actuels (`debts`, `receipts_invoices`, `inventory`, `orders`, `expenses`, `analytics`, `team`, `multi_store`).
- Les modules futurs auront la propriété `isPlaceholder: true` dans le catalogue et ne feront jamais partie de la liste par défaut des boutiques existantes. Ils devront être explicitement activés par l'admin lorsqu'ils seront prêts.

---

## 8. Non-Régression & Alertes dans Paramètres

1. **Calculs financiers, clôture X/Z et exports :**  
   Désactiver le module `debts` ou `receipts_invoices` ne modifie aucun calcul dans `StoreContext` :
   - Les ventes à crédit déjà existantes continuent d'être incluses dans le CA total et le bénéfice net.
   - Les sessions de caisse (`cash_sessions`) continuent d'enregistrer les totaux exacts d'espèces, carte et mobile money.
   - La file hors-ligne synchronise toutes les ventes sans vérifier l'état d'affichage du module.
2. **Avertissements dans `Paramètres > Modules` :**  
   - Si l'administrateur tente de désactiver le module `debts` alors qu'il reste des créances impayées (`unpaidDebts.length > 0`), une alerte visuelle jaune s'affiche :  
     *« Attention : Votre boutique compte actuellement des créances clients non recouvrées. Désactiver ce module masquera le carnet de dettes et les relances WhatsApp, mais ne supprimera pas vos créances. »*
   - En cas de changement de formule vers le bas (downgrade), un avertissement informe l'utilisateur que les modules non inclus dans sa nouvelle formule seront masqués tout en conservant 100% de ses données en base.

---

## 9. Fichiers Concernés pour la Phase 1

1. **`src/types/modules.ts`** *(Nouveau)* : Catalogue unique des modules, clés, types, associations de formules et placeholders futurs.
2. **`src/context/AuthContext.tsx`** :
   - Ajout des champs `enabled_modules: string[]` et `business_sector: string | null` sur l'interface `Store`.
   - Fonction d'aide `isModuleActive(moduleKey: ModuleKey): boolean`.
   - Logique de repli anti-régression (fallback).
3. **`src/components/layout/Sidebar.tsx`** :
   - Rattachement de `moduleKey` aux éléments du menu.
   - Filtrage conditionnel via `isModuleActive(item.moduleKey)`.
4. **`src/components/layout/Header.tsx`** :
   - Masquage des raccourcis hauts si le module correspondant est inactif.
5. **`src/components/layout/AppWrapper.tsx`** :
   - Route guard client redirigeant vers `/` si une route rattachée à un module inactif est saisie manuellement dans l'URL.
6. **`src/app/page.tsx`** *(Dashboard)* :
   - Conditionnement des tuiles d'actions rapides et de la section "Dettes" aux modules actifs.
7. **`src/app/pos/page.tsx`** :
   - Masquage du mode de paiement "À crédit" si le module `debts` est inactif.
   - Masquage des boutons factures si `receipts_invoices` est inactif.
8. **`src/app/settings/modules/page.tsx`** *(Nouveau)* :
   - Écran de gestion des modules (admin uniquement) avec alertes, switchers et explications.
9. **`src/app/settings/page.tsx`** :
   - Raccourci vers la gestion des modules.

---

## 10. Migration SQL Transactionnelle (Non Appliquée)

```sql
BEGIN;

-- 1. Ajout additif des colonnes sur public.stores avec NOT NULL DEFAULT
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] 
NOT NULL DEFAULT ARRAY[
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store'
]::TEXT[];

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS business_sector TEXT DEFAULT NULL;

-- 2. Sécurisation rétroactive pour toutes les boutiques existantes
UPDATE public.stores 
SET enabled_modules = ARRAY[
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store'
]::TEXT[]
WHERE enabled_modules IS NULL 
   OR array_length(enabled_modules, 1) IS NULL 
   OR array_length(enabled_modules, 1) = 0;

COMMIT;
```

### Script de Retour Arrière (Rollback)
> **Ordre strict d'exécution en cas de rollback :**  
> 1. Déployer la version précédente du code frontend (ou annuler le commit git).  
> 2. Ensuite seulement, exécuter le script SQL de rollback ci-dessous sur Supabase.

```sql
BEGIN;

ALTER TABLE public.stores DROP COLUMN IF EXISTS enabled_modules;
ALTER TABLE public.stores DROP COLUMN IF EXISTS business_sector;

COMMIT;
```
