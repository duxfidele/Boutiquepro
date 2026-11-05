import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { queueEmail } from "@/lib/server/email-outbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const today = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    // 1. Récupérer les lots en stock expirant dans moins de 30 jours
    const { data: batches, error } = await supabaseServer
      .from("product_batches")
      .select("id, store_id, product_id, batch_number, expiry_date, current_quantity, products(name)")
      .gt("current_quantity", 0)
      .lte("expiry_date", in30Days)
      .order("expiry_date", { ascending: true });

    if (error) {
      console.error("[Cron:expiry-alerts] Erreur lecture batches:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!batches || batches.length === 0) {
      return NextResponse.json({
        success: true,
        job: "expiry-alerts",
        batchesFound: 0,
        alertsSent: 0,
      });
    }

    // 2. Grouper par boutique
    const batchesByStore = new Map<string, typeof batches>();
    for (const b of batches) {
      const list = batchesByStore.get(b.store_id) || [];
      list.push(b);
      batchesByStore.set(b.store_id, list);
    }

    let alertsCount = 0;

    for (const [storeId, storeBatches] of Array.from(batchesByStore.entries())) {
      // Trouver l'email du gérant/admin de cette boutique
      const { data: adminMember } = await supabaseServer
        .from("store_members")
        .select("user_id, profiles(email, full_name)")
        .eq("store_id", storeId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      const profile = adminMember?.profiles as any;
      if (profile?.email) {
        const rowsHtml = storeBatches
          .map((b: any) => {
            const isAlreadyExpired = b.expiry_date < todayStr;
            const badgeColor = isAlreadyExpired ? "#dc2626" : "#d97706";
            const statusLabel = isAlreadyExpired ? "PÉRIMÉ" : "Expire bientôt";
            const prodName = b.products?.name || `Produit #${b.product_id}`;

            return `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>${prodName}</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Lot n°${b.batch_number}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${b.current_quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(b.expiry_date).toLocaleDateString("fr-FR")}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${badgeColor}; font-weight: bold;">${statusLabel}</td>
              </tr>
            `;
          })
          .join("");

        await queueEmail({
          storeId,
          to: profile.email,
          subject: `⚠️ Alerte Traçabilité : ${storeBatches.length} lot(s) proche(s) de la péremption`,
          html: `
            <h2>Bonjour ${profile.full_name || "Commerçant"},</h2>
            <p>Le contrôle automatique de vos stocks a identifié <strong>${storeBatches.length} lot(s)</strong> approchant ou ayant dépassé leur date limite de consommation :</p>
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px;">Article</th>
                  <th style="padding: 8px;">N° Lot</th>
                  <th style="padding: 8px;">Stock restant</th>
                  <th style="padding: 8px;">Échéance DLC</th>
                  <th style="padding: 8px;">État</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <p style="margin-top: 16px;">Pensez à appliquer la méthode FEFO (Premier Expiré, Premier Sorti) ou une promotion de déstockage.</p>
          `,
          templateName: "expiry_alert",
          metadata: { batches_count: storeBatches.length },
        });

        alertsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      job: "expiry-alerts",
      batchesChecked: batches.length,
      storesAlerted: alertsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron:expiry-alerts] Erreur:", err);
    return NextResponse.json({ error: err?.message || "Erreur cron péremption" }, { status: 500 });
  }
}
