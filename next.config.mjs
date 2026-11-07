import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: false,
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // Empêche l'intégration dans des iframes malveillantes (Anti-Clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le reniflage de type MIME par le navigateur
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Protection contre les fuites d'URL d'origine vers des tiers
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force les connexions chiffrées sécurisées (HSTS - 2 ans)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Restreint l'accès aux APIs matérielles sensibles non utilisées
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Protection XSS standard
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Content-Security-Policy (Anti-XSS, Anti-Clickjacking, PWA Service Worker et Google Identity)
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; worker-src 'self' blob:; manifest-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://accounts.google.com https:; frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
