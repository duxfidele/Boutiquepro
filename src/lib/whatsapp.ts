import { Sale, StoreSettings, DebtPayment } from "@/context/StoreContext";

/**
 * Nettoie et formate un numéro de téléphone pour l'URL WhatsApp (wa.me/{number})
 * Supporte automatiquement le Togo (+228), Bénin (+229), Côte d'Ivoire (+225)
 * et tout numéro au format international (+XX... ou 00XX...).
 */
export function formatWhatsAppNumber(phone?: string, defaultCountryCode: string = "228"): string | null {
  if (!phone) return null;
  
  let clean = phone.trim().replace(/[^\d+]/g, "");
  if (!clean) return null;

  if (clean.startsWith("+")) {
    clean = clean.substring(1);
  } else if (clean.startsWith("00")) {
    clean = clean.substring(2);
  } else {
    if (clean.startsWith("0") && clean.length > 8) {
      clean = clean.substring(1);
      clean = defaultCountryCode + clean;
    } else if (clean.length === 8) {
      clean = defaultCountryCode + clean;
    } else if (clean.length === 10 && defaultCountryCode === "225") {
      clean = "225" + clean;
    }
  }

  return clean.length >= 8 ? clean : null;
}

/**
 * Construit l'URL wa.me avec le message encodé de façon sûre (sans caractères corrompus)
 */
export function getWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = formatWhatsAppNumber(phone) || phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export interface WhatsAppCashierOptions {
  cashierName?: string;
  cashierPhone?: string;
}

/**
 * Génère le texte d'un Ticket de Caisse / Reçu de Vente formaté pour WhatsApp
 * Garanti 100% universel et propre : zéro emoji fragile qui se transforme en symbole '',
 * nom et numéro du caissier inclus, sans mention de marque superflue.
 */
