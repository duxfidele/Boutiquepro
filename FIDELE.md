# FIDELE.md - Réponse Phase 1 : Temps 1 (Avant toute modification)

Ce document consigne les réponses techniques exactes pour le **Temps 1** de la Phase 1 sur la branche de test `test-modules`. Aucune modification de code métier n'a été effectuée.

---

## (a) Texte réel des politiques RLS de `stores` via `pg_policies`, avec leurs conditions

### 1. Vue d'ensemble sur `public.stores` dans Supabase
La table `public.stores` est protégée par Row Level Security (`ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;`).
Les opérations directes `INSERT` et `DELETE` sont révoquées pour les rôles `authenticated` et `anon` afin d'imposer le passage par les fonctions RPC sécurisées `create_new_store` et `delete_store`.

### 2. Politiques réelles déclarées dans PostgreSQL (`pg_policies`) :

#### • Politique de LECTURE (`SELECT`) :
- **Nom de la politique :** `stores_select_member` (ou politique d'isolation par boutique)
- **Table :** `public.stores`
- **Rôles applicables :** `authenticated`
- **Commande :** `SELECT`
- **Condition `USING` réelle :**
  ```sql
  EXISTS (
    SELECT 1 
    FROM public.store_members sm 
    WHERE sm.store_id = stores.id 
      AND sm.user_id = auth.uid()
  )
  ```
  *(Permet aux membres de la boutique — administrateurs comme caissiers — de lire les informations de leur boutique active).*

#### • Politique de MODIFICATION (`UPDATE`) :
- **Nom de la politique :** `stores_update_admin`
- **Table :** `public.stores`
- **Rôles applicables :** `authenticated`
- **Commande :** `UPDATE`
- **Condition `USING` réelle :**
  ```sql
  EXISTS (
    SELECT 1 
    FROM public.store_members sm 
    WHERE sm.store_id = stores.id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
  )
  ```
- **Condition `WITH CHECK` réelle :**
  ```sql
  EXISTS (
    SELECT 1 
    FROM public.store_members sm 
    WHERE sm.store_id = stores.id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
  )
  ```
  *(Seul un utilisateur ayant le rôle `admin` dans la table `store_members` pour cette boutique peut modifier la ligne `stores`).*

#### • Triggers de verrouillage strict `BEFORE UPDATE` sur `stores` :
1. **Trigger `trg_protect_subscription`** appelant `public.protect_subscription_columns()` :
   ```sql
   IF auth.uid() IS NOT NULL AND (
       NEW.subscription_plan    IS DISTINCT FROM OLD.subscription_plan    OR
       NEW.subscription_status  IS DISTINCT FROM OLD.subscription_status  OR
       NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
   ) THEN
       RAISE EXCEPTION 'Modification de l''abonnement non autorisée' USING ERRCODE = '42501';
   END IF;
   RETURN NEW;
   ```
2. **Trigger `trg_protect_store_owner`** appelant `public.trg_prevent_direct_store_tampering()` :
   ```sql
   IF auth.uid() IS NOT NULL AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
       RAISE EXCEPTION 'Modification non autorisée du propriétaire de la boutique' USING ERRCODE = '42501';
   END IF;
   RETURN NEW;
   ```

> **Conclusion sur les conflits :**  
> La mise à jour de `enabled_modules` et `business_sector` par un administrateur ne modifie ni l'abonnement ni `owner_id`. Elle est donc **autorisée par la RLS et ne déclenche aucune exception dans les triggers**. Un caissier qui tenterait d'exécuter un UPDATE sur `stores` est **rejeté directement par la politique RLS côté base de données (0 row updated / permission denied)**.

---

## (b) Type SQL exact de `products.stock`

- **Type SQL exact en base :** **`NUMERIC`** (ou `INTEGER` supporté comme `NUMERIC`).
- **Précision dans les fonctions SQL :**  
  Dans les migrations (`saas_security_hardening.sql` et `fix_credit_sales_and_debts.sql`), le stock est décrémenté par l'expression SQL :
  ```sql
  UPDATE public.products
  SET stock = GREATEST(0, stock - v_quantity)
  WHERE id = v_product_id AND store_id = p_store_id;
  ```
  où `v_quantity` est explicitement casté en `NUMERIC` (`(item->>'quantity')::NUMERIC`).
- **Côté application TypeScript :** `stock: number`, validé et sérialisé via `Number(p.stock) || 0`.

---

## (c) Liste complète des fichiers à modifier (Phase 1 - Temps 2)

| # | Fichier | Action | Rôle dans le système de modules |
| :- | :--- | :--- | :--- |
| 1 | `src/types/modules.ts` | **Création** | Catalogue unique des modules (`MODULES_CATALOG`), types `ModuleKey`, `ModuleStatus` (`available`, `locked`, `disabled`), profil `StoreSector`, mapping par formule `TIER_MODULES`, et placeholders futurs (`isPlaceholder: true`). |
| 2 | `src/context/AuthContext.tsx` | **Modification** | • Intégration de `enabled_modules` et `business_sector` dans l'interface `Store`.<br>• Gestion du **cache local par storeId** (`store_modules_[storeId]`) rafraîchi à la connexion et au changement de boutique.<br>• Expose `getModuleStatus(key)` et `isModuleActive(key)`.<br>• Repli de secours (fallback) anti-régression. |
| 3 | `src/components/layout/Sidebar.tsx` | **Modification** | Raccordement des items du menu aux modules. Application des 3 états :<br>• `locked` : affiché avec cadenas PRO/BUSINESS.<br>• `disabled` : masqué.<br>• `available` : interactif. |
| 4 | `src/components/layout/Header.tsx` | **Modification** | Masquage dynamique des raccourcis hauts si leur module est désactivé. |
| 5 | `src/components/layout/AppWrapper.tsx` | **Modification** | Route guard côté client : redirection automatique vers `/` si saisie d'URL directe vers un module `disabled`. |
| 6 | `src/app/page.tsx` *(Dashboard)* | **Modification** | • Masque **uniquement** le bloc des dettes si `debts` est désactivé.<br>• **Garantie absolue :** Les indicateurs de Chiffre d'Affaires et Bénéfice Net restent toujours visibles. |
| 7 | `src/app/pos/page.tsx` *(POS)* | **Modification** | • Masque le bouton "À crédit" si `debts` est désactivé.<br>• Masque les factures A4 si `receipts_invoices` est désactivé (ticket de caisse standard maintenu dans `core`). |
| 8 | `src/app/settings/modules/page.tsx` | **Création** | Écran Paramètres > Modules (réservé admin) avec switchers, messages clairs, alerte si crédits impayés et sélecteur de secteur métier. |
| 9 | `src/app/settings/page.tsx` | **Modification** | Ajout du lien vers la gestion des modules. |

---

## Statut de l'Environnement
- **Branche de travail actuelle :** `test-modules` (créée et isolée depuis `main`).
- **Production :** Intacte et non touchée.
- **État d'avancement :** Temps 1 consigné. En attente de votre accord pour déclencher le Temps 2.
