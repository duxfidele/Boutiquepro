import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { logAuditEvent } from "@/lib/server/audit-logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const startOfDay = `${todayStr}T00:00:00.000Z`;
    const endOfDay = `${todayStr}T23:59:59.999Z`;

    // 1. Récupérer les ventes conclues aujourd'hui
    const { data: sales, error } = await supabaseServer
      .from("sales")
      .select("id, store_id, total, created_at")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    if (error) {
      console.error("[Cron:daily-metrics] Erreur lecture ventes:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Agréger par boutique
    const metricsMap = new Map<string, { totalRevenue: number; salesCount: number }>();

    if (sales) {
      for (const s of sales) {
        const current = metricsMap.get(s.store_id) || { totalRevenue: 0, salesCount: 0 };
        current.totalRevenue += Number(s.total || 0);
        current.salesCount += 1;
        metricsMap.set(s.store_id, current);
      }
    }

    let upsertedCount = 0;

    for (const [storeId, metric] of Array.from(metricsMap.entries())) {
      await supabaseServer.from("daily_metrics").upsert(
        {
          store_id: storeId,
          date: todayStr,
          total_revenue: metric.totalRevenue,
          total_sales_count: metric.salesCount,
          created_at: new Date().toISOString(),
        },
        { onConflict: "store_id,date" }
      );
      upsertedCount++;
    }

    // Enregistrer l'événement dans les logs d'audit
    await logAuditEvent({
      action: "CRON_DAILY_METRICS_COMPUTED",
      entityType: "daily_metrics",
      newValues: { date: todayStr, stores_aggregated: upsertedCount },
      request,
    });

    return NextResponse.json({
      success: true,
      job: "daily-metrics",
      date: todayStr,
      storesUpdated: upsertedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron:daily-metrics] Erreur:", err);
    return NextResponse.json({ error: err?.message || "Erreur cron métriques" }, { status: 500 });
  }
}
