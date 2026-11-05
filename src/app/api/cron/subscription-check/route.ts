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
    let expiredCount = 0;
    let warningsCount = 0;

    // 1. Détection des périodes d'essai expirées
    const { data: expiredTrials, error: errTrials } = await supabaseServer
      .from("admin_subscriptions")
      .select("user_id, plan_tier")
      .eq("status", "trialing")
      .lt("trial_ends_at", nowIso);

    if (expiredTrials && expiredTrials.length > 0) {
      const userIds = expiredTrials.map((s) => s.user_id);
      await supabaseServer
        .from("admin_subscriptions")
        .update({ status: "expired", updated_at: nowIso })
        .in("user_id", userIds);

      expiredCount += expiredTrials.length;
    }

    // 2. Détection des abonnements payants arrivés à échéance (passage en past_due)
    const { data: expiredActive, error: errActive } = await supabaseServer
      .from("admin_subscriptions")
      .select("user_id, plan_tier")
      .eq("status", "active")
      .lt("current_period_ends_at", nowIso);

    if (expiredActive && expiredActive.length > 0) {
      const userIds = expiredActive.map((s) => s.user_id);
      await supabaseServer
        .from("admin_subscriptions")
        .update({ status: "past_due", updated_at: nowIso })
        .in("user_id", userIds);

      expiredCount += expiredActive.length;
    }

    // 3. Détection des essais finissant dans 3 jours (Avertissement par email)
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: warningTrials } = await supabaseServer
      .from("admin_subscriptions")
      .select("user_id, trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", nowIso)
      .lte("trial_ends_at", in3Days);

    if (warningTrials && warningTrials.length > 0) {
      for (const trial of warningTrials) {
        // Récupérer l'email de l'admin
        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("email, full_name")
          .eq("id", trial.user_id)
          .maybeSingle();

        if (profile?.email) {
          await queueEmail({
            to: profile.email,
            subject: "Votre période d'essai BoutiquePro expire dans 3 jours",
            html: `
              <h2>Bonjour ${profile.full_name || "Commerçant"},</h2>
              <p>Votre période d'essai gratuit sur <strong>BoutiquePro</strong> prendra fin le <strong>${new Date(trial.trial_ends_at).toLocaleDateString("fr-FR")}</strong>.</p>
              <p>Pour continuer à gérer vos ventes, vos stocks et vos caissiers sans interruption, activez votre abonnement en toute simplicité depuis votre espace boutique.</p>
            `,
            templateName: "trial_expiring_warning",
            metadata: { user_id: trial.user_id },
          });
          warningsCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      job: "subscription-check",
      expiredUpdated: expiredCount,
      warningsQueued: warningsCount,
      timestamp: nowIso,
    });
  } catch (err: any) {
    console.error("[Cron:subscription-check] Erreur:", err);
    return NextResponse.json({ error: err?.message || "Erreur vérification abonnements" }, { status: 500 });
  }
}

