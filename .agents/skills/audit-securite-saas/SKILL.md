---
name: audit-securite-saas
description: "Audit de sécurité d'une application SaaS ou web avant sa mise en ligne, selon 20 contrôles critiques (clés API exposées, secrets dans Git, Row Level Security, autorisation côté serveur, injections SQL, XSS, uploads, dépendances). Utilise ce skill quand l'utilisateur demande si son app est prête ou sécurisée, veut une checklist avant lancement, s'inquiète d'un piratage ou d'une fuite de données, ou partage un projet vibe-codé (Lovable, Bolt, v0, Cursor) à vérifier. Utilise-le aussi quand quelqu'un annonce qu'il lance son SaaS et travaille avec Supabase ou Firebase — même sans prononcer le mot \"sécurité\". Ne pas déclencher pour une question purement technique de déploiement ou d'hébergement."
---

# Instructions principales (SKILL.md)

Une app vibe-codée qui fonctionne n'est pas une app qui peut être mise en ligne. Le code généré par IA marche vite, mais il laisse presque systématiquement les mêmes trous : clés secrètes côté client, base de données ouverte à tous, contrôles d'accès faits dans le navigateur. Ces failles ne se voient pas à l'usage — elles se voient le jour où quelqu'un vide la base ou fait exploser la facture d'API.

Ce skill sert à passer une application au crible de 20 contrôles, à classer ce qui est trouvé par gravité réelle, et à corriger dans le bon ordre.

## Principe directeur

**Ne jamais affirmer qu'un contrôle est bon sans l'avoir vérifié.** Un audit qui dit « RLS activée ✅ » sans avoir lu les policies est pire que pas d'audit : il donne une fausse confiance à quelqu'un qui va lancer. Ce qui n'a pas pu être contrôlé se classe en **NON VÉRIFIÉ**, avec la précision de ce qu'il faudrait pour trancher.

## Choisir le mode

Deux situations très différentes, deux façons de travailler. Identifier laquelle avant de commencer.

**Mode complet — le code est accessible** (repo cloné, fichiers fournis, dossier local). Aller à la section « Audit sur code ».

**Mode guidé — pas d'accès au code.** C'est le cas le plus fréquent avec les projets Lovable, Bolt ou v0 : l'utilisateur travaille dans la plateforme et n'a rien à téléverser. Ne pas refuser l'audit et ne pas produire un rapport générique : conduire l'audit par questions, en faisant faire les vérifications à l'utilisateur. Aller à la section « Audit guidé ».

---

## Audit sur code

### 1. Cadrer

Lire `package.json` ou `requirements.txt` et la structure des dossiers pour identifier la stack. Repérer ce qui est sensible dans ce produit : paiements, données personnelles, fichiers uploadés, messagerie. Le niveau d'exigence dépend de ce qui peut fuir.

### 2. Lancer le scan

```bash
bash scripts/scan.sh /chemin/du/projet
```

Le script couvre en une passe les contrôles automatisables : secrets, historique Git, clé `service_role` côté client, identité prise chez le client, autorisation faite dans le navigateur, SQL concaténé, XSS, `select('*')`, routes de debug, headers, rate limiting, validation, dépendances.

Il ne conclut rien — il produit des signaux. Le travail d'analyse commence après.

### 3. Vérifier chaque signal avant de le classer

Ouvrir le fichier, lire le contexte. Les faux positifs classiques, à écarter sans les compter comme failles :

- une clé de test (`sk_test_`, `pk_test_`) — sans valeur pour un attaquant ;
- une clé placeholder dans un `README`, un `.env.example` ou une documentation ;
- `service_role` apparaissant dans un fichier serveur (`/api`, `/server`, une Edge Function) — c'est sa place normale ;
- `select('*')` sur une table sans données sensibles, ou sur une requête déjà filtrée par RLS ;
- `dangerouslySetInnerHTML` sur du contenu constant écrit par le développeur, non fourni par un utilisateur.

À l'inverse, l'absence de signal ne prouve rien : un `grep` ne voit pas ce qui n'est pas dans le code. Cinq contrôles échappent complètement au scan et se vérifient à la main — **RLS (4), chiffrement (5), cookies (9), hachage des mots de passe (10), uploads (16)**. Les traiter systématiquement.

### 4. Compléter le scan à la lecture

Lire `references/checklist.md` : chaque contrôle y est détaillé avec le risque concret, la méthode de vérification et la correction. Lire ensuite la référence de stack qui s'applique — `supabase.md`, `firebase.md`, `node-express.md` ou `nextjs.md`. Une seule, pas toutes.

**Toujours donner la preuve.** Chaque faille signalée pointe un fichier et une ligne, avec l'extrait fautif. Sans preuve, c'est une hypothèse, et il faut l'écrire comme telle.

---

## Audit guidé

Sans accès au code, l'audit reste possible : il suffit de faire exécuter les vérifications par l'utilisateur. Procéder par petits lots — trois ou quatre demandes à la fois, jamais une liste de vingt, sous peine qu'il abandonne en route.

