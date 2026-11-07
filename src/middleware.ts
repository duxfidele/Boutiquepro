import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Chemins exemptés de la vérification CSRF (Webhooks tiers sécurisés par HMAC / signatures cryptographiques)
const CSRF_EXEMPT_PATHS = [
  "/api/webhooks/moneriz",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // 1. Application des en-têtes de sécurité de base sur toutes les réponses
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // 2. Protection CSRF uniquement sur les méthodes mutantes des routes API
  const isMutatingMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  const isApiRoute = pathname.startsWith("/api/");
  const isExempt = CSRF_EXEMPT_PATHS.some((exempt) => pathname.startsWith(exempt));

  if (isApiRoute && isMutatingMethod && !isExempt) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const secFetchSite = request.headers.get("sec-fetch-site");

    // Rejeter explicitement si le navigateur indique une requête cross-site
    if (secFetchSite === "cross-site") {
      return NextResponse.json(
        { error: "Requête inter-sites (cross-site) non autorisée par la politique CSRF." },
        { status: 403 }
      );
    }

    // Vérification de l'origine si présente
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const originHost = originUrl.host;
        const currentHost = forwardedHost || host;

        if (currentHost && originHost !== currentHost) {
          return NextResponse.json(
            { error: "Origine de requête non autorisée (CSRF validation failure)." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Origine invalide." },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json & PWA Service Worker scripts (sw.js, workbox-*, swe-worker-*)
     * - public image/icon files
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*|swe-worker-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

