import { NextResponse } from "next/server";

/**
 * Valide l'en-tête de sécurité `Authorization: Bearer <CRON_SECRET>` envoyé par Vercel Cron.
 * Protège les routes de maintenance contre tout déclenchement non autorisé par des tiers.
 */
export function verifyCronSecret(request: Request): { authorized: boolean; response?: NextResponse } {
  const cronSecret = process.env.CRON_SECRET;

  // En environnement local de développement sans CRON_SECRET défini, autoriser pour faciliter les tests
  if (!cronSecret && process.env.NODE_ENV === "development") {
    return { authorized: true };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Non autorisé : jeton CRON_SECRET manquant ou invalide." },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