export function buildWhatsAppReceiptText(
  sale: Sale,
  settings?: StoreSettings | null,
  cashierOpt?: string | WhatsAppCashierOptions
): string {
  const storeName = settings?.name || "Notre Boutique";
  const currency = settings?.currency || "FCFA";
  const dateObj = new Date(sale.createdAt || Date.now());
  const dateStr = dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const ticketRef = `BTQ-${sale.id.slice(0, 8).toUpperCase()}`;

  const cashierName = typeof cashierOpt === "string" ? cashierOpt : cashierOpt?.cashierName;
  const cashierPhone = typeof cashierOpt === "object" ? cashierOpt?.cashierPhone : undefined;

  const paymentLabels: Record<string, string> = {
    cash: "Espèces (Comptant)",
    mobile_money: "Mobile Money",
    card: "Carte bancaire",
    credit: "Vente à Crédit (Carnet de Dettes)",
  };
  const paymentMethodLabel = paymentLabels[sale.paymentMethod] || sale.paymentMethod;

  const itemsText = (sale.items || [])
    .map((item) => {
      const priceStr = new Intl.NumberFormat("fr-FR").format(item.total);
      return `• *${item.quantity}x* ${item.productName} — ${priceStr} ${currency}`;
    })
    .join("\n");

  const subtotalStr = new Intl.NumberFormat("fr-FR").format(sale.subtotal);
  const totalStr = new Intl.NumberFormat("fr-FR").format(sale.total);

  let message = `*TICKET DE CAISSE — ${storeName.toUpperCase()}*\n`;
  if (settings?.city || settings?.country) {
    message += `${[settings.city, settings.country].filter(Boolean).join(", ")}\n`;
  }
  if (settings?.phone) {
    message += `Contact : ${settings.phone}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Ticket N° : ${ticketRef}\n`;
  message += `Date : ${dateStr} à ${timeStr}\n`;
  if (sale.customerName) {
    message += `Client : ${sale.customerName}\n`;
  }
  if (cashierName) {
    message += `Caissier : ${cashierName}\n`;
  }
  if (cashierPhone) {
    message += `Tél. Caissier : ${cashierPhone}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `*DÉTAIL DES ACHATS :*\n${itemsText}\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (sale.discount && sale.discount > 0) {
    const discountStr = new Intl.NumberFormat("fr-FR").format(sale.discount);
    message += `Sous-total : ${subtotalStr} ${currency}\n`;
    message += `Remise : -${discountStr} ${currency}\n`;
  }

  message += `*TOTAL NET : ${totalStr} ${currency}*\n`;
  message += `Règlement : ${paymentMethodLabel}\n`;

  if (sale.paymentMethod === "cash" && sale.amountGiven && sale.amountGiven > sale.total) {
    const givenStr = new Intl.NumberFormat("fr-FR").format(sale.amountGiven);
    const changeStr = new Intl.NumberFormat("fr-FR").format(sale.change || (sale.amountGiven - sale.total));
    message += `Montant reçu : ${givenStr} ${currency}\n`;
    message += `Monnaie rendue : ${changeStr} ${currency}\n`;
  } else if (sale.paymentMethod === "credit") {
    const paidStr = new Intl.NumberFormat("fr-FR").format(sale.amountPaid || 0);
    const remaining = sale.remainingAmount ?? (sale.total - (sale.amountPaid || 0));
    const remainingStr = new Intl.NumberFormat("fr-FR").format(remaining);
    message += `Acompte versé : ${paidStr} ${currency}\n`;
    message += `*Solde restant dû : ${remainingStr} ${currency}*\n`;
    if (sale.dueDate) {
      const dueStr = new Date(sale.dueDate).toLocaleDateString("fr-FR");
      message += `Date limite de règlement : ${dueStr}\n`;
    }
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Merci pour votre confiance et à très bientôt !`;

  return message;
}

/**
 * Génère le texte de relance courtoise pour une créance client (Carnet de Dettes)
 * Sans emojis corrompus, clair et professionnel.
 */
export function buildWhatsAppDebtReminderText(
  debt: Sale,
  settings?: StoreSettings | null,
  remainingAmount?: number,
  cashierOpt?: string | WhatsAppCashierOptions
): string {
  const storeName = settings?.name || "Notre Boutique";
  const currency = settings?.currency || "FCFA";
  const rem = remainingAmount !== undefined ? remainingAmount : (debt.remainingAmount ?? (debt.total - (debt.amountPaid || 0)));
  const remStr = new Intl.NumberFormat("fr-FR").format(rem);
  const totalStr = new Intl.NumberFormat("fr-FR").format(debt.total);
  const paidStr = new Intl.NumberFormat("fr-FR").format(debt.amountPaid || 0);
  const dateStr = new Date(debt.createdAt).toLocaleDateString("fr-FR");
  const clientName = debt.customerName || "cher(e) client(e)";
  const ticketRef = `BTQ-${debt.id.slice(0, 8).toUpperCase()}`;

  const cashierName = typeof cashierOpt === "string" ? cashierOpt : cashierOpt?.cashierName;
  const cashierPhone = typeof cashierOpt === "object" ? cashierOpt?.cashierPhone : undefined;

  // Priorité absolue au numéro enregistré du caissier
  const contactPhone = cashierPhone || settings?.phone;

  let msg = `Bonjour *${clientName}*,\n\n`;
  msg += `Nous vous remercions pour votre confiance auprès de *${storeName}*.\n\n`;
  msg += `Nous vous adressons ce petit rappel amical concernant votre achat du ${dateStr} (Réf : ${ticketRef}).\n\n`;
  msg += `*Point sur votre compte client :*\n`;
  msg += `• Total de vos achats : ${totalStr} ${currency}\n`;
  if ((debt.amountPaid || 0) > 0) {
    msg += `• Acompte déjà réglé : ${paidStr} ${currency}\n`;
  }
  msg += `*Solde restant à régler : ${remStr} ${currency}*\n`;

  if (debt.dueDate) {
    const dueDateStr = new Date(debt.dueDate).toLocaleDateString("fr-FR");
    const isOverdue = new Date(debt.dueDate) < new Date();
    if (isOverdue) {
      msg += `Échéance dépassée depuis le : ${dueDateStr}\n`;
    } else {
      msg += `Date limite de règlement : ${dueDateStr}\n`;
    }
  }

  msg += `\nMerci de bien vouloir nous contacter ou passer à la boutique pour régulariser votre compte.\n`;
  if (contactPhone) {
    msg += `Vous pouvez me joindre directement au : ${contactPhone}\n`;
  }
  msg += `\nExcellente journée à vous !\n`;
  if (cashierName && cashierName !== "Caissier" && cashierName !== "Gérant") {
    msg += `${cashierName} • `;
  }
  msg += `_${storeName}_`;

  return msg;
}

/**
 * Génère le texte de quittance de paiement après un versement de recouvrement
 * Sans emojis corrompus, clair et professionnel.
 */
export function buildWhatsAppDebtPaymentReceiptText(
  debt: Sale,
  payment: DebtPayment,
  newRemaining: number,
  settings?: StoreSettings | null
): string {
  const storeName = settings?.name || "Notre Boutique";
  const currency = settings?.currency || "FCFA";
  const clientName = debt.customerName || "cher(e) client(e)";
  const paymentAmountStr = new Intl.NumberFormat("fr-FR").format(payment.amount);
  const remainingStr = new Intl.NumberFormat("fr-FR").format(newRemaining);
  const dateStr = new Date(payment.paidAt).toLocaleDateString("fr-FR");
  const timeStr = new Date(payment.paidAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const paymentRef = `#REC-${payment.id.slice(0, 6).toUpperCase()}`;

  let msg = `Bonjour *${clientName}*,\n\n`;
  msg += `Nous vous confirmons la bonne réception de votre versement auprès de *${storeName}* :\n\n`;
  msg += `*QUITTANCE DE RÈGLEMENT ${paymentRef}*\n`;
  msg += `• Date : ${dateStr} à ${timeStr}\n`;
  msg += `• Montant versé : *${paymentAmountStr} ${currency}*\n`;
  if (payment.paymentMethod) {
    const methodStr = payment.paymentMethod === "cash" ? "Espèces" : payment.paymentMethod === "mobile_money" ? "Mobile Money" : "Carte";
    msg += `• Mode : ${methodStr}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (newRemaining <= 0) {
    msg += `*Félicitations ! Votre dette est désormais TOTALEMENT SOLDÉE.* Merci pour votre sérieux et votre fidélité !\n`;
  } else {
    msg += `*Nouveau solde restant dû : ${remainingStr} ${currency}*\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Merci pour votre confiance et à très bientôt !\n`;
  msg += `_${storeName}_`;

  return msg;
}
