import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, ShieldCheck, Mail } from "lucide-react";

export const metadata = {
  title: "Conditions d'Utilisation — MaBoutiquePro",
  description: "Conditions générales d'utilisation de l'application SaaS MaBoutiquePro pour la gestion de commerce et point de vente.",
};

export default function TermsPage() {
  const lastUpdated = "7 novembre 2026";

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased">
      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l&apos;accueil</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="MaBoutiquePro" className="h-6 w-auto" />
            <span className="font-extrabold text-sm text-on-surface">MaBoutiquePro</span>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
            <FileText className="w-4 h-4" />
            <span>Conditions Générales d&apos;Utilisation (CGU)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-on-surface tracking-tight mb-3">
            Conditions d&apos;Utilisation
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Dernière mise à jour : {lastUpdated} • Régissant l&apos;utilisation de <b>maboutiquepro.app</b>
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-on-surface leading-relaxed text-sm sm:text-base">
          {/* Section 1 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">1</span>
              <span>Objet du Service</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              <b>MaBoutiquePro</b> est une solution logicielle en mode SaaS (Software as a Service) accessible à l&apos;adresse{" "}
              <a href="https://maboutiquepro.app" className="text-primary font-bold hover:underline">
                https://maboutiquepro.app
              </a>
              , destinée à faciliter la gestion commerciale, l&apos;encaissement en caisse (POS), le suivi des stocks en temps réel et la gestion des créances clients pour les commerçants, boutiques et petites et moyennes entreprises.
            </p>
            <p className="text-on-surface-variant">
              L&apos;accès et l&apos;utilisation de MaBoutiquePro impliquent l&apos;acceptation pleine et entière des présentes Conditions Générales d&apos;Utilisation.
            </p>
          </section>

          {/* Section 2 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">2</span>
              <span>Inscription &amp; Période d&apos;Essai Gratuit</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              Tout nouvel utilisateur créant un compte gérant bénéficie d&apos;une période d&apos;essai gratuit de <b>14 jours</b> sans aucun engagement et sans avoir à renseigner de carte bancaire.
            </p>
            <p className="text-on-surface-variant">
              L&apos;utilisateur s&apos;engage à fournir des informations exactes et à préserver la confidentialité de ses identifiants de connexion. Chaque gérant est responsable des comptes caissiers qu&apos;il crée pour ses collaborateurs.
            </p>
          </section>

          {/* Section 3 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">3</span>
              <span>Tarification &amp; Règlement des Abonnements</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              À l&apos;issue de la période d&apos;essai de 14 jours, l&apos;accès aux fonctionnalités est conditionné à la souscription d&apos;une formule d&apos;abonnement (Starter, Pro ou Business) :
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-on-surface-variant mb-3">
              <li>Les tarifs sont exprimés en Francs CFA (XOF/XAF) et sont clairement indiqués sur la page des tarifs.</li>
              <li>Les règlements s&apos;effectuent en ligne via notre passerelle agréée Moneriz par Mobile Money (T-Money, Moov Flooz, Wave, Orange Money, MTN) ou carte bancaire.</li>
              <li>Les abonnements sont sans engagement de durée et peuvent être arrêtés à tout moment.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">4</span>
              <span>Disponibilité du Service &amp; Mode Hors-Ligne</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              MaBoutiquePro est conçu pour offrir une haute disponibilité (99.9%). En cas de rupture temporaire de la connexion internet dans votre magasin, l&apos;application continue de fonctionner en <b>mode hors-ligne (PWA)</b> pour vous permettre d&apos;encaisser vos ventes. Les données se synchronisent automatiquement dès le retour du réseau.
            </p>
          </section>

          {/* Section 5 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">5</span>
              <span>Propriété des Données</span>
            </h2>
            <p className="text-on-surface-variant">
              L&apos;ensemble des données enregistrées dans votre boutique (produits, prix, stocks, ventes, créances, clients, dépenses) demeure votre entière et exclusive propriété. Vous pouvez les exporter à tout moment aux formats Excel ou CSV.
            </p>
          </section>

          {/* Section 6 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">6</span>
              <span>Résiliation &amp; Suppression</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              Vous êtes libre de cesser d&apos;utiliser le service à tout moment. Vous pouvez demander la suppression définitive de votre compte et de toutes vos données associées par e-mail à <b>contact@maboutiquepro.app</b>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">7</span>
              <span>Contact &amp; Assistance</span>
            </h2>
            <p className="text-on-surface-variant mb-4">
              Pour toute assistance technique, question commerciale ou réclamation, vous pouvez contacter notre support client :
            </p>
            <div className="p-4 rounded-2xl bg-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-semibold text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-on-surface">
                <Mail className="w-4 h-4 text-primary" />
                <span>contact@maboutiquepro.app</span>
              </div>
              <span className="text-outline">Assistance WhatsApp disponible 7j/7</span>
            </div>
          </section>
        </div>

        {/* Footer de la page */}
        <div className="mt-12 text-center text-xs text-outline pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 MaBoutiquePro. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Règles de confidentialité</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
