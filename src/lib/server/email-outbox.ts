import { supabaseServer } from "@/lib/server/supabase-server";

export interface OutboxEmailPayload {
  storeId?: string;
  to: string;
  subject: string;
  html: string;
  templateName?: string;
  metadata?: Record<string, any>;
}

/**
 * Enregistre un email dans la file d'attente Outbox (Transactional Outbox Pattern).
 * Garantit que l'email est sauvegardé même si le réseau externe est temporairement indisponible.
 */
export async function queueEmail(payload: OutboxEmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabaseServer
      .from("email_outbox")
      .insert({
        store_id: payload.storeId || null,
        to_email: payload.to,
        subject: payload.subject,
        html_content: payload.html,
        template_name: payload.templateName || "custom",
        metadata: payload.metadata || {},
        status: "pending",
        attempts: 0,
        max_attempts: 3,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[EmailOutbox] Erreur insertion queue:", error);
      return { success: false, error: error.message };
    }

    // Tentative d'envoi immédiat en direct (sans attendre le cron)
    sendEmailViaResend(payload.to, payload.subject, payload.html).then(async (sendRes) => {
      if (sendRes.success) {
        await supabaseServer
          .from("email_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: 1,
          })
          .eq("id", data.id);
      } else {
        await supabaseServer
          .from("email_outbox")
          .update({
            last_error: sendRes.error,
          })
          .eq("id", data.id);
      }
    }).catch((err) => {
      console.warn("[EmailOutbox] Échec tentative envoi direct:", err);
    });

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[EmailOutbox] Exception queue:", err);
    return { success: false, error: err?.message || "Erreur interne queue email" };
  }
}

/**
 * Envoie un email individuel via l'API Resend HTTP.
 */
export async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "BoutiquePro <notifications@boutiquepro.app>";

  if (!apiKey) {
    return {
      success: false,
      error: "RESEND_API_KEY non configurée dans l'environnement serveur.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.message || `Erreur Resend HTTP ${res.status}`,
      };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Exception lors de l'appel à Resend",
    };
  }
}

/**
 * Dépile et traite les emails en attente dans la table email_outbox.
 * Conçu pour être exécuté par le Cron Vercel (`/api/cron/process-outbox`).
 */
export async function processOutboxQueue(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  let sentCount = 0;
  let failedCount = 0;

  // 1. Récupération des emails à traiter
  const { data: emails, error } = await supabaseServer
    .from("email_outbox")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !emails || emails.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  for (const item of emails) {
    // Marquer comme 'processing'
    await supabaseServer
      .from("email_outbox")
      .update({ status: "processing" })
      .eq("id", item.id);

    const result = await sendEmailViaResend(item.to_email, item.subject, item.html_content);

    if (result.success) {
      await supabaseServer
        .from("email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: item.attempts + 1,
          last_error: null,
        })
        .eq("id", item.id);
      sentCount++;
    } else {
      const nextAttempts = item.attempts + 1;
      const finalStatus = nextAttempts >= item.max_attempts ? "failed" : "pending";

      await supabaseServer
        .from("email_outbox")
        .update({
          status: finalStatus,
          attempts: nextAttempts,
          last_error: result.error,
        })
        .eq("id", item.id);
      failedCount++;
    }
  }

  return {
    processed: emails.length,
    sent: sentCount,
    failed: failedCount,
  };
}

