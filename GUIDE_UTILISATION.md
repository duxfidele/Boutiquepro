# 📘 Guide d'Utilisation Officiel - MaBoutiquePro

Bienvenue dans le guide d'utilisation complet de **MaBoutiquePro**, votre solution de gestion commerciale et de point de vente (POS) moderne, sécurisée et adaptée aux commerces en Afrique.

---

## 📑 Sommaire
1. [Prise en Main & Rôles d'Accès](#1-prise-en-main--rôles-daccès)
2. [Le Cycle Quotidien de la Caisse (Point de Vente)](#2-le-cycle-quotidien-de-la-caisse-point-de-vente)
   - [Étape 1 : Ouverture de caisse du matin](#étape-1--ouverture-de-caisse-du-matin)
   - [Étape 2 : Encaissement des ventes au comptant](#étape-2--encaissement-des-ventes-au-comptant)
   - [Étape 3 : Enregistrement d'une vente à crédit](#étape-3--enregistrement-dune-vente-à-crédit)
   - [Étape 4 : Point d'étape en journée (Rapport X)](#étape-4--point-détape-en-journée-rapport-x)
   - [Étape 5 : Clôture certifiée de fin de shift (Rapport Z)](#étape-5--clôture-certifiée-de-fin-de-shift-rapport-z)
3. [Le Carnet de Dettes & Recouvrement des Créances](#3-le-carnet-de-dettes--recouvrement-des-créances)
   - [Suivi des impayés et alertes de retard](#suivi-des-impayés-et-alertes-de-retard)
   - [Enregistrement d'un versement (remboursement)](#enregistrement-dun-versement-remboursement)
   - [Quittance officielle de paiement](#quittance-officielle-de-paiement)
   - [Relance WhatsApp en 1 clic (+228)](#relance-whatsapp-en-1-clic-228)
4. [Le Tableau de Bord & le Calendrier d'Analyse](#4-le-tableau-de-bord--le-calendrier-danalyse)
   - [Les 4 indicateurs financiers fondamentaux](#les-4-indicateurs-financiers-fondamentaux)
   - [Voyager dans le temps avec le Sélecteur Calendrier](#voyager-dans-le-temps-avec-le-sélecteur-calendrier)
5. [Gestion des Produits & Confidentialité des Prix d'Achat](#5-gestion-des-produits--confidentialité-des-prix-dachat)
   - [Ajout manuel & protection du coût d'achat](#ajout-manuel--protection-du-coût-dachat)
   - [Importation massive par fichier Excel / CSV](#importation-massive-par-fichier-excel--csv)
6. [Gestion de l'Équipe & des Caissiers](#6-gestion-de-léquipe--des-caissiers)
7. [Dépenses & Exports Comptables](#7-dépenses--exports-comptables)

---

## 1. Prise en Main & Rôles d'Accès

L'application distingue deux niveaux d'accès strictement sécurisés :

| Fonctionnalité | 👑 Administrateur / Gérant | 👤 Caissier / Vendeur |
| :--- | :---: | :---: |
| **Point de Vente (POS) & Ventes** | ✅ Oui | ✅ Oui |
| **Ouverture / Clôture de Caisse (Rapport Z)** | ✅ Oui | ✅ Oui |
| **Carnet de Dettes & Recouvrement** | ✅ Oui | ✅ Oui |
| **Prix d'Achat des articles (`cost`)** | ✅ Visible & Modifiable | 🔒 Masqué à 100% |
| **Bénéfice Net Réel & Marges de la boutique** | ✅ Visible | 🔒 Masqué |
| **Création / Modification d'articles en stock** | ✅ Oui | ❌ Non |
| **Dépenses du magasin, Équipe, Paramètres** | ✅ Accès total | ❌ Redirection |

---

## 2. Le Cycle Quotidien de la Caisse (Point de Vente)

### Étape 1 : Ouverture de caisse du matin
1. Rendez-vous sur l'onglet **Point de Vente** (`/pos`).
2. Si la caisse est fermée, le système vous invite à ouvrir la session :
   - Saisissez votre **Fond de caisse initial** (ex : *10 000 FCFA* qui se trouvent déjà dans le tiroir pour faire la monnaie).
   - Indiquez le nom du caissier.
   - Cliquez sur **Ouvrir la caisse**.
3. Le bandeau supérieur vert affiche désormais : `Caisse Active` avec le fond initial et le montant en direct.

---

### Étape 2 : Encaissement des ventes au comptant
1. Cliquez sur les articles ou scannez leur code-barres pour les ajouter au panier à droite.
2. Ajustez la quantité avec `+` ou `-` si nécessaire.
3. Choisissez le mode de paiement :
   - **Espèces :** Indiquez le montant remis par le client (ex : *5 000 FCFA* pour un total de *3 500 FCFA*). Le système calcule immédiatement la monnaie à rendre (*1 500 FCFA*).
   - **Mobile Money :** (T-Money, Moov, Wave, etc.) pour paiement électronique.
   - **Carte bancaire :** Pour paiement TPE.
4. Cliquez sur **Valider la vente** :
   - Le stock diminue instantanément.
   - Le ticket de caisse s'affiche avec option d'impression thermique 80mm ou téléchargement PDF.
   - Les espèces entrent immédiatement dans le cumul de votre tiroir.

---

### Étape 3 : Enregistrement d'une vente à crédit
1. Remplissez le panier normalement.
2. Sélectionnez le mode **À crédit (Dette)** :
   - **Nom du client :** Obligatoire (choisissez un client existant ou tapez son nom).
   - **Téléphone du client :** Renseignez son numéro (ex : *90 12 34 56*).
   - **Acompte versé aujourd'hui :** Si le client verse une avance (ex : *20 000 FCFA* sur un total de *34 000 FCFA*).
   - **Date d'échéance convenue :** Date limite pour le règlement du reste dû.
3. Validez la vente :
   - L'acompte (*20 000 FCFA*) entre **directement dans votre tiroir-caisse physique**.
   - Le reste dû (*14 000 FCFA*) est automatiquement inscrit dans le **Carnet de Dettes**.
   - Le client reçoit un ticket mentionnant le montant total, l'acompte versé et le reste à payer.

---

### Étape 4 : Point d'étape en journée (Rapport X)
À tout moment de la journée, sans fermer la caisse, vous pouvez cliquer sur le bouton **Point d'étape (Rapport X)** dans le bandeau supérieur pour vérifier :
- Le fond initial,
- Le total des ventes espèces, acomptes et règlements,
- Le montant théorique exact qui doit être présent dans le tiroir.

---

### Étape 5 : Clôture certifiée de fin de shift (Rapport Z)
En fin de journée ou lors d'un changement d'équipe :
1. Cliquez sur **Clôturer la caisse (Rapport Z)**.
2. La fenêtre récapitule la formule comptable exacte :
   - **Fond initial :** 10 000 FCFA
   - **+ Ventes Espèces (Comptant) :** Montant des ventes directes
   - **+ Acomptes Ventes à Crédit (Espèces) :** Avances versées aujourd'hui
   - **+ Recouvrements Dettes (Espèces) :** Dettes remboursées aujourd'hui
   - **= Espèces Théoriques Attendues dans le tiroir** (ex : *44 000 FCFA*).
3. **Comptage physique :**
   - Comptez physiquement l'argent réel présent dans votre tiroir (billets et pièces).
   - Saisissez le montant compté dans le champ **Espèces réelles comptées**.
4. **Contrôle automatique de l'écart :**
   - **Écart = 0 FCFA :** Caisse parfaitement juste !
   - **Écart négatif (ex : -500 FCFA) :** Manquant de caisse détecté. Le caissier peut saisir une observation explicative.
   - **Écart positif (ex : +200 FCFA) :** Excédent de caisse constaté.
5. Cliquez sur **Valider la Clôture & Voir Z** :
   - Le shift est verrouillé et horodaté.
   - Le **Rapport Z officiel** s'affiche : vous pouvez l'imprimer sur ticket thermique ou le télécharger en PDF pour archivage comptable.

---

## 3. Le Carnet de Dettes & Recouvrement des Créances

Accessible depuis le menu latéral **Carnet de Dettes** (`/debts`).

### Suivi des impayés et alertes de retard
- Visualisez en un coup d'œil :
  - Le total des créances en cours,
  - Le montant déjà recouvré,
  - Le taux de recouvrement global (en %),
  - Les dettes qui ont dépassé la date d'échéance (*Badge rouge "En retard"*).

### Enregistrement d'un versement (remboursement)
Quand un client vient payer tout ou partie de sa dette :
1. Recherchez le nom du client dans la barre de recherche.
2. Cliquez sur le bouton vert **Régler / Encaisser**.
3. Indiquez :
   - Le montant versé (ex : *14 000 FCFA*),
   - Le moyen de règlement (*Espèces*, *Mobile Money* ou *Carte*),
   - Une note facultative (ex : *Solde facture robe*).
4. Cliquez sur **Enregistrer le paiement** :
   - Le reste dû du client diminue immédiatement (et passe en statut **Soldé** si tout est payé).
   - Si le versement est en espèces, il **s'ajoute instantanément au tiroir de la caisse active** de la journée !

### Quittance officielle de paiement
Après chaque versement, cliquez sur **Quittance** pour imprimer ou télécharger le reçu certifiant :
- La dette initiale,
- Le montant versé ce jour,
- Le nouveau solde restant,
- Le cachet et la signature du caissier.

### Relance WhatsApp en 1 clic (+228)
- Cliquez sur le bouton vert **Relancer WhatsApp**.
- L'application ouvre directement WhatsApp avec le client concerné en pré-remplissant un message poli avec le montant exact dû et la date convenue (converti automatiquement avec l'indicatif international du Togo `+228`).

---

## 4. Le Tableau de Bord & le Calendrier d'Analyse

Accessible depuis l'icône **Tableau de bord** (`/`).

### Les 4 indicateurs financiers fondamentaux
1. **Chiffre d'affaires facturé :** La valeur totale des produits vendus sur la période.
2. **Trésorerie Encaissée Réelle :** L'argent réellement entré en caisse et sur vos comptes (hors dettes impayées et déduction faite des éventuels manquants de caisse).
3. **Écarts de Caisse :** Somme des écarts constatés lors des clôtures Z (détection immédiate des fuites ou erreurs de monnaie).
4. **Bénéfice Net Réel :** `CA Encaissé - Coût d'achat des marchandises (COGS) - Dépenses opérationnelles - Déficits de caisse`.

---

### Voyager dans le temps avec le Sélecteur Calendrier

En haut à droite du tableau de bord et sur la page Analytique, vous disposez du sélecteur universel :

```text
[ Aujourd'hui ]  [ Cette Semaine ]  [ Ce Mois-ci ]  [ Tout ]  [ 📅 Calendrier / Période ▼ ]
```

#### Pour revoir une journée passée (ex : Hier, avant-hier, il y a 4 jours) :
1. Cliquez sur **`📅 Calendrier / Période`**.
2. Dans l'onglet **Jour précis** :
   - Cliquez sur un raccourci rapide : `Hier`, `Avant-hier`, `Il y a 3 jours`, `Il y a 4 jours`, `Il y a 7 jours`,
   - Ou cliquez directement dans le champ calendrier pour choisir n'importe quel jour de l'année.
3. Toutes les statistiques, le bénéfice du jour, les écarts et la liste des ventes se synchronisent sur cette date précise !

#### Pour analyser une période personnalisée (Du ... Au ...) :
1. Cliquez sur l'onglet **Plage de dates**.
2. Choisissez une plage rapide (`7 derniers jours`, `14 derniers jours`, `30 derniers jours`, `Mois précédent`) ou définissez vos dates `Du` et `Au`.
3. Cliquez sur **Fermer** pour observer le rapport consolidé de la période.

---

## 5. Gestion des Produits & Confidentialité des Prix d'Achat

Accessible via **Produits & Stock** (`/products`).

### Ajout manuel & protection du coût d'achat
- **Ajout d'un article :** Nom, catégorie, code-barres, prix de vente, stock actuel et alerte de stock minimum.
- **Prix d'achat (`Coût d'achat`) :**
  - **Pour le patron (Admin) :** Champ visible pour calculer la marge bénéficiaire.
  - **Pour le caissier :** Le champ n'apparaît tout simplement pas. Les requêtes en base de données sont totalement isolées (`product_costs`) avec protection RLS de niveau bancaire.

---

### Importation massive par fichier Excel / CSV
Pour ajouter des dizaines ou des centaines d'articles en 10 secondes :
1. Cliquez sur le bouton vert **Importer Excel** en haut de page.
2. Cliquez sur **Télécharger le Modèle Excel** (`.xlsx`) pour obtenir les colonnes prêtes à l'emploi (*Nom, Catégorie, Code-barres, Prix de vente, Prix d'achat, Stock, Stock min*).
3. Remplissez le fichier avec vos données et glissez-le dans la zone d'importation.
4. L'aperçu analyse le fichier :
   - Vérifie la conformité des prix et des quantités,
   - Détecte les doublons éventuels (avec option de mettre à jour le stock existant ou d'ignorer),
   - Vous montre la valeur financière globale du stock importé.
5. Cliquez sur **Confirmer l'importation** : tous les articles sont insérés instantanément.

---

## 6. Gestion de l'Équipe & des Caissiers

Accessible via **Équipe** (`/team`) (réservé à l'Admin).

- **Création instantanée d'un compte caissier :**
  - Cliquez sur `+ Ajouter un membre`.
  - Renseignez son nom, son email et attribuez-lui un mot de passe initial.
  - Choisissez le rôle **Caissier**.
  - Le compte est actif immédiatement : le caissier peut se connecter sur son téléphone ou tablette sans attendre d'email de confirmation.
- **Révocation d'accès :**
  - En cas de départ d'un employé, cliquez sur l'icône poubelle pour désactiver son accès en 1 seconde.

---

## 7. Dépenses & Exports Comptables

### Dépenses (`/expenses`)
- Enregistrez chaque charge de la boutique : Loyer, électricité, transport, salaires, emballages, etc.
- Ces montants sont automatiquement déduits du bénéfice net sur le Tableau de bord et dans les déclarations de résultat.

### Exports Comptables (`/analytics`)
- Cliquez sur **Export Comptable (Excel / CSV)** pour générer des classeurs conformes pour votre comptable :
  - **Journal des Ventes :** Détail chronologique de toutes les ventes, moyens de règlement, remises et TVA.
  - **Journal des Dépenses :** Ventilation analytique des charges.
  - **Valorisation des Stocks :** Valeur marchande et valeur d'achat du stock présent en magasin.
  - **Grand Livre & Compte de Résultat :** Synthèse financière complète des recettes, des coûts et du bénéfice net de la période.

---

*MaBoutiquePro — La puissance d'un logiciel de gestion moderne au creux de votre main.*
