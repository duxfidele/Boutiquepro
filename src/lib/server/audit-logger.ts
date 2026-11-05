import { supabaseServer } from "@/lib/server/supabase-server";
import { getClientIp } from "@/lib/server/rate-limit";

export interface AuditLogEntry {
  storeId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  request?: Request;
}

/**
 * Enregistre un événement critique dans le journal d'audit infalsifiable de l'application.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    let ipAddress = "127.0.0.1";
    let userAgent = "Unknown";

    if (entry.request) {
      ipAddress = getClientIp(entry.request);
      userAgent = entry.request.headers.get("user-agent") || "Unknown";
    }

    const { data, error } = await supabaseServer
      .from("audit_logs")
      .insert({
        store_id: entry.storeId || null,
        user_id: entry.userId || null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        old_values: entry.oldValues || null,
        new_values: entry.newValues || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[AuditLog] Échec insertion log:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[AuditLog] Exception:", err);
    return { success: false, error: err?.message || "Erreur audit logger" };
  }
}

