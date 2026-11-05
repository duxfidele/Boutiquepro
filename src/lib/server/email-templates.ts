/**
 * Module de Templates d'Emails Transactionnels pour BoutiquePro
 * Templates HTML professionnels, responsives (mobiles & ordinateurs)
 * optimisés pour une délivrabilité maximale (compatible tous clients mails).
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://maboutiquepro.app";
const WHATSAPP_URL = "https://chat.whatsapp.com/votre-groupe-commercants";

interface BaseLayoutProps {
  previewText: string;
  headerTitle: string;
  headerBadge?: string;
  badgeColor?: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}

function renderEmailLayout({
  previewText,
  headerTitle,
  headerBadge,
  badgeColor = "#6343ea",
  contentHtml,
  ctaText,
  ctaUrl,
}: BaseLayoutProps): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <!-- Preview Text masqué -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
    ${previewText}
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- En-tête avec Branding -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: #ffffff; padding: 8px 16px; border-radius: 12px; font-weight: 8px; margin-bottom: 16px;">
                      <span style="font-size: 18px; font-weight: 800; color: #4338ca; letter-spacing: -0.5px;">Boutique<span style="color: #10b981;">Pro</span></span>
                    </div>
                  </td>
                </tr>
                ${
                  headerBadge
                    ? `<tr><td align="center"><span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; letter-spacing: 0.5px; margin-bottom: 12px;">${headerBadge}</span></td></tr>`
                    : ""
                }
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">${headerTitle}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corps de l'email -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
              ${contentHtml}

              ${
                ctaText && ctaUrl
                  ? `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 32px 0 16px 0;">
                  <tr>
                    <td align="center">
                      <a href="${ctaUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
                        ${ctaText}
                      </a>
                    </td>
                  </tr>
                </table>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Séparateur -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 0;">
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; background-color: #fafafa; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;"><strong>BoutiquePro</strong> — La solution de gestion tout-en-un pour les commerçants modernes.</p>
              <p style="margin: 0 0 16px 0;">
                <a href="${WHATSAPP_URL}" target="_blank" style="color: #10b981; font-weight: 600; text-decoration: none;">💬 Rejoindre la communauté WhatsApp</a> &bull; 
                <a href="${BASE_URL}/support" target="_blank" style="color: #6366f1; font-weight: 600; text-decoration: none;">Assistance & Support</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Cet email a été envoyé automatiquement à votre adresse administrateur. Vous recevez ce message car vous êtes inscrit sur BoutiquePro.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ==============================================================================
// 1. TEMPLATE : CONFIRMATION D'ABONNEMENT MONERIZ
// ==============================================================================
export interface SubscriptionSuccessEmailParams {
  recipientName: string;
  storeName?: string;
  planTier: string;
  billingCycle: string;
  amount: number;
  currency?: string;
  reference?: string;
  startDate?: string;
  endDate?: string;
}

export function buildSubscriptionSuccessEmail(params: SubscriptionSuccessEmailParams): { subject: string; html: string } {
  const currency = params.currency || "FCFA";
  const formattedAmount = Number(params.amount).toLocaleString("fr-FR");
  const cycleLabel = params.billingCycle === "annual" ? "Annuel (1 an)" : "Mensuel (30 jours)";
  const subject = `Confirmation de paiement : Votre abonnement ${params.planTier} est actif !`;

  const contentHtml = `
    <p>Bonjour <strong>${params.recipientName || "Commerçant"}</strong>,</p>
    <p>Nous avons le plaisir de vous confirmer la réception de votre paiement avec succès via <strong>Moneriz</strong>. Votre formule d'abonnement <strong>${params.planTier}</strong> est désormais pleinement opérationnelle sur votre boutique <em>${params.storeName || "BoutiquePro"}</em> !</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 24px 0;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">📋 Récapitulatif du reçu de paiement</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px;">
        <tr>
          <td style="color: #64748b;">Formule souscrite :</td>
          <td align="right"><strong>Pack ${params.planTier}</strong></td>
        </tr>
        <tr>
          <td style="color: #64748b;">Période :</td>
          <td align="right">${cycleLabel}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Montant réglé :</td>
          <td align="right"><strong style="color: #10b981; font-size: 16px;">${formattedAmount} ${currency}</strong></td>
        </tr>
        ${
          params.reference
            ? `
        <tr>
          <td style="color: #64748b;">Référence transaction :</td>
          <td align="right"><code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${params.reference}</code></td>
        </tr>`
            : ""
        }
        ${
          params.endDate
            ? `
        <tr>
          <td style="color: #64748b;">Valable jusqu'au :</td>
          <td align="right"><strong>${new Date(params.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong></td>
        </tr>`
            : ""
        }
      </table>
    </div>

    <p style="margin-bottom: 0;">Toutes les fonctionnalités de votre formule sont immédiatement déverrouillées : caisses multi-postes, suivi en direct, alertes de stock et exportations comptables.</p>
  `;

  const html = renderEmailLayout({
    previewText: `Paiement validé : Votre abonnement ${params.planTier} (${formattedAmount} ${currency}) est actif.`,
    headerTitle: "Paiement Confirmé & Abonnement Actif",
    headerBadge: "Reçu de paiement officiel",
    badgeColor: "#10b981",
    contentHtml,
    ctaText: "Accéder à mon tableau de bord",
    ctaUrl: `${BASE_URL}/`,
  });

  return { subject, html };
}

// ==============================================================================
// 2. TEMPLATE : ALERTE DE FIN D'ABONNEMENT (J-3)
// ==============================================================================
export interface SubscriptionExpiringEmailParams {
  recipientName: string;
  storeName?: string;
  planTier: string;
  daysRemaining: number;
  expirationDate: string;
  renewUrl?: string;
}

export function buildSubscriptionExpiringEmail(params: SubscriptionExpiringEmailParams): { subject: string; html: string } {
  const daysText = params.daysRemaining <= 1 ? "demain" : `dans ${params.daysRemaining} jours`;
  const subject = `⚠️ Rappel : Votre abonnement BoutiquePro expire ${daysText}`;
  const formattedDate = new Date(params.expirationDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const contentHtml = `
    <p>Bonjour <strong>${params.recipientName || "Commerçant"}</strong>,</p>
    <p>Votre formule d'abonnement <strong>Pack ${params.planTier}</strong> pour la boutique <em>${params.storeName || "votre boutique"}</em> arrive bientôt à son terme :</p>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 12px; padding: 18px; margin: 24px 0;">
      <p style="margin: 0; color: #92400e; font-weight: 700; font-size: 15px;">
        ⏳ Échéance : ${formattedDate} (${daysText})
      </p>
      <p style="margin: 8px 0 0 0; color: #b45309; font-size: 13px; line-height: 1.5;">
        Pour garantir la continuité de vos encaissements et conserver l'accès fluide de vos caissiers sans blocage, nous vous recommandons de renouveler votre forfait dès aujourd'hui.
      </p>
    </div>

    <p>Le renouvellement prend moins d'une minute avec votre moyen de paiement habituel (Wave, Orange Money, Moov, MTN ou Carte Bancaire).</p>
  `;

  const html = renderEmailLayout({
    previewText: `Attention : Il vous reste ${params.daysRemaining} jour(s) avant la fin de votre formule ${params.planTier}.`,
    headerTitle: "Votre formule arrive à échéance",
    headerBadge: "Rappel de renouvellement",
    badgeColor: "#f59e0b",
    contentHtml,
    ctaText: "Renouveler mon abonnement en 1 clic",
    ctaUrl: params.renewUrl || `${BASE_URL}/settings`,
  });

  return { subject, html };
}

// ==============================================================================
// 3. TEMPLATE : ANNONCE DE MISE À JOUR DE L'APPLICATION
// ==============================================================================
export interface AppUpdateEmailParams {
  recipientName: string;
  updateTitle: string;
  version?: string;
  features: string[];
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function buildAppUpdateEmail(params: AppUpdateEmailParams): { subject: string; html: string } {
  const versionBadge = params.version ? `v${params.version}` : "Mise à jour";
  const subject = `✨ Nouveauté BoutiquePro : ${params.updateTitle}`;

  const featuresListHtml = params.features
    .map(
      (feat) => `
      <li style="margin-bottom: 10px; padding-left: 4px;">
        ${feat}
      </li>
    `
    )
    .join("");

  const contentHtml = `
    <p>Bonjour <strong>${params.recipientName || "Commerçant"}</strong>,</p>
    <p>${params.description || "Nous continuons d'améliorer votre outil de travail quotidien ! Une nouvelle mise à jour vient d'être déployée sur <strong>BoutiquePro</strong> :"}</p>

    <div style="background-color: #f1f5f9; border-radius: 14px; padding: 22px; margin: 24px 0;">
      <h3 style="margin: 0 0 14px 0; font-size: 15px; color: #1e293b;">🚀 Ce qui change pour vous :</h3>
      <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.6;">
        ${featuresListHtml}
      </ul>
    </div>

    <p style="margin-bottom: 0;">Ces nouveautés sont d'ores et déjà actives sur votre compte, sans aucune réinstallation nécessaire de votre part.</p>
  `;

  const html = renderEmailLayout({
    previewText: `Découvrez les nouveautés de BoutiquePro : ${params.updateTitle}`,
    headerTitle: params.updateTitle,
    headerBadge: versionBadge,
    badgeColor: "#6366f1",
    contentHtml,
    ctaText: params.ctaText || "Ouvrir BoutiquePro et tester",
    ctaUrl: params.ctaUrl || `${BASE_URL}/`,
  });

  return { subject, html };
}