**Lot 1 — la base de données**, là où se trouvent les failles les plus graves. Lui faire ouvrir le SQL Editor de Supabase et coller le résultat des requêtes de `references/supabase.md`. Ces trois requêtes suffisent à trancher les contrôles 4, 7 et 16.

**Lot 2 — les clés.** Lui faire chercher `service_role` dans son projet (Ctrl+F, tous fichiers) et dire où ça apparaît. Lui faire lister ses variables d'environnement commençant par `NEXT_PUBLIC_` ou `VITE_`.

**Lot 3 — le test de la clé anon.** Le plus parlant, et il le fait lui-même : récupérer l'URL du projet et la clé anon dans le code, puis, sans être connecté, tenter de lire une table sensible (commande `curl` fournie dans `supabase.md`). Si des données remontent, la base est publique — c'est un 🔴 démontré, pas une supposition.

**Lot 4 — le test des deux comptes.** Créer deux comptes, se connecter avec le premier, tenter d'ouvrir une ressource du second en changeant l'identifiant dans l'URL.

Ces quatre lots couvrent l'essentiel du risque réel. Pour le reste, demander des extraits ciblés : le fichier qui crée le client Supabase, une route d'API représentative. Le rapport se rend ensuite normalement, avec une part de NON VÉRIFIÉ plus large — et c'est honnête de le dire.

---

## Classer par gravité réelle

Ne pas rendre une liste plate de 20 points. Trois niveaux, le critère étant l'impact, pas la difficulté de correction :

| Niveau | Signification |
|---|---|
| 🔴 **BLOQUANT** | Ne pas mettre en ligne avant correction. Exploitable aujourd'hui, sans compétence particulière : clé secrète publiée, base sans RLS, mot de passe en clair. |
| 🟠 **IMPORTANT** | Le lancement peut se faire, la correction suit dans la semaine. Exploitable, mais demande un effort ou un enchaînement. |
| 🟡 **À FAIRE** | Durcissement. Réduit la surface d'attaque sans faille exploitable aujourd'hui. |

Un contrôle sans objet pour ce projet (pas d'upload, donc le 16) se marque **NON APPLICABLE** avec un mot d'explication. Ne pas l'inventer pour remplir le tableau.

## Rendre le rapport

```markdown
# Audit de sécurité — [nom du projet]

**Verdict : [PRÊT À LANCER / À CORRIGER AVANT LANCEMENT]**
[Une ou deux phrases : ce qui bloque, ou ce qui est sain.]

| | Nombre |
|---|---|
| 🔴 Bloquant | X |
| 🟠 Important | X |
| 🟡 À faire | X |
| ⚪️ Non vérifié | X |

## 🔴 À corriger avant la mise en ligne

### 1. [Titre de la faille] — contrôle n°[X]
**Où :** `chemin/du/fichier.js:42`
**Le problème :** [ce qu'un attaquant peut faire concrètement, en une ou deux phrases]
**La correction :**
[code ou étapes]

## 🟠 À corriger dans la semaine
[même format]

## 🟡 Durcissement
[une ligne par point]

## ⚪️ Non vérifié
[Ce qui n'a pas pu être contrôlé, et ce qu'il faudrait pour le faire.]

## Les 20 contrôles
[Tableau récapitulatif : contrôle | statut | note courte]
```

Sur un petit projet avec deux ou trois constats, cette structure est trop lourde : garder le verdict, les failles avec leur preuve et le tableau récapitulatif, supprimer les sections vides. La structure sert la lisibilité, elle ne doit pas la gêner.

## Proposer la suite

Terminer en proposant de corriger les points bloquants, dans l'ordre. Ne pas modifier le code sans accord : l'audit et la correction sont deux étapes, et l'utilisateur doit d'abord comprendre ce qui ne va pas — sinon il reproduira les mêmes erreurs au projet suivant.

Une fois la correction lancée, avancer faille par faille avec une vérification après chaque correctif, plutôt que de tout réécrire d'un coup.

Quand des clés ont été exposées, insister sur un point souvent négligé : **retirer la clé du code ne suffit pas, il faut la révoquer et la régénérer.** Une clé publiée un jour est compromise pour toujours.

## Ton

L'utilisateur est souvent un fondateur, pas un ingénieur sécurité. Deux réflexes :

- **Expliquer le risque en scénario, pas en jargon.** Pas « absence de RLS sur la table `users` » mais « n'importe qui peut ouvrir la console de son navigateur et télécharger la liste complète de vos utilisateurs avec leurs emails ».
- **Ne pas dramatiser ce qui ne l'est pas.** Tout signaler en rouge pousse à tout ignorer. Si un projet est propre, le dire : un verdict « prêt à lancer » est un résultat valable.

## Les quatre failles à chercher en premier

Sur un projet vibe-codé, ces quatre-là expliquent à elles seules la majorité des bases vidées. Les traiter avant tout le reste :

1. Clé `service_role` utilisée côté client (contrôle 3)
2. RLS jamais activée, la base étant restée en mode prototypage (contrôle 4)
3. Contrôle d'accès fait en React sans équivalent serveur (contrôle 6)
4. Fichier `.env` commité au premier push (contrôle 2)
