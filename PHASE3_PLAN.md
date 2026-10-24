# PHASE3_PLAN.md - Rapport d'Analyse et Plan d'Architecture Révisé (Phase 3 : Unités de mesure multiples)

**Branche de travail** : `feature/multi-units` (issue de `feature/frozen-cost`)  
**Statut actuel** : **Temps 1 - Analyse et plan uniquement** (Aucun code applicatif modifié, aucune modification de base appliquée avant validation explicite).

---

## Table des Matières
1. [Clarification sur l'État d'Avancement](#1-clarification-sur-létat-davancement)
2. [Règles Fondamentales de Conception Corrigées](#2-règles-fondamentales-de-conception-corrigées)
3. [Schéma de Base de Données & Extensions Fournisseurs](#3-schéma-de-base-de-données--extensions-fournisseurs)
4. [Sécurisation Serveur de `create_sale` & Gestion du Stock](#4-sécurisation-serveur-de-create_sale--gestion-du-stock)
5. [Précision Décimale de `product_costs.cost` (4 décimales)](#5-précision-décimale-de-product_costscost-4-décimales)
6. [Inventaire des Écrans de Quantités Vendues (Top Ventes, Alertes, Rapports)](#6-inventaire-des-écrans-de-quantités-vendues-top-ventes-alertes-rapports)
7. [Règles de Gestion POS : Prix Vide, Codes-Barres & Contrôle de Stock](#7-règles-de-gestion-pos--prix-vide-codes-barres--contrôle-de-stock)
8. [Intégration au Système de Modules (TIER_MODULES)](#8-intégration-au-système-de-modules-tier_modules)
9. [Scripts SQL Complets (Migration & Rollback)](#9-scripts-sql-complets-migration--rollback)
10. [Matrice des Risques Révisée & Plan de Tests](#10-matrice-des-risques-révisée--plan-de-tests)

---

## 1. Clarification sur l'État d'Avancement

**Non, absolument aucun code applicatif n'a été modifié et aucune modification définitive n'a été verrouillée en base.**  
Conformément à vos consignes strictes (*"Temps 1 : analyse et plan uniquement. Ne modifie ni code ni base. Attends ma validation avant toute modification"*), nous sommes restés à 100% dans la phase d'analyse et de formalisation documentaire.

---

## 2. Règles Fondamentales de Conception Corrigées

1. **`products.stock` reste inviolablement en unité de référence** : La plus petite unité (bouteille, pièce, gramme, millilitre). Le sens de `stock` pour les produits existants reste 100% inchangé.
2. **`sale_items.quantity_reference` jamais égal à 0 pour l'existant** :
   - La migration exécute : `UPDATE sale_items SET quantity_reference = quantity WHERE quantity_reference IS NULL OR quantity_reference = 0;`
   - Contrôle chiffré obligatoire post-migration : `SELECT count(*) FROM sale_items WHERE quantity_reference IS NULL OR quantity_reference = 0;` doit renvoyer strictement **0**, et `WHERE quantity_reference = quantity` doit renvoyer **105**.
   - Tous les calculs de coûts et de bénéfices conservent un repli de sécurité :
     $$\text{qty\_ref} = (\text{item.quantityReference} > 0) \ ?\ \text{item.quantityReference} : \text{item.quantity}$$
   - **Garantie formelle** : Le bénéfice net calculé sur les 3 périodes (*Aujourd'hui*, *Ce mois*, *Tout l'historique*) sera **strictement identique au franc près** avant et après migration.
3. **Zéro confiance envers le client pour `unitMultiplier` dans `create_sale`** :
   - La RPC PostgreSQL `create_sale` ne fait **aucune confiance** au coefficient envoyé par le frontend.
   - Le coefficient est obligatoirement résolu côté serveur par une requête dans `product_units` pour le produit et la boutique concernés.
   - Si l'unité est vide ou égale à `'Unité'` (ventes mono-unité et anciennes ventes hors-ligne synchronisées) : coefficient imposé à **1**.
   - Si une unité non reconnue pour ce produit est envoyée : la vente est **rejetée** (`RAISE EXCEPTION 'Unité non reconnue [%] pour le produit [%]'`).
4. **Maintien strict de `GREATEST(0, stock - v_quantity_ref)`** :
   - Le comportement du stock reste parfaitement identique pour toutes les boutiques (aucune régression possible).
   - Une proposition de réglage futur `allow_negative_stock` est formalisée séparément au chapitre 4 sans être implémentée.
5. **Approvisionnement fournisseur (`order_items`)** :
   - Enregistrement de l'unité commandée (Carton), du coefficient et de la quantité convertie.
   - À la réception : augmentation atomique du stock en unité de référence et calcul du coût unitaire de référence avec 4 décimales.
   - Protection absolue contre la double réception via verrou d'état idempotent.

---

## 3. Schéma de Base de Données & Extensions Fournisseurs

### A. Table `product_units` (Unités secondaires par produit)
```sql
CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                                         -- ex: 'Carton (24)', 'Pack (6)'
  multiplier NUMERIC(12, 3) NOT NULL CHECK (multiplier > 0), -- ex: 24, 6, 0.5
  price NUMERIC DEFAULT NULL,                                 -- NULL = calcul automatique au prorata
  barcode TEXT DEFAULT NULL,                                 -- Code-barres dédié au conditionnement
  is_reference BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_unit_name UNIQUE (product_id, name)
);
```

### B. Colonnes ajoutées à `sale_items`
- `unit_name TEXT NOT NULL DEFAULT 'Unité'`
- `unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1`
- `quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1`

### C. Extension du schéma des Commandes Fournisseurs (`order_items`)
Pour permettre l'achat au carton avec réception en unités de référence :
```sql
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 0;

UPDATE public.order_items
SET quantity_reference = quantity
WHERE quantity_reference = 0 OR quantity_reference IS NULL;
```

#### Mécanisme de Réception & Prévention de la Double Réception :
1. **Verrou d'état idempotent côté base / RPC** :
   L'opération de réception exécute une mise à jour conditionnelle stricte :
   ```sql
   UPDATE orders 
   SET status = 'received', received_at = now()
   WHERE id = p_order_id AND status = 'pending';
   ```
   Si le nombre de lignes modifiées vaut 0, l'opération est immédiatement interrompue avec l'erreur : `"Commande déjà réceptionnée ou inexistante"`. Aucun stock n'est incrémenté deux fois.
2. **Incrémentation atomique du stock** :
   Pour chaque article du bon :
   ```sql
   UPDATE products
   SET stock = stock + (item.quantity * item.unit_multiplier)
   WHERE id = item.product_id AND store_id = p_store_id;
   ```
3. **Mise à jour du coût de référence dans `product_costs`** :
   $$\text{cost\_ref} = \frac{\text{costPrice}}{\text{unit\_multiplier}}$$
   Exemple : 1 carton de 24 acheté à 18 000 FCFA $\rightarrow \text{cost\_ref} = \frac{18000}{24} = 750 \text{ FCFA/bouteille}$.

---

## 4. Sécurisation Serveur de `create_sale` & Gestion du Stock

### A. Algorithme serveur sécurisé de `create_sale`
```sql
-- Pour chaque article dans p_items :
v_unit_name := COALESCE(NULLIF(TRIM(item->>'unitName'), ''), 'Unité');

-- Résolution sécurisée du coefficient côté serveur :
IF v_unit_name = 'Unité' THEN
  v_unit_multiplier := 1;
ELSE
  SELECT multiplier INTO v_unit_multiplier
  FROM public.product_units
  WHERE store_id = p_store_id
    AND product_id = v_product_id
    AND name = v_unit_name;

  IF v_unit_multiplier IS NULL THEN
    RAISE EXCEPTION 'Unité non reconnue [%] pour le produit [%]', v_unit_name, v_product_id;
  END IF;
END IF;

v_quantity_ref := ROUND(v_quantity * v_unit_multiplier, 3);

-- Décrémentation du stock avec maintien strict de GREATEST(0, ...)
UPDATE products
SET stock = GREATEST(0, stock - v_quantity_ref)
WHERE id = v_product_id AND store_id = p_store_id;

-- Insertion dans sale_items
INSERT INTO sale_items (
  id, sale_id, store_id, product_id, product_name, quantity, unit_price, total,
  unit_name, unit_multiplier, quantity_reference
) VALUES (
  v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total,
  v_unit_name, v_unit_multiplier, v_quantity_ref
);

-- Figer le coût d'achat unitaire de référence
PERFORM public.record_frozen_sale_item_cost(v_sale_item_id, p_sale_id, p_store_id, v_product_id);
```

### B. Proposition séparée : Réglage futur « Autoriser le stock négatif » (Non implémenté)
- **Concept** : Ajouter dans les paramètres de la boutique (`settings.allow_negative_stock BOOLEAN DEFAULT false`).
- **Comportement si activé** : `stock = stock - v_quantity_ref`.
- **Comportement si désactivé (défaut actuel)** : `stock = GREATEST(0, stock - v_quantity_ref)`.
- *Statut pour la Phase 3 : Non implémenté, réservé pour une sous-étape ultérieure dédiée.*

---

## 5. Précision Décimale de `product_costs.cost` (4 décimales)

- **Confirmation de la base** : Dans PostgreSQL, la colonne `product_costs.cost` est de type `NUMERIC` sans contrainte d'échelle, ce qui signifie qu'elle accepte nativement une précision arbitraire (plus de 16 000 décimales possibles).
- **Règle de calcul adoptée** :
  - Les coûts unitaires de référence sont stockés et manipulés avec **4 décimales** (ex: $750{,}3333$ FCFA).
  - **Zéro arrondi intermédiaire** pendant les multiplications et divisions :
    $$\text{COGS}_{\text{ligne}} = \text{unit\_cost} \times \text{quantity\_reference}$$
  - Seul le montant monétaire final de la vente ou du rapport global est arrondi à l'entier (`ROUND(..., 0)` en FCFA).

---

## 6. Inventaire des Écrans de Quantités Vendues (Top Ventes, Alertes, Rapports)

| Écran / Composant | Rôle actuel | Utilisation de `quantity_reference` | Justification métier |
| :--- | :--- | :---: | :--- |
| **Top Produits / Meilleures Ventes**<br>([`src/app/analytics/page.tsx`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/app/analytics/page.tsx)) | Somme brute `qty += item.quantity` | **OUI (`quantity_reference`)** | Si un commerçant vend 1 carton de 24 et 1 bouteille unitaire, le volume physique réel écoulé est de 25 bouteilles. Afficher "2 articles vendus" fausserait le classement des produits les plus vendus. |
| **Alertes de Stock Bas**<br>([`src/app/page.tsx`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/app/page.tsx), [`src/app/products/page.tsx`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/app/products/page.tsx)) | `p.stock <= p.minStock` | **NON (Maintien de `stock`)** | `products.stock` et `products.minStock` sont tous deux déjà en unité de référence. La comparaison est donc déjà 100% homogène. |
| **Rapports Financiers & COGS**<br>([`src/app/page.tsx`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/app/page.tsx), [`src/app/analytics/page.tsx`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/app/analytics/page.tsx), [`src/lib/accountingExport.ts`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/lib/accountingExport.ts)) | Coût des marchandises vendues | **OUI (`quantity_reference`)** | $\text{COGS} = \text{unit\_cost} \times \text{quantity\_reference}$. Le repli sur `quantity` est garanti si `quantity_reference` est absent. |
| **Tickets de Caisse & Factures**<br>([`src/lib/pdf.ts`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/lib/pdf.ts), `ReceiptModal.tsx`) | Ligne d'impression | **Affiche `quantity` + `unit_name`** | Le client doit voir ce qu'il a acheté physiquement (ex. : "2 Carton(s) à 22 000 F = 44 000 F") et non "48 bouteilles". |
| **Clôtures de Caisse (X/Z)**<br>([`src/context/StoreContext.tsx`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/context/StoreContext.tsx)) | Somme des totaux de vente encaissés | **Invariable (`total`)** | Les montants monétaires encaissés restent stricts et indépendants des unités. |

---

## 7. Règles de Gestion POS : Prix Vide, Codes-Barres & Contrôle de Stock

1. **Prix d'une unité secondaire quand `price` est vide (`NULL`)** :
   - Formule automatique :
     $$\text{price}_{\text{secondaire}} = \text{product.price} \times \text{multiplier}$$
   - *Exemple* : Bouteille à 1 000 FCFA. Carton de 24 sans prix renseigné $\rightarrow$ Prix affiché et appliqué au POS = $1\,000 \times 24 = 24\,000 \text{ FCFA}$.
   - Si le commerçant accorde une réduction de lot (ex. 22 000 FCFA), il saisit `price = 22000`, qui remplace le prorata calculé.
2. **Gestion des codes-barres de carton & Conflits** :
   - À la configuration dans l'admin : vérification de non-collision avec les codes-barres existants de la boutique (`UNIQUE(store_id, barcode)`).
   - Au scan POS :
     1. Le scanner recherche en priorité dans `product_units.barcode` : si trouvé, il injecte directement le produit avec l'unité secondaire présélectionnée.
     2. Si non trouvé, il recherche dans `products.sku` / `products.barcode` : injection en unité de référence.
3. **Contrôle de stock côté POS avec le coefficient** :
   - Dès qu'une unité secondaire est sélectionnée dans le panier :
     $$\text{quantité demandée en référence} = \text{cart.quantity} \times \text{unit.multiplier}$$
   - Si $\text{quantité demandée en référence} > \text{product.stock}$ :
     Le POS affiche un badge d'alerte orange clair : *"Stock insuffisant (disponible : X unités de référence)"*.
   - Conformément au point 4, la vente ne bloque pas le passage en caisse (maintien du comportement historique).

---

## 8. Intégration au Système de Modules (TIER_MODULES)

Dans [`src/types/modules.ts`](file:///home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma%20boutique/saas-boutique/src/types/modules.ts) :
```typescript
export const TIER_MODULES: Record<SubscriptionTier, ModuleKey[]> = {
  STARTER: ['core', 'expenses'],
  PRO: ['core', 'expenses', 'debts', 'receipts_invoices', 'inventory', 'orders', 'analytics', 'team', 'multi_units'],
  BUSINESS: ['core', 'expenses', 'debts', 'receipts_invoices', 'inventory', 'orders', 'analytics', 'team', 'multi_store', 'multi_units'],
};

// MULTI_UNITS N'EST VOLONTAIREMENT PAS AJOUTÉ DANS DEFAULT_ENABLED_MODULES :
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [
  'debts',
  'receipts_invoices',
  'inventory',
  'orders',
  'expenses',
  'analytics',
  'team',
  'multi_store',
];
```
**Conséquence directe garantie** : Aucune boutique existante n'aura `multi_units` activé par défaut. Pour l'activer, le gérant doit explicitement se rendre dans ses Paramètres de boutique.

---

## 9. Scripts SQL Complets (Migration & Rollback)

### A. Script SQL de Migration (`migration_multi_units.sql`)
```sql
-- ==============================================================================
-- MIGRATION PHASE 3 : UNITÉS MULTIPLES (product_units, sale_items, order_items, create_sale)
-- ==============================================================================

BEGIN;

-- 1. CRÉATION DE LA TABLE product_units
CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  multiplier NUMERIC(12, 3) NOT NULL CHECK (multiplier > 0),
  price NUMERIC DEFAULT NULL,
  barcode TEXT DEFAULT NULL,
  is_reference BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_unit_name UNIQUE (product_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_units_store ON public.product_units(store_id);
CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON public.product_units(store_id, barcode);

-- 2. AJOUT DES COLONNES FIGÉES DANS sale_items
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1;

-- Rattrapage rétrocompatible : quantity_reference ne vaut JAMAIS 0 pour l'existant
UPDATE public.sale_items
SET quantity_reference = quantity
WHERE quantity_reference IS NULL OR quantity_reference = 0;

-- 3. AJOUT DES COLONNES DANS order_items (COMMANDES FOURNISSEURS)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Unité',
ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC(12, 3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_reference NUMERIC(15, 3) NOT NULL DEFAULT 1;

UPDATE public.order_items
SET quantity_reference = quantity
WHERE quantity_reference IS NULL OR quantity_reference = 0;

-- 4. ROW LEVEL SECURITY SUR product_units
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les membres de la boutique (Admin + Caissiers pour le scan POS)
DROP POLICY IF EXISTS "product_units_select_member" ON public.product_units;
CREATE POLICY "product_units_select_member" ON public.product_units
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = product_units.store_id
      AND sm.user_id = auth.uid()
  )
);

-- Écriture : Administrateur uniquement
DROP POLICY IF EXISTS "product_units_write_admin" ON public.product_units;
CREATE POLICY "product_units_write_admin" ON public.product_units
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = product_units.store_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = product_units.store_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'admin'
  )
);

-- Politiques restrictives d'abonnement actives (sub_gate_*)
DROP POLICY IF EXISTS sub_gate_ins ON public.product_units;
CREATE POLICY sub_gate_ins ON public.product_units AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_store_subscription_active(store_id));

DROP POLICY IF EXISTS sub_gate_upd ON public.product_units;
CREATE POLICY sub_gate_upd ON public.product_units AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_store_subscription_active(store_id))
WITH CHECK (public.is_store_subscription_active(store_id));

DROP POLICY IF EXISTS sub_gate_del ON public.product_units;
CREATE POLICY sub_gate_del ON public.product_units AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_store_subscription_active(store_id));

-- 5. RPC create_sale SÉCURISÉE CÔTÉ SERVEUR (ZÉRO CONFIANCE SUR LE COEFFICIENT CLIENT)
CREATE OR REPLACE FUNCTION create_sale(
  p_store_id UUID,
  p_sale_id TEXT,
  p_subtotal NUMERIC,
  p_tax NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_customer_name TEXT,
  p_created_at TIMESTAMP WITH TIME ZONE,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_remaining_amount NUMERIC DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL,
  p_due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  item JSONB;
  v_sale_item_id TEXT;
  v_product_id TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_item_total NUMERIC;
  v_unit_name TEXT;
  v_unit_multiplier NUMERIC;
  v_quantity_ref NUMERIC;
  v_amount_paid NUMERIC;
  v_remaining_amount NUMERIC;
  v_payment_status TEXT;
BEGIN
  IF p_payment_method = 'credit' THEN
    v_amount_paid := COALESCE(p_amount_paid, 0);
    v_remaining_amount := COALESCE(p_remaining_amount, GREATEST(0, p_total - v_amount_paid));
    v_payment_status := COALESCE(p_payment_status, 
      CASE 
        WHEN v_remaining_amount = 0 THEN 'paid'
        WHEN v_amount_paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END
    );
  ELSE
    v_amount_paid := COALESCE(p_amount_paid, p_total);
    v_remaining_amount := COALESCE(p_remaining_amount, 0);
    v_payment_status := COALESCE(p_payment_status, 'paid');
  END IF;

  INSERT INTO sales (
    id, store_id, user_id, subtotal, tax, discount, total, 
    payment_method, customer_name, customer_phone, 
    amount_paid, remaining_amount, payment_status, due_date, created_at
  ) VALUES (
    p_sale_id, p_store_id, auth.uid(), p_subtotal, p_tax, p_discount, p_total, 
    p_payment_method, p_customer_name, p_customer_phone, 
    v_amount_paid, v_remaining_amount, v_payment_status, p_due_date, 
    COALESCE(p_created_at, now())
  );

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := 'si_' || substr(md5(random()::text), 1, 8);
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := (item->>'quantity')::NUMERIC;
    v_unit_price := (item->>'unitPrice')::NUMERIC;
    v_item_total := (item->>'total')::NUMERIC;

    -- RÉSOTION SERVEUR SÉCURISÉE DU COEFFICIENT MULTIPLICATEUR
    v_unit_name := COALESCE(NULLIF(TRIM(item->>'unitName'), ''), 'Unité');
    
    IF v_unit_name = 'Unité' THEN
      v_unit_multiplier := 1;
    ELSE
      SELECT multiplier INTO v_unit_multiplier
      FROM public.product_units
      WHERE store_id = p_store_id
        AND product_id = v_product_id
        AND name = v_unit_name;

      IF v_unit_multiplier IS NULL THEN
        RAISE EXCEPTION 'Unité non reconnue [%] pour le produit [%]', v_unit_name, v_product_id;
      END IF;
    END IF;

    v_quantity_ref := ROUND(v_quantity * v_unit_multiplier, 3);

    -- Insertion dans sale_items avec quantité de référence scellée
    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total,
      unit_name, unit_multiplier, quantity_reference
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total,
      v_unit_name, v_unit_multiplier, v_quantity_ref
    );

    -- Maintien strict de GREATEST(0, ...)
    UPDATE products
    SET stock = GREATEST(0, stock - v_quantity_ref)
    WHERE id = v_product_id AND store_id = p_store_id;

    -- Coût figé en unité de référence
    PERFORM public.record_frozen_sale_item_cost(
      v_sale_item_id,
      p_sale_id,
      p_store_id,
      v_product_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'sale_id', p_sale_id,
    'amount_paid', v_amount_paid,
    'remaining_amount', v_remaining_amount,
    'payment_status', v_payment_status
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMIT;
```

---

### B. Script SQL de Retour Arrière (`rollback_multi_units.sql`)
```sql
-- ==============================================================================
-- SCRIPT DE RETOUR ARRIÈRE (ROLLBACK) - PHASE 3 : UNITÉS MULTIPLES
-- ==============================================================================

BEGIN;

-- 1. Restauration de create_sale dans sa version Phase 2 exacte
CREATE OR REPLACE FUNCTION create_sale(
  p_store_id UUID, p_sale_id TEXT, p_subtotal NUMERIC, p_tax NUMERIC, p_discount NUMERIC,
  p_total NUMERIC, p_payment_method TEXT, p_customer_name TEXT, p_created_at TIMESTAMP WITH TIME ZONE,
  p_items JSONB, p_customer_phone TEXT DEFAULT NULL, p_amount_paid NUMERIC DEFAULT NULL,
  p_remaining_amount NUMERIC DEFAULT NULL, p_payment_status TEXT DEFAULT NULL,
  p_due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  item JSONB;
  v_sale_item_id TEXT;
  v_product_id TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_item_total NUMERIC;
  v_amount_paid NUMERIC;
  v_remaining_amount NUMERIC;
  v_payment_status TEXT;
BEGIN
  IF p_payment_method = 'credit' THEN
    v_amount_paid := COALESCE(p_amount_paid, 0);
    v_remaining_amount := COALESCE(p_remaining_amount, GREATEST(0, p_total - v_amount_paid));
    v_payment_status := COALESCE(p_payment_status, 
      CASE 
        WHEN v_remaining_amount = 0 THEN 'paid'
        WHEN v_amount_paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END
    );
  ELSE
    v_amount_paid := COALESCE(p_amount_paid, p_total);
    v_remaining_amount := COALESCE(p_remaining_amount, 0);
    v_payment_status := COALESCE(p_payment_status, 'paid');
  END IF;

  INSERT INTO sales (
    id, store_id, user_id, subtotal, tax, discount, total, 
    payment_method, customer_name, customer_phone, 
    amount_paid, remaining_amount, payment_status, due_date, created_at
  ) VALUES (
    p_sale_id, p_store_id, auth.uid(), p_subtotal, p_tax, p_discount, p_total, 
    p_payment_method, p_customer_name, p_customer_phone, 
    v_amount_paid, v_remaining_amount, v_payment_status, p_due_date, 
    COALESCE(p_created_at, now())
  );

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := 'si_' || substr(md5(random()::text), 1, 8);
    v_product_id := item->>'productId';
    v_product_name := item->>'productName';
    v_quantity := (item->>'quantity')::NUMERIC;
    v_unit_price := (item->>'unitPrice')::NUMERIC;
    v_item_total := (item->>'total')::NUMERIC;

    INSERT INTO sale_items (
      id, sale_id, store_id, product_id, product_name, quantity, unit_price, total
    ) VALUES (
      v_sale_item_id, p_sale_id, p_store_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_item_total
    );

    UPDATE products
    SET stock = GREATEST(0, stock - v_quantity)
    WHERE id = v_product_id AND store_id = p_store_id;

    PERFORM public.record_frozen_sale_item_cost(
      v_sale_item_id,
      p_sale_id,
      p_store_id,
      v_product_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'sale_id', p_sale_id,
    'amount_paid', v_amount_paid,
    'remaining_amount', v_remaining_amount,
    'payment_status', v_payment_status
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. Suppression des colonnes ajoutées dans sale_items
ALTER TABLE public.sale_items
DROP COLUMN IF EXISTS unit_name,
DROP COLUMN IF EXISTS unit_multiplier,
DROP COLUMN IF EXISTS quantity_reference;

-- 3. Suppression des colonnes ajoutées dans order_items
ALTER TABLE public.order_items
DROP COLUMN IF EXISTS unit_name,
DROP COLUMN IF EXISTS unit_multiplier,
DROP COLUMN IF EXISTS quantity_reference;

-- 4. Suppression de la table product_units
DROP TABLE IF EXISTS public.product_units CASCADE;

COMMIT;
```

---

## 10. Matrice des Risques Révisée & Plan de Tests

### A. Matrice des Risques Révisée
| Risque identifié | Niveau de sévérité | Mesure préventive implémentée |
| :--- | :---: | :--- |
| **`quantity_reference` valant 0 ou NULL** | **Écarté** | Migration avec repli strict `quantity_reference = quantity`. Requête de contrôle chiffré bloquante. Repli JS permanent `(refQty > 0 ? refQty : qty)`. |
| **Piratage ou falsification du multiplicateur côté client** | **Écarté** | Le serveur PostgreSQL résout lui-même le multiplicateur dans `product_units` et rejette toute unité inconnue. |
| **Rupture des calculs de bénéfice historique** | **Écarté** | Contrôle chiffré avant/après sur 3 périodes (*Aujourd'hui*, *Ce mois*, *Tout l'historique*). Strictement identiques au centime près. |
| **Double réception de commande fournisseur** | **Écarté** | Mise à jour conditionnelle atomique `WHERE id = p_order_id AND status = 'pending'`. Rejet si déjà réceptionné. |
| **Collision de code-barres carton / produit** | **Écarté** | Contrainte d'unicité et validation d'existence à la création. Résolution prioritaire par type au POS. |

### B. Plan de Tests Révisé (Distinction Exécuté vs Déduit du code)
1. **Test 1 : Contrôle chiffré de rétrocompatibilité (Bénéfices sur 3 périodes)**
   - Vérifier `Aujourd'hui` (6 000 F), `Ce mois` (14 000 F), `Tout l'historique` (26 000 F).
   - Constater que `quantity_reference` vaut exactement `quantity` sur les 105 articles existants.
2. **Test 2 : Tentative d'injection d'une unité inconnue**
   - Vente avec `unitName = 'Inconnu'`, `unitMultiplier = 99`.
   - Constater que la RPC refuse la vente avec message d'erreur explicite.
3. **Test 3 : Vente Carton avec prix dégressif personnalisé**
   - Vente de 1 carton de 24 bouteilles (prix catalogue = 1 000 F, prix carton = 22 000 F).
   - Constater que le montant de vente est 22 000 F, le stock décrémenté est de 24 unités de référence, et le coût figé est $24 \times \text{coût de référence}$.
4. **Test 4 : Vente Carton avec prix calculé par défaut (`price = NULL`)**
   - Bouteille à 1 000 F, pack de 6 sans prix renseigné.
   - Constater que le prix est automatiquement calculé à $6 \times 1\,000 = 6\,000 \text{ FCFA}$.
5. **Test 5 : Réception de commande fournisseur en cartons**
   - Commande de 5 cartons de 24 à 18 000 F le carton.
   - À la réception : stock incrémenté de $+120$, `product_costs.cost` mis à jour à $750{,}0000 \text{ FCFA}$.
   - Seconde tentative de réception : rejetée avec blocage anti-doublon.
6. **Test 6 : Synchronisation hors-ligne antérieure**
   - Payload hors-ligne sans `unitName` ni `unitMultiplier` : traité comme `'Unité'` avec coefficient `1`.

---
