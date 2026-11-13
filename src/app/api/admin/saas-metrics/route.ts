import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPER_ADMIN_EMAIL = "profidele91@gmail.com";

/**
 * Vérification stricte des autorisations Super Admin
 */
async function authenticateSuperAdmin(request: Request): Promise<{
  authorized: boolean;
  email?: string;
  response?: NextResponse;
}> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Token d'authentification manquant." },
        { status: 401 }
      ),
    };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseServer.auth.getUser(token);

    if (error || !user || !user.email) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Session invalide ou expirée." },
          { status: 401 }
        ),
      };
    }

    if (user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error:
              "Accès strictement réservé au Super Administrateur MaBoutiquePro.",
          },
          { status: 403 }
        ),
      };
    }

    return { authorized: true, email: user.email.toLowerCase() };
  } catch (err: any) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Erreur lors de la vérification de session." },
        { status: 500 }
      ),
    };
  }
}

/**
 * GET /api/admin/saas-metrics
 * Récupère les métriques globales de l'éditeur SaaS MaBoutiquePro :
 * - Chiffre d'affaires propre du SaaS (abonnements encaissés)
 * - Nombre de boutiques & statut d'abonnement (essai, actif, expiré)
 * - Nombre d'utilisateurs inscrits (gérants et caissiers)
 * - Historique des règlements d'abonnements
 *
 * RÈGLE D'OR & CONFIDENTIALITÉ :
 * AUCUNE donnée commerciale marchande (chiffre d'affaires des commerçants,
 * paniers moyens, bénéfices des boutiques) n'est jamais exposée ni consultable.
 */
