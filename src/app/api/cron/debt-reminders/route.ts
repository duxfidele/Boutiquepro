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
    const nowIso = new Date().toISOString();

    // 1. Récupérer les ventes à crédit avec reste dû non nul et date d'échéance dépassée
    const { data: overdueSales, error } = await supabaseServer
      .from("sales")
      .select("id, store_id, customer_name, customer_phone, remaining_amount, due_date, total")
      .gt("remaining_amount", 0)
      .lte("due_date", nowIso)
      .order("due_date", { ascending: true })
      .limit(200);

    if (error) {
      console.error("[Cron:debt-reminders] Erreur lecture dettes:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!overdueSales || overdueSales.length === 0) {
      return NextResponse.json({
        success: true,
        job: "debt-reminders",
        overdueSalesCount: 0,
        alertsSent: 0,
      });
    }

    // 2. Grouper par boutique
    const debtsByStore = new Map<string, typeof overdueSales>();
    for (const sale of overdueSales) {
      const list = debtsByStore.get(sale.store_id) || [];
      list.push(sale);
      debtsByStore.set(sale.store_id, list);
    }

    let alertsCount = 0;

    for (const [storeId, storeDebts] of Array.from(debtsByStore.entries())) {
      const { data: adminMember } = await supabaseServer
        .from("store_members")
        .select("user_id, profiles(email, full_name)")
        .eq("store_id", storeId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      const profile = adminMember?.profiles as any;
      if (profile?.email) {
        const totalOverdue = storeDebts.reduce((sum: number, s: any) => sum + Number(s.remaining_amount || 0), 0);

        const rowsHtml = storeDebts
          .map((s: any) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>${s.customer_name || "Client"}</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${s.customer_phone || "-"}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">
                ${Number(s.remaining_amount).toLocaleString("fr-FR")} FCFA
              </td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                ${s.due_date ? new Date(s.due_date).toLocaleDateString("fr-FR") : "Dépassée"}
              </td>
            </tr>
          `)
          .join("");

        await queueEmail({
          storeId,
          to: profile.email,
          subject: `📋 Récapitulatif Hebdomadaire : ${storeDebts.length} créance(s) en retard (${totalOverdue.toLocaleString("fr-FR")} FCFA)`,
          html: `
            <h2>Bonjour ${profile.full_name || "Commerçant"},</h2>
            <p>Voici votre point hebdomadaire sur le carnet de dettes de votre boutique.</p>
            <p>Vous avez actuellement <strong>${storeDebts.length} créance(s) arrivée(s) à échéance</strong> pour un montant total impayé de <strong>${totalOverdue.toLocaleString("fr-FR")} FCFA</strong> :</p>
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px;">Client</th>
                  <th style="padding: 8px;">Contact</th>
                  <th style="padding: 8px;">Reste à payer</th>
                  <th style="padding: 8px;">Date d'échéance</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <p style="margin-top: 16px;">Vous pouvez envoyer un rappel WhatsApp direct à vos clients depuis le module « Dettes & Crédits » de l'application.</p>
          `,
          templateName: "debt_reminder_recap",
          metadata: { total_overdue: totalOverdue, count: storeDebts.length },
        });

        alertsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      job: "debt-reminders",
      overdueSalesCount: overdueSales.length,
      storesAlerted: alertsCount,
      timestamp: nowIso,
    });
  } catch (err: any) {
    console.error("[Cron:debt-reminders] Erreur:", err);
    return NextResponse.json({ error: err?.message || "Erreur cron dettes" }, { status: 500 });
  }
}
