import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { queueEmail } from "@/lib/server/email-outbox";
import { buildSubscriptionExpiringEmail } from "@/lib/server/email-templates";

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

    // 3. Détection des abonnements et essais finissant dans les 3 prochains jours (Alerte d'échéance)
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    
    // A. Essais gratuits se terminant dans 3 jours
    const { data: warningTrials } = await supabaseServer
      .from("admin_subscriptions")
      .select("user_id, plan_tier, trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", nowIso)
      .lte("trial_ends_at", in3Days);

    // B. Abonnements payants se terminant dans 3 jours
    const { data: warningActives } = await supabaseServer
      .from("admin_subscriptions")
      .select("user_id, plan_tier, current_period_ends_at")
      .eq("status", "active")
      .gte("current_period_ends_at", nowIso)
      .lte("current_period_ends_at", in3Days);

    const allExpiring = [
      ...(warningTrials || []).map((t) => ({
        userId: t.user_id,
        tier: t.plan_tier || "PRO",
        expiryDate: t.trial_ends_at,
        isTrial: true,
      })),
      ...(warningActives || []).map((a) => ({
        userId: a.user_id,
        tier: a.plan_tier || "PRO",
        expiryDate: a.current_period_ends_at,
        isTrial: false,
      })),
    ];

    if (allExpiring.length > 0) {
      for (const item of allExpiring) {
        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("email, full_name")
          .eq("id", item.userId)
          .maybeSingle();

        const { data: store } = await supabaseServer
          .from("stores")
          .select("id, name")
          .eq("owner_id", item.userId)
          .limit(1)
          .maybeSingle();

        if (profile?.email && item.expiryDate) {
          const diffMs = new Date(item.expiryDate).getTime() - Date.now();
          const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

          const emailData = buildSubscriptionExpiringEmail({
            recipientName: profile.full_name || "Commerçant",
            storeName: store?.name || "Votre Boutique",
            planTier: item.tier,
            daysRemaining,
            expirationDate: item.expiryDate,
          });

          await queueEmail({
            storeId: store?.id,
            to: profile.email,
            subject: emailData.subject,
            html: emailData.html,
            templateName: "subscription_expiring_warning",
            metadata: { user_id: item.userId, days_remaining: daysRemaining, tier: item.tier },
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

