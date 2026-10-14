Comme Supabase, Firebase expose la base directement au navigateur. La `apiKey` visible dans le code n'est pas un secret — c'est un identifiant de projet, et la voir dans le bundle n'est pas une faille. **Toute la sécurité repose sur les Security Rules.** C'est là qu'il faut regarder, et nulle part ailleurs.

## Firestore Rules

Le mode test, proposé par défaut à la création, ouvre tout :

```
// CATASTROPHIQUE — n'importe qui lit et écrit toute la base
allow read, write: if true;

// À peine mieux — tout utilisateur connecté accède aux données de tous les autres
allow read, write: if request.auth != null;
```

La règle correcte vérifie la propriété de chaque document :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /profils/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
                   && !request.resource.data.diff(resource.data)
                        .affectedKeys().hasAny(['role', 'credits']);
    }

    match /projets/{projetId} {
      allow read, delete: if request.auth != null
                          && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;
    }

    match /{document=**} {
      allow read, write: if false;   // tout ce qui n'est pas listé est fermé
    }
  }
}
```

Trois points à contrôler dans les règles existantes :

- **La date d'expiration du mode test.** Une règle contenant `request.time < timestamp.date(...)` est une règle de prototypage. Passée la date, l'app cesse de fonctionner ; avant, tout est ouvert.
- **La distinction `resource` / `request.resource`.** `resource.data` est le document existant, `request.resource.data` celui qu'on veut écrire. Les confondre laisse passer des écritures qu'on croyait bloquées.
- **Le verrouillage des champs sensibles.** Sans le `diff().affectedKeys()`, un utilisateur qui a le droit d'écrire son profil peut y ajouter `role: "admin"` (contrôle 8).

Les règles se testent dans le simulateur de la console Firebase, ou en local avec `firebase emulators:start`. Un audit sérieux exécute au moins un test de lecture croisée entre deux uid.

## Storage Rules

Séparées des règles Firestore, et fréquemment oubliées :

```
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{userId}/{fichier} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Sans contrainte de taille ni de type, le bucket sert d'hébergement gratuit à n'importe qui (contrôle 16).

## Le SDK Admin

`firebase-admin` contourne toutes les règles. Il n'a sa place que dans une Cloud Function ou un backend. Chercher :

```bash
grep -rn "firebase-admin\|serviceAccountKey\|admin.initializeApp" --include="*.js" --include="*.ts" --include="*.json" .
```

Un fichier `serviceAccountKey.json` dans le dépôt est un 🔴 immédiat : il donne un accès administrateur complet au projet. Le régénérer depuis la console Google Cloud après l'avoir retiré de l'historique Git.

## Cloud Functions

Une fonction `onRequest` est une URL publique sans authentification. Elle doit vérifier le jeton elle-même :

```js
const token = req.headers.authorization?.split('Bearer ')[1];
const decoded = await admin.auth().verifyIdToken(token);   // lève si invalide
```

Les fonctions `onCall` reçoivent `context.auth` renseigné automatiquement, mais il faut quand même tester sa présence — l'appel reste possible sans être connecté.

## App Check

Sans App Check, n'importe qui peut appeler la base et les fonctions depuis un script, en dehors de l'application. Ce n'est pas un remplacement des règles de sécurité, mais c'est la protection anti-bot native (contrôle 12) et elle est rapide à activer.

## Test de validation

Depuis un terminal, sans être connecté, avec l'`apiKey` et l'`projectId` récupérés dans le code :

```bash
curl "https://firestore.googleapis.com/v1/projects/<projectId>/databases/(default)/documents/utilisateurs?key=<apiKey>"
```

La réponse attendue est une erreur de permission. Si des documents remontent, la collection est publique.
