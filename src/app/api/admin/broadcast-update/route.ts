import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { queueEmail } from "@/lib/server/email-outbox";
import { buildAppUpdateEmail } from "@/lib/server/email-templates";
import { logAuditEvent } from "@/lib/server/audit-logger";

export const dynamic = "force-dynamic";

/**
 * Route d'envoi d'annonces de mise à jour à l'ensemble des commerçants inscrits.
 * Protégée par l'en-tête `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const {
      updateTitle,
      version,
      features,
      description,
      ctaText,
      ctaUrl,
    } = body;

    if (!updateTitle || !Array.isArray(features) || features.length === 0) {
      return NextResponse.json(
        { error: "Paramètres manquants : 'updateTitle' et une liste 'features' sont requis." },
        { status: 400 }
      );
    }

    // 1. Récupérer tous les administrateurs et commerçants ayant un email valide
    const { data: admins, error } = await supabaseServer
      .from("profiles")
      .select("id, email, full_name, role")
      .not("email", "is", null);

    if (error) {
      console.error("[BroadcastUpdate] Erreur lecture profils:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!admins || admins.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucun administrateur trouvé à notifier.",
        queuedCount: 0,
      });
    }

    // Dédoublonner par email
    const seenEmails = new Set<string>();
    let queuedCount = 0;

    for (const admin of admins) {
      const email = admin.email?.trim().toLowerCase();
      if (!email || seenEmails.has(email) || !email.includes("@")) {
        continue;
      }
      seenEmails.add(email);

      const emailData = buildAppUpdateEmail({
        recipientName: admin.full_name || "Commerçant",
        updateTitle,
        version,
        features,
        description,
        ctaText,
        ctaUrl,
      });

      await queueEmail({
        to: email,
        subject: emailData.subject,
        html: emailData.html,
        templateName: "app_update_announcement",
        metadata: {
          admin_id: admin.id,
          version: version || "latest",
          title: updateTitle,
        },
      });

      queuedCount++;
    }

    // Journalisation de l'opération dans le journal d'audit infalsifiable
    await logAuditEvent({
      action: "APP_UPDATE_BROADCAST_SENT",
      entityType: "announcement",
      newValues: {
        updateTitle,
        version,
        total_recipients: queuedCount,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `Annonce de mise à jour mise en file d'attente pour ${queuedCount} commerçant(s).`,
      queuedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[BroadcastUpdate] Erreur:", err);
    return NextResponse.json(
      { error: err?.message || "Erreur lors de l'envoi de l'annonce de mise à jour." },
      { status: 500 }
    );
  }
}
