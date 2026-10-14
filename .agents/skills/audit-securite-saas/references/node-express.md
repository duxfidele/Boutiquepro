## Ordre des middlewares

L'ordre détermine l'efficacité. Un middleware d'authentification déclaré après les routes ne protège rien.

```js
app.use(helmet());                       // headers de sécurité, en premier
app.use(cors({ origin: ORIGINE_AUTORISEE, credentials: true }));
app.use(express.json({ limit: '1mb' })); // borne la taille du corps
app.use('/api/auth', limiteurConnexion); // rate limiting sur l'authentification
app.use('/api', verifierSession);        // authentification AVANT les routes protégées
app.use('/api', routes);
```

## À vérifier systématiquement

**CORS en mode ouvert.** `app.use(cors())` sans option autorise toutes les origines. Combiné à des cookies de session, cela permet à n'importe quel site d'appeler l'API au nom d'un utilisateur connecté. Lister explicitement les origines autorisées.

**Corps de requête non borné.** Sans `limit`, un envoi de 500 Mo fait tomber le serveur. Fixer une limite basse et l'augmenter seulement là où c'est nécessaire.

**Erreurs renvoyées telles quelles.** `res.status(500).json({ error: err })` expose la stack trace, les chemins du serveur et parfois la chaîne de connexion à la base. Logger le détail côté serveur, renvoyer un message générique au client.

**Variables d'environnement non validées au démarrage.** Une variable manquante fait souvent basculer le code sur une valeur par défaut permissive. Vérifier leur présence au boot et refuser de démarrer si une clé manque.

**Secret JWT faible ou codé en dur.** Chercher `jwt.sign` et `jwt.verify` : le secret doit venir de l'environnement, faire au moins 32 caractères aléatoires, et l'expiration doit être explicite. Vérifier aussi que l'algorithme est imposé (`algorithms: ['HS256']`) pour éviter l'attaque `alg: none`.

**Routes de debug oubliées.** `/test`, `/debug`, `/admin/seed`, un endpoint qui vide la base ou crée un compte administrateur : chercher ces routes avant la mise en ligne.

```bash
grep -rn "app\.\(get\|post\|put\|delete\)(" --include="*.js" --include="*.ts" . | grep -iE "test|debug|seed|reset|admin"
```

**Exécution de commandes système.** `exec`, `execSync`, `spawn` avec une valeur venant de l'utilisateur permettent l'injection de commandes. Si c'est indispensable, passer les arguments en tableau plutôt qu'en chaîne, et valider strictement.

**Dépendances de production.** `npm audit --omit=dev` avant chaque mise en ligne, et vérifier que les outils de développement ne sont pas en `dependencies`.
