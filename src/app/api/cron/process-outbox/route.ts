import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { processOutboxQueue } from "@/lib/server/email-outbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const summary = await processOutboxQueue(25);
    return NextResponse.json({
      success: true,
      job: "process-outbox",
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron:process-outbox] Erreur:", err);
    return NextResponse.json({ error: err?.message || "Erreur cron outbox" }, { status: 500 });
  }
}

