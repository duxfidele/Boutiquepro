import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/AuthContext";
import AppWrapper from "@/components/layout/AppWrapper";



const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BoutiquePro — Gestion Commerciale SaaS",
  manifest: "/manifest.json",
  themeColor: "#6343ea",
  description: "Application SaaS de gestion commerciale moderne pour boutiques : produits, stocks, ventes en caisse, clients et analytique.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen")}>
        <AuthProvider>
          <AppWrapper>
            {children}
          </AppWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
