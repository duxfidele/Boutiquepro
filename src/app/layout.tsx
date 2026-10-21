import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/AuthContext";
import AppWrapper from "@/components/layout/AppWrapper";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  themeColor: "#6343ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://maboutiquepro.app"),
  title: {
    default: "MaBoutiquePro — Gestion de Boutique & Point de Vente",
    template: "%s | MaBoutiquePro",
  },
  description: "Application tout-en-un de gestion de boutique, suivi des stocks en temps réel, caisse enregistreuse et gestion des crédits clients.",
  applicationName: "MaBoutiquePro",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://maboutiquepro.app",
    siteName: "MaBoutiquePro",
    title: "MaBoutiquePro — Gestion de Boutique & Point de Vente",
    description: "Gérez votre boutique, vos stocks et vos ventes au comptoir en toute simplicité sur maboutiquepro.app.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "MaBoutiquePro",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "MaBoutiquePro — Gestion de Boutique & Point de Vente",
    description: "Gérez votre boutique, vos stocks et vos ventes au comptoir en toute simplicité sur maboutiquepro.app.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className={cn(inter.className, "min-h-screen min-h-[100dvh]")}>
        <AuthProvider>
          <AppWrapper>
            {children}
          </AppWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
