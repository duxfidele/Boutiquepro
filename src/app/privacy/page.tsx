import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2, Mail } from "lucide-react";

export const metadata = {
  title: "Règles de Confidentialité — MaBoutiquePro",
  description: "Politique de confidentialité et protection des données personnelles de l'application MaBoutiquePro, conforme aux normes Google API Services User Data Policy.",
};

export default function PrivacyPage() {
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
            <Shield className="w-4 h-4" />
            <span>Protection de vos Données Personnelles</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-on-surface tracking-tight mb-3">
            Règles de Confidentialité
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Dernière mise à jour : {lastUpdated} • En vigueur pour tous les utilisateurs de <b>maboutiquepro.app</b>
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-on-surface leading-relaxed text-sm sm:text-base">
          {/* Section 1 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">1</span>
              <span>Introduction &amp; Responsable du Traitement</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              L&apos;application <b>MaBoutiquePro</b> (accessible sur le site officiel{" "}
              <a href="https://maboutiquepro.app" className="text-primary font-bold hover:underline">
                https://maboutiquepro.app
              </a>
              ) est une solution de gestion commerciale, point de vente (POS) et suivi de stocks conçue pour les commerçants et entrepreneurs.
            </p>
            <p className="text-on-surface-variant">
              Nous accordons une importance primordiale à la protection, la confidentialité et la sécurité des données de nos utilisateurs. Le responsable du traitement est l&apos;équipe fondatrice de MaBoutiquePro, joignable directement par e-mail à l&apos;adresse suivante :{" "}
              <a href="mailto:contact@maboutiquepro.app" className="text-primary font-bold hover:underline">
                contact@maboutiquepro.app
              </a>.
            </p>
          </section>

          {/* Section 2 - GOOGLE SPECIFIC */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border-2 border-indigo-500/30 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-sm font-black">2</span>
              <span>Données Collectées via les Services Google (Google OAuth)</span>
            </h2>
            <p className="text-on-surface-variant mb-4">
              Lorsque vous choisissez de vous connecter à MaBoutiquePro avec votre compte Google (via le bouton « Continuer avec Google »), nous demandons uniquement l&apos;accès aux informations d&apos;identité publiques et minimales suivantes :
            </p>
            <ul className="space-y-2 mb-4 text-on-surface-variant">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span><b>Adresse e-mail Google :</b> Utilisée pour créer votre compte unique, identifier votre boutique et vous transmettre les reçus de paiement et alertes de sécurité.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span><b>Nom et Prénom :</b> Utilisés pour personnaliser votre espace administrateur et inscrire votre nom sur vos reçus et factures émis.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span><b>Photo de profil :</b> Utilisée exclusivement comme avatar dans votre interface utilisateur.</span>
              </li>
            </ul>

            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-950 dark:text-indigo-200">
              <p className="font-bold text-xs sm:text-sm uppercase tracking-wider mb-1">
                Conformité Google API Services User Data Policy
              </p>
              <p className="text-xs sm:text-sm leading-relaxed">
                L&apos;utilisation et le transfert par <b>MaBoutiquePro</b> à toute autre application d&apos;informations reçues des API Google respecteront en tous points la{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  Politique relative aux données utilisateur des services d&apos;API Google
                </a>
                , y compris les exigences d&apos;<b>Utilisation Limitée (Limited Use)</b>.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">3</span>
              <span>Données Commerciales de la Boutique</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              Dans le cadre de l&apos;utilisation quotidienne de l&apos;application pour votre commerce, vous enregistrez :
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-on-surface-variant mb-3">
              <li>Votre catalogue de produits (désignation, prix de vente, prix d&apos;achat, quantités en stock, catégories).</li>
              <li>L&apos;historique de vos ventes au comptant et à crédit.</li>
              <li>Le carnet de dettes et coordonnées de vos clients enregistrés (nom, numéro de téléphone pour les relances WhatsApp).</li>
              <li>Les dépenses opérationnelles de votre commerce (loyers, factures).</li>
              <li>Les comptes caissiers créés pour vos employés.</li>
            </ul>
            <p className="text-on-surface-variant font-medium">
              Ces données vous appartiennent en totalité. Elles sont strictement cloisonnées par boutique grâce aux politiques de sécurité par ligne (Row Level Security - RLS) de notre base de données.
            </p>
          </section>

          {/* Section 4 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">4</span>
              <span>Non-Revente et Partage Strictement Limité</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              <b>Nous ne vendons, ne louons, n&apos;échangeons et ne commercialisons AUCUNE donnée personnelle ou commerciale</b> à des tiers, des courtiers en données ou des régies publicitaires.
            </p>
            <p className="text-on-surface-variant mb-3">
              Vos informations ne sont partagées qu&apos;avec nos sous-traitants techniques strictement nécessaires au fonctionnement du service :
            </p>
            <ul className="space-y-2 text-on-surface-variant">
              <li><b>Supabase :</b> Hébergement sécurisé de la base de données PostgreSQL avec chiffrement au repos.</li>
              <li><b>Vercel :</b> Déploiement et hébergement de l&apos;application web avec certificat SSL/TLS automatique.</li>
              <li><b>Moneriz :</b> Passerelle de paiement sécurisée pour le règlement des abonnements par Mobile Money et carte bancaire (aucune donnée de carte n&apos;est stockée sur nos serveurs).</li>
              <li><b>Resend :</b> Expédition des e-mails transactionnels (confirmation de commande, reçus, alertes).</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">5</span>
              <span>Sécurité des Données</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              MaBoutiquePro met en œuvre des mesures de sécurité techniques et organisationnelles conformes aux standards de l&apos;industrie :
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-on-surface-variant">
              <li>Chiffrement systématique de toutes les communications en transit via HTTPS (TLS 1.3 / HSTS 2 ans).</li>
              <li>Cloisonnement multi-tenant étanche : un commerçant ou caissier ne peut en aucun cas lire les données d&apos;une autre boutique.</li>
              <li>Sanctuarisation des données sensibles : les marges et prix d&apos;achat sont inaccessibles aux caissiers.</li>
              <li>Sauvegarde chiffrée et continue des bases de données.</li>
            </ul>
          </section>

          {/* Section 6 - DELETION */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">6</span>
              <span>Vos Droits : Accès, Rectification &amp; Suppression Définitive</span>
            </h2>
            <p className="text-on-surface-variant mb-3">
              Conformément aux réglementations sur la protection de la vie privée, vous disposez d&apos;un contrôle total sur vos données :
            </p>
            <ul className="space-y-2 text-on-surface-variant mb-4">
              <li><b>Droit d&apos;accès et d&apos;export :</b> Vous pouvez exporter à tout moment vos stocks, vos ventes et vos bilans comptables au format Excel ou CSV depuis votre tableau de bord.</li>
              <li><b>Droit de rectification :</b> Vous pouvez modifier à tout moment vos coordonnées depuis la section « Paramètres ».</li>
              <li><b>Droit à l&apos;effacement définitif :</b> Vous pouvez demander la suppression intégrale et irréversible de votre compte, de vos boutiques et de toutes les données associées en nous adressant un simple message à <b>contact@maboutiquepro.app</b>. Votre demande est traitée sous 48 heures ouvrées.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">7</span>
              <span>Contactez-nous</span>
            </h2>
            <p className="text-on-surface-variant mb-4">
              Pour toute question relative aux présentes règles de confidentialité ou pour exercer vos droits, vous pouvez contacter notre équipe à :
            </p>
            <div className="p-4 rounded-2xl bg-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-semibold text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-on-surface">
                <Mail className="w-4 h-4 text-primary" />
                <span>contact@maboutiquepro.app</span>
              </div>
              <span className="text-outline">Lomé, Togo • maboutiquepro.app</span>
            </div>
          </section>
        </div>

        {/* Footer de la page */}
        <div className="mt-12 text-center text-xs text-outline pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 MaBoutiquePro. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Conditions d&apos;utilisation</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

