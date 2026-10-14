## La frontière client / serveur

C'est là que se concentrent les erreurs. Un fichier sans `'use client'` s'exécute côté serveur, mais tout ce qu'il **passe en props** à un composant client se retrouve dans le HTML envoyé au navigateur — y compris ce qui devait rester privé.

À vérifier : les props transmises depuis un Server Component ne contiennent ni token, ni clé, ni champ sensible d'un enregistrement complet passé « pour plus tard ».

**Le préfixe `NEXT_PUBLIC_`.** Toute variable ainsi préfixée est inlinée dans le bundle du navigateur. Elle est publique, définitivement, quel que soit l'endroit où elle est définie.

```bash
grep -rn "NEXT_PUBLIC_" .env* next.config.* src/ app/ 2>/dev/null
```
Chaque résultat doit être une valeur qu'on accepte d'afficher publiquement : URL de projet, clé anon, identifiant d'analytics. Rien d'autre.

## Route Handlers et Server Actions

Une Server Action est un endpoint HTTP public, pas une fonction interne. Le fait qu'elle soit appelée depuis un formulaire protégé ne la protège pas : elle est appelable directement.

```ts
export async function supprimerProjet(id: string) {
  const session = await auth();                       // vérification obligatoire
  if (!session?.user) throw new Error('Non authentifié');
  await db.projet.delete({
    where: { id, userId: session.user.id },           // et vérification de propriété
  });
}
```

Même règle pour chaque fichier `route.ts` : vérifier la session en entrée, ne jamais faire confiance à un identifiant reçu dans le corps de la requête.

## Middleware

`middleware.ts` sert à rediriger, pas à sécuriser. Un `matcher` mal configuré laisse passer des routes, et le middleware ne s'exécute pas sur certains chemins. La vérification d'accès doit être répétée dans la route ou l'action elle-même — le middleware n'est qu'une première couche de confort.

## Headers

Ils se déclarent dans `next.config.js` :

```js
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ],
  }];
}
```

## Avant la mise en ligne

Construire le projet puis chercher les secrets dans le bundle généré — c'est le test le plus fiable, il montre exactement ce que le navigateur reçoit :

```bash
npm run build
grep -rE "sk-|service_role|sk_live_" .next/static/ | head
```

Aucun résultat attendu.
