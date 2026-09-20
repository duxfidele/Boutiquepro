import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { StoreProvider } from "@/context/StoreContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

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
        <StoreProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] ml-0 pb-20 lg:pb-0 transition-all duration-300">
              <Header />
              <main className="flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