export async function GET(request: Request) {
  const auth = await authenticateSuperAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    // 1. Récupération des boutiques
    const { data: storesData, error: storesErr } = await supabaseServer
      .from("stores")
      .select(
        "id, name, created_at, owner_id, subscription_plan, subscription_status, subscription_ends_at, business_sector"
      )
      .order("created_at", { ascending: false });

    if (storesErr) {
      console.error("[SaaSMetrics] Erreur stores:", storesErr);
    }

    const stores = storesData || [];

    // 2. Récupération des profils utilisateurs
    const { data: profilesData, error: profilesErr } = await supabaseServer
      .from("profiles")
      .select("id, email, full_name, role, phone, created_at")
      .order("created_at", { ascending: false });

    if (profilesErr) {
      console.error("[SaaSMetrics] Erreur profiles:", profilesErr);
    }

    const profiles = profilesData || [];

    // 3. Récupération des abonnements centralisés admin_subscriptions
    const { data: adminSubsData } = await supabaseServer
      .from("admin_subscriptions")
      .select(
        "user_id, plan_tier, status, billing_cycle, current_period_ends_at, trial_ends_at, max_stores, max_cashiers"
      );

    const adminSubsMap = new Map<string, any>();
    (adminSubsData || []).forEach((sub) => {
      if (sub.user_id) adminSubsMap.set(sub.user_id, sub);
    });

    const profilesMap = new Map<string, any>();
    profiles.forEach((p) => {
      if (p.id) profilesMap.set(p.id, p);
    });

    // 4. Récupération des paiements d'abonnements SaaS réussis
    let payments: any[] = [];
    const { data: paymentsData, error: paymentsErr } = await supabaseServer
      .from("moneriz_checkout_attempts")
      .select(
        "id, order_id, store_id, plan_id, amount, currency, reference, status, customer_email, created_at"
      )
      .in("status", ["paid", "succeeded"])
      .order("created_at", { ascending: false });

    if (paymentsErr) {
      console.warn(
        "[SaaSMetrics] Note: moneriz_checkout_attempts:",
        paymentsErr.message
      );
    } else if (paymentsData) {
      payments = paymentsData;
    }

    // 5. Calcul des métriques globales SaaS
    const totalSaaSFcfa = payments.reduce((sum, p) => {
      const amt = Number(p.amount) || 0;
      return sum + amt;
    }, 0);

    const now = new Date().getTime();

    let trialCount = 0;
    let activePaidCount = 0;
    let expiredCount = 0;

    const formattedStores = stores.map((s) => {
      const owner = s.owner_id ? profilesMap.get(s.owner_id) : null;
      const adminSub = s.owner_id ? adminSubsMap.get(s.owner_id) : null;

      // Détermination statut abonnement
      let planTier =
        adminSub?.plan_tier || s.subscription_plan || "TRIAL";
      let status = adminSub?.status || s.subscription_status || "trial";
      let endsAt =
        adminSub?.current_period_ends_at ||
        adminSub?.trial_ends_at ||
        s.subscription_ends_at;

      const isFounder =
        owner?.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
        owner?.email?.toLowerCase() === "saasfidele@gmail.com";

      let computedStatus: "trial" | "active" | "expired" = "trial";

      if (isFounder) {
        computedStatus = "active";
        planTier = "BUSINESS (Illimité)";
      } else if (status === "active") {
        if (endsAt && new Date(endsAt).getTime() < now) {
          computedStatus = "expired";
        } else {
          computedStatus = "active";
        }
      } else if (status === "trial" || status === "trialing") {
        if (endsAt && new Date(endsAt).getTime() < now) {
          computedStatus = "expired";
        } else {
          computedStatus = "trial";
        }
      } else if (status === "expired" || status === "past_due") {
        computedStatus = "expired";
      } else if (endsAt && new Date(endsAt).getTime() < now) {
        computedStatus = "expired";
      }

      if (computedStatus === "trial") trialCount++;
      else if (computedStatus === "active") activePaidCount++;
      else if (computedStatus === "expired") expiredCount++;

      return {
        id: s.id,
        name: s.name || "Sans nom",
        ownerId: s.owner_id,
        ownerName: owner?.full_name || "Non renseigné",
        ownerEmail: owner?.email || "Non renseigné",
        ownerPhone: owner?.phone || null,
        createdAt: s.created_at,
        businessSector: s.business_sector || "Non spécifié",
        subscriptionPlan: planTier,
        subscriptionStatus: computedStatus,
        subscriptionEndsAt: endsAt,
        isFounder,
      };
    });

    const totalAdmins = profiles.filter((p) => p.role === "admin").length;
    const totalCashiers = profiles.filter((p) => p.role === "cashier").length;

    const formattedUsers = profiles.map((p) => ({
      id: p.id,
      email: p.email || "Sans email",
      fullName: p.full_name || "Utilisateur",
      role: p.role || "admin",
      phone: p.phone || null,
      createdAt: p.created_at,
      isFounder:
        p.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
        p.email?.toLowerCase() === "saasfidele@gmail.com",
    }));

    return NextResponse.json({
      success: true,
      kpis: {
        totalSaaSFcfa,
        totalPaymentsCount: payments.length,
        totalStores: stores.length,
        totalUsers: profiles.length,
        totalAdmins,
        totalCashiers,
        activePaidCount,
        trialCount,
        expiredCount,
      },
      stores: formattedStores,
      users: formattedUsers,
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.order_id,
        storeId: p.store_id,
        planId: p.plan_id,
        amount: Number(p.amount) || 0,
        currency: p.currency || "XOF",
        reference: p.reference,
        customerEmail: p.customer_email,
        createdAt: p.created_at,
      })),
    });
  } catch (error: any) {
    console.error("[SaaSMetrics] Erreur globale:", error);
    return NextResponse.json(
      { error: error.message || "Erreur interne lors de la récupération." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/saas-metrics
 * Action Super Admin pour ajuster manuellement l'abonnement d'un commerçant
 * (Utile pour valider un paiement manuel Wave, TMoney, Virement ou Cash).
 */
export async function POST(request: Request) {
  const auth = await authenticateSuperAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { storeId, ownerId, planTier, durationMonths, status } = body;

    if (!storeId && !ownerId) {
      return NextResponse.json(
        { error: "Identifiant boutique ou propriétaire requis." },
        { status: 400 }
      );
    }

    const months = Number(durationMonths) || 1;
    const isLifetime = months >= 999;
    const now = new Date();
    const newEndsAt = isLifetime
      ? new Date(now.getTime() + 100 * 365 * 24 * 3600 * 1000).toISOString()
      : new Date(now.getTime() + months * 30 * 24 * 3600 * 1000).toISOString();

    const selectedTier = ["STARTER", "PRO", "BUSINESS"].includes(planTier)
      ? planTier
      : "PRO";
    const selectedStatus = status === "trial" ? "trial" : "active";

    // 1. Mettre à jour la boutique ciblée
    if (storeId) {
      await supabaseServer
        .from("stores")
        .update({
          subscription_plan: selectedTier,
          subscription_status: selectedStatus,
          subscription_ends_at: newEndsAt,
        })
        .eq("id", storeId);
    }

    // 2. Si ownerId est renseigné, mettre à jour admin_subscriptions et toutes ses boutiques
    if (ownerId) {
      await supabaseServer.from("admin_subscriptions").upsert({
        user_id: ownerId,
        plan_tier: selectedTier,
        status: selectedStatus,
        billing_cycle: months >= 12 ? "annual" : "monthly",
        current_period_starts_at: now.toISOString(),
        current_period_ends_at: newEndsAt,
        max_stores: selectedTier === "BUSINESS" ? 3 : 1,
        max_cashiers: selectedTier === "BUSINESS" ? 3 : 1,
        updated_at: now.toISOString(),
      });

      // Aligner toutes les boutiques du propriétaire
      await supabaseServer
        .from("stores")
        .update({
          subscription_plan: selectedTier,
          subscription_status: selectedStatus,
          subscription_ends_at: newEndsAt,
        })
        .eq("owner_id", ownerId);
    }

    return NextResponse.json({
      success: true,
      message: `Abonnement ${selectedTier} mis à jour avec succès pour ${
        isLifetime ? "une durée illimitée" : `${months} mois`
      }.`,
      endsAt: newEndsAt,
      tier: selectedTier,
      status: selectedStatus,
    });
  } catch (error: any) {
    console.error("[SaaSMetrics] Erreur mise à jour:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la mise à jour." },
      { status: 500 }
    );
  }
}

