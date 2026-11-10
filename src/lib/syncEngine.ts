import type {
  CashSession,
  Category,
  Customer,
  DebtPayment,
  Expense,
  InventorySession,
  Order,
  PriceHistoryEntry,
  Product,
  ProductBatch,
  ProductUnit,
  Quote,
  Sale,
  StoreSettings,
  StoreState,
} from "@/context/StoreContext";
import {
  appendSyncLog,
  broadcastOfflineEvent,
  clearOutboxForScope,
  getAllSyncCursorsForScope,
  getOutboxItem,
  getOutboxItems,
  isAdminRole,
  makeScopeKey,
  markOutboxAuthPaused,
  removeOutboxItem,
  saveStoreSnapshot,
  saveSyncCursor,
  sortOutboxItemsDeterministically,
  updateOutboxItem,
  type OutboxConflictData,
  type OutboxItem,
  type StoreSnapshotExtra,
} from "@/lib/offlineDb";
import {
  isAuthInvalidError,
  isCaptivePortalOrParseError,
  reportNetworkFailure,
  reportNetworkSuccess,
} from "@/lib/networkMonitor";
import { isNetworkLikeError, withNetworkTimeout } from "@/lib/offlineQueue";
import { supabase } from "@/lib/supabase";

// ─── Configuration Backoff & Verrou ─────────────────────────────────────────

const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_LEASE_MS = 35000;
const MAX_DETERMINISTIC_RETRIES = 3;
const CURSOR_OVERLAP_MS = 5000;

export interface SyncRunResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  authPaused: boolean;
  networkOffline: boolean;
  skippedLocked: boolean;
  syncedEntityTypes: string[];
}

export interface PullStateResult {
  state: StoreState;
  extra: StoreSnapshotExtra;
  serverSyncAt: string;
  wasIncremental: boolean;
}

const inflightScopeSync = new Map<string, Promise<SyncRunResult>>();
const tabInstanceId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Calcul Backoff Exponentiel + Jitter ────────────────────────────────────

export function computeExponentialBackoffMs(retryCount: number): number {
  const exp = Math.min(8, Math.max(0, retryCount - 1));
  const raw = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, exp));
  // Jitter ±20 % pour éviter les rafales simultanées de reconnexion
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(raw * jitterFactor);
}

// ─── Taxonomie d'Erreurs SQL / Réseau / Conflits ─────────────────────────────

function extractErrMsg(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as {
    message?: string;
    details?: string;
    hint?: string;
    error_description?: string;
  };
  return [e.message, e.details, e.hint, e.error_description]
    .filter(Boolean)
    .join(" — ");
}

function isSubscriptionOrQuotaError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string; details?: string };
  const msg = String(e.message || e.details || "").toLowerCase();
  return (
    msg.includes("abonnement expiré") ||
    msg.includes("sub_gate") ||
    msg.includes("is_store_subscription_active") ||
    msg.includes("starter") ||
    msg.includes("forfait") ||
    msg.includes("limite atteinte") ||
    msg.includes("quota") ||
    (e.code === "P0001" &&
      (msg.includes("abonnement") ||
        msg.includes("souscription") ||
        msg.includes("essai") ||
        msg.includes("plan")))
  );
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; status?: number; message?: string };
  const msg = String(e.message || "").toLowerCase();
  return (
    e.code === "42501" ||
    e.status === 403 ||
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("action réservée") ||
    msg.includes("accès refusé")
  );
}

function isDuplicateKeyError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string; details?: string };
  const msg = `${e.message || ""} ${e.details || ""}`.toLowerCase();
  return (
    e.code === "23505" ||
    msg.includes("duplicate key") ||
    msg.includes("already exists") ||
    msg.includes("sales_pkey")
  );
}

function detectConflictCode(err: unknown): string | null {
  if (!err) return null;
  const msg = extractErrMsg(err);
  if (msg.includes("CONFLICT_DEBT_ALREADY_PAID")) {
    return "CONFLICT_DEBT_ALREADY_PAID";
  }
  if (msg.includes("CONFLICT_QUOTE_ALREADY_CONVERTED")) {
    return "CONFLICT_QUOTE_ALREADY_CONVERTED";
  }
  if (msg.includes("CONFLICT_SESSION_ALREADY_CLOSED")) {
    return "CONFLICT_SESSION_ALREADY_CLOSED";
  }
  if (msg.includes("VERSION_MISMATCH")) {
    return "VERSION_MISMATCH";
  }
  if (msg.includes("QUOTE_ALREADY_CONVERTED")) {
    return "QUOTE_ALREADY_CONVERTED";
  }
  return null;
}

function isNonRetryableSqlValidationError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; status?: number };
  const code = String(e.code || "");
  return (
    code === "22P02" || // invalid text representation
    code === "23502" || // not null violation
    code === "23514" || // check constraint violation
    code === "P0002" // no_data_found (e.g. target entity deleted)
  );
}

// ─── Verrou Distribué Multi-Onglets ─────────────────────────────────────────

async function runWithMultiTabLock<T>(
  storeId: string,
  fn: () => Promise<T>,
  onLocked: () => T
): Promise<T> {
  const lockName = `boutiquepro_sync_lock_${storeId}`;

  // 1. Web Locks API (standard sur Chrome, Edge, Firefox, Safari >= 15.4)
  if (
    typeof navigator !== "undefined" &&
    navigator.locks &&
    typeof navigator.locks.request === "function"
  ) {
    let executed = false;
    let result!: T;
    await navigator.locks.request(
      lockName,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) {
          result = onLocked();
          return;
        }
        executed = true;
        result = await fn();
      }
    );
    return executed ? result : onLocked();
  }

  // 2. Fallback bail localStorage horodaté (tests / navigateurs anciens)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(lockName);
      if (raw) {
        const parsed = JSON.parse(raw) as { owner: string; expiresAt: number };
        if (parsed.owner !== tabInstanceId && parsed.expiresAt > Date.now()) {
          return onLocked();
        }
      }
      window.localStorage.setItem(
        lockName,
        JSON.stringify({
          owner: tabInstanceId,
          expiresAt: Date.now() + LOCK_LEASE_MS,
        })
      );
    } catch {}
  }

  try {
    return await fn();
  } finally {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(lockName);
        if (raw) {
          const parsed = JSON.parse(raw) as { owner: string };
          if (parsed.owner === tabInstanceId) {
            window.localStorage.removeItem(lockName);
          }
        }
      } catch {}
    }
  }
}

// ─── Récupération après interruption brutale ────────────────────────────────

export async function recoverStaleSyncingItems(
  userId: string,
  storeId: string
): Promise<number> {
  const scopeKey = makeScopeKey(userId, storeId);
  const stuck = await getOutboxItems({
    scopeKey,
    storeId,
    statuses: ["syncing"],
    includeLegacyUserForStore: true,
  });

  if (stuck.length === 0) return 0;

  let recovered = 0;
  for (const item of stuck) {
    await updateOutboxItem(item.id, {
      status: "pending",
      nextRetryAt: new Date(0).toISOString(),
    });
    recovered += 1;
  }
  return recovered;
}

// ─── Exécuteur Unitaire d'une Opération Outbox ──────────────────────────────

type StepOutcome =
  | { kind: "success" }
  | { kind: "conflict"; conflictData: OutboxConflictData }
  | { kind: "auth_error"; error: unknown }
  | { kind: "network_error"; error: unknown }
  | { kind: "permanent_error"; error: unknown; code?: string }
  | { kind: "retryable_error"; error: unknown };

function classifyThrownOrReturnedError(err: unknown): StepOutcome {
  if (isCaptivePortalOrParseError(err) || isNetworkLikeError(err)) {
    reportNetworkFailure(err);
    return { kind: "network_error", error: err };
  }
  if (isAuthInvalidError(err)) {
    reportNetworkFailure(err);
    return { kind: "auth_error", error: err };
  }
  const conflictCode = detectConflictCode(err);
  if (conflictCode) {
    reportNetworkSuccess();
    return {
      kind: "conflict",
      conflictData: {
        code: conflictCode,
        message: extractErrMsg(err),
        detectedAt: new Date().toISOString(),
        resolutionOptions: ["keep_server", "dismiss"],
      },
    };
  }
  if (
    isSubscriptionOrQuotaError(err) ||
    isPermissionDeniedError(err) ||
    isNonRetryableSqlValidationError(err)
  ) {
    reportNetworkSuccess();
    const e = err as { code?: string };
    return {
      kind: "permanent_error",
      error: err,
      code: e?.code || "POLICY_OR_VALIDATION",
    };
  }
  return { kind: "retryable_error", error: err };
}

async function executeOutboxItem(
  item: OutboxItem,
  context: { userId: string; storeId: string; role: string }
): Promise<StepOutcome> {
  const isAdmin = isAdminRole(context.role);
  const storeId = item.storeId || context.storeId;
  const userId =
    item.userId && item.userId !== "__legacy__" ? item.userId : context.userId;

  const payloadAny = item.payload as Record<string, unknown>;
  const forceOverwrite = Boolean(payloadAny?.__forceOverwrite);
  const t0 = Date.now();

  try {
    switch (item.opType) {
      case "OPEN_CASH_SESSION": {
        const cs = item.payload as CashSession;
        const { data: existingCs, error: checkErr } = await withNetworkTimeout(
          supabase
            .from("cash_sessions")
            .select("id, status, closed_at, closing_amount")
            .eq("id", cs.id)
            .maybeSingle(),
          5000
        );
        if (checkErr) return classifyThrownOrReturnedError(checkErr);

        // Si la session est déjà fermée côté serveur (ex: clôture déjà poussée), ne jamais la réouvrir !
        if (existingCs?.status === "closed") {
          reportNetworkSuccess(Date.now() - t0);
          return { kind: "success" };
        }

        const effectiveUserId = cs.userId || userId;
        await withNetworkTimeout(
          supabase
            .from("cash_sessions")
            .update({ status: "closed", closed_at: cs.openedAt })
            .eq("store_id", storeId)
            .eq("user_id", effectiveUserId)
            .eq("status", "open")
            .neq("id", cs.id),
          4000
        ).catch(() => {});

        const { error } = await withNetworkTimeout(
          supabase.from("cash_sessions").upsert(
            [
              {
                id: cs.id,
                store_id: storeId,
                user_id: effectiveUserId,
                cashier_name: cs.cashierName || "Caissier",
                opening_amount: cs.openingAmount,
                closing_amount: cs.closingAmount ?? null,
                expected_amount: cs.expectedAmount ?? cs.openingAmount,
                difference: cs.difference ?? null,
                total_cash_sales: cs.totalCashSales || 0,
                total_mobile_money_sales: cs.totalMobileMoneySales || 0,
                total_card_sales: cs.totalCardSales || 0,
                total_sales_count: cs.totalSalesCount || 0,
                total_sales_amount: cs.totalSalesAmount || 0,
                status: "open",
                opened_at: cs.openedAt,
                closed_at: null,
                notes: cs.notes || null,
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "CLOSE_CASH_SESSION": {
        const cs = item.payload as CashSession;
        const { data: existingCs, error: checkErr } = await withNetworkTimeout(
          supabase
            .from("cash_sessions")
            .select("*")
            .eq("id", cs.id)
            .maybeSingle(),
          5000
        );
        if (checkErr) return classifyThrownOrReturnedError(checkErr);

        if (existingCs?.status === "closed" && !forceOverwrite) {
          const sameAmount =
            Math.abs(
              Number(existingCs.closing_amount ?? 0) -
                Number(cs.closingAmount ?? 0)
            ) <= 0.01;
          if (sameAmount) {
            reportNetworkSuccess(Date.now() - t0);
            return { kind: "success" };
          }
          reportNetworkSuccess(Date.now() - t0);
          return {
            kind: "conflict",
            conflictData: {
              code: "CONFLICT_SESSION_ALREADY_CLOSED",
              message:
                "Cette session de caisse a déjà été clôturée depuis un autre appareil avec un montant différent.",
              serverRecord: existingCs as Record<string, unknown>,
              localPayload: cs,
              detectedAt: new Date().toISOString(),
              resolutionOptions: ["keep_server", "force_local", "dismiss"],
            },
          };
        }

        const effectiveUserId = cs.userId || userId;
        const { error } = await withNetworkTimeout(
          supabase.from("cash_sessions").upsert(
            [
              {
                id: cs.id,
                store_id: storeId,
                user_id: effectiveUserId,
                cashier_name: cs.cashierName || "Caissier",
                opening_amount: cs.openingAmount,
                closing_amount: cs.closingAmount ?? 0,
                expected_amount: cs.expectedAmount ?? cs.openingAmount,
                difference: cs.difference ?? 0,
                total_cash_sales: cs.totalCashSales || 0,
                total_mobile_money_sales: cs.totalMobileMoneySales || 0,
                total_card_sales: cs.totalCardSales || 0,
                total_sales_count: cs.totalSalesCount || 0,
                total_sales_amount: cs.totalSalesAmount || 0,
                status: "closed",
                opened_at: cs.openedAt,
                closed_at: cs.closedAt || new Date().toISOString(),
                notes: cs.notes || null,
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "COMPLETE_SALE": {
        const s = item.payload as Sale & { sessionId?: string | null };
        const { error: saleError } = await withNetworkTimeout(
          supabase.rpc("create_sale", {
            p_store_id: storeId,
            p_sale_id: s.id,
            p_subtotal: s.subtotal,
            p_tax: s.tax,
            p_discount: s.discount,
            p_total: s.total,
            p_payment_method: s.paymentMethod,
            p_customer_name: s.customerName || null,
            p_created_at: s.createdAt,
            p_items: s.items,
            p_customer_phone: s.customerPhone || null,
            p_amount_paid:
              s.amountPaid ?? (s.paymentMethod === "credit" ? 0 : s.total),
            p_remaining_amount:
              s.remainingAmount ?? (s.paymentMethod === "credit" ? s.total : 0),
            p_payment_status:
              s.paymentStatus ||
              (s.paymentMethod === "credit" ? "unpaid" : "paid"),
            p_due_date: s.dueDate || null,
            p_session_id: s.sessionId || null,
          }),
          8500
        );

        if (!saleError || isDuplicateKeyError(saleError)) {
          reportNetworkSuccess(Date.now() - t0);
          return { kind: "success" };
        }
        return classifyThrownOrReturnedError(saleError);
      }

      case "CONVERT_QUOTE_TO_SALE": {
        const payload = item.payload as {
          quoteId: string;
          sale: Sale & { sessionId?: string | null };
        };
        const { error: convErr } = await withNetworkTimeout(
          supabase.rpc("convert_quote_to_sale", {
            p_quote_id: payload.quoteId,
            p_sale_id: payload.sale.id,
            p_payment_method: payload.sale.paymentMethod || "cash",
            p_amount_paid: payload.sale.amountPaid ?? payload.sale.total,
            p_session_id: payload.sale.sessionId || null,
          }),
          8500
        );
        if (!convErr || isDuplicateKeyError(convErr)) {
          reportNetworkSuccess(Date.now() - t0);
          return { kind: "success" };
        }
        const classified = classifyThrownOrReturnedError(convErr);
        if (classified.kind === "conflict") {
          const { data: srvQuote } = await withNetworkTimeout(
            supabase
              .from("quotes")
              .select("*")
              .eq("id", payload.quoteId)
              .maybeSingle(),
            4000
          ).catch(() => ({ data: null }));
          classified.conflictData.serverRecord = srvQuote as Record<
            string,
            unknown
          > | null;
          classified.conflictData.localPayload = payload;
          classified.conflictData.resolutionOptions = [
            "keep_server",
            "dismiss",
          ];
        }
        return classified;
      }

      case "RECORD_DEBT_PAYMENT": {
        const dp = item.payload as {
          id: string;
          saleId: string;
          paymentAmount: number;
          method: "cash" | "mobile_money" | "card";
          note?: string;
          cashierName?: string;
          createdAt?: string;
          sessionId?: string | null;
        };
        const { error: rpcErr } = await withNetworkTimeout(
          supabase.rpc("record_debt_payment", {
            p_store_id: storeId,
            p_sale_id: dp.saleId,
            p_payment_amount: dp.paymentAmount,
            p_payment_method: dp.method || "cash",
            p_note: dp.note || null,
            p_cashier_name: dp.cashierName || "Caissier",
            p_payment_id: dp.id || item.entityId,
            p_session_id: dp.sessionId || null,
            p_paid_at: dp.createdAt || item.createdAt,
          }),
          7000
        );

        if (!rpcErr) {
          reportNetworkSuccess(Date.now() - t0);
          return { kind: "success" };
        }
        const classified = classifyThrownOrReturnedError(rpcErr);
        if (classified.kind === "conflict") {
          const { data: srvSale } = await withNetworkTimeout(
            supabase
              .from("sales")
              .select("*")
              .eq("id", dp.saleId)
              .maybeSingle(),
            4000
          ).catch(() => ({ data: null }));
          classified.conflictData.serverRecord = srvSale as Record<
            string,
            unknown
          > | null;
          classified.conflictData.localPayload = dp;
          classified.conflictData.resolutionOptions = [
            "keep_server",
            "dismiss",
          ];
        }
        return classified;
      }

      case "ADD_CUSTOMER": {
        const c = item.payload as Customer;
        const { error } = await withNetworkTimeout(
          supabase.from("customers").upsert(
            [
              {
                id: c.id,
                store_id: storeId,
                name: c.name,
                phone: c.phone || "",
                email: c.email || null,
                total_purchases: Number(c.totalPurchases) || 0,
                last_visit: c.lastVisit || new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_PRODUCT":
      case "UPDATE_PRODUCT": {
        const p = item.payload as Product;
        const { data: rpcRes, error } = await withNetworkTimeout(
          supabase.rpc("upsert_product_atomic", {
            p_store_id: storeId,
            p_product_id: p.id,
            p_name: p.name,
            p_sku: p.sku || "",
            p_category: p.category || "Général",
            p_price: Number(p.price) || 0,
            p_stock: Number(p.stock) || 0,
            p_min_stock: Number(p.minStock) || 0,
            p_image: p.image || "📦",
            p_cost: isAdmin && p.cost !== undefined && p.cost !== null ? Number(p.cost) : null,
            p_units: isAdmin && Array.isArray(p.units) ? p.units : null,
            p_expected_updated_at: forceOverwrite
              ? null
              : item.expectedUpdatedAt || null,
            p_force_overwrite: forceOverwrite,
          }),
          7500
        );

        if (error) return classifyThrownOrReturnedError(error);
        const resObj = rpcRes as {
          conflict?: boolean;
          reason?: string;
          server_record?: Record<string, unknown>;
        } | null;
        if (resObj?.conflict) {
          reportNetworkSuccess(Date.now() - t0);
          return {
            kind: "conflict",
            conflictData: {
              code: resObj.reason || "VERSION_MISMATCH",
              message: `Le produit « ${p.name} » a été modifié sur un autre appareil entre-temps.`,
              serverRecord: resObj.server_record || null,
              localPayload: p,
              detectedAt: new Date().toISOString(),
              resolutionOptions: ["keep_server", "force_local", "dismiss"],
            },
          };
        }
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "BATCH_ADD_PRODUCTS": {
        const products = (item.payload as Product[]) || [];
        for (const p of products) {
          const { error } = await withNetworkTimeout(
            supabase.rpc("upsert_product_atomic", {
              p_store_id: storeId,
              p_product_id: p.id,
              p_name: p.name,
              p_sku: p.sku || "",
              p_category: p.category || "Général",
              p_price: Number(p.price) || 0,
              p_stock: Number(p.stock) || 0,
              p_min_stock: Number(p.minStock) || 0,
              p_image: p.image || "📦",
              p_cost:
                isAdmin && p.cost !== undefined && p.cost !== null
                  ? Number(p.cost)
                  : null,
              p_units: isAdmin && Array.isArray(p.units) ? p.units : null,
              p_expected_updated_at: null,
              p_force_overwrite: true,
            }),
            8000
          );
          if (error) return classifyThrownOrReturnedError(error);
        }
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "DELETE_PRODUCT": {
        const productId = item.entityId;
        const { error } = await withNetworkTimeout(
          supabase
            .from("products")
            .delete()
            .eq("id", productId)
            .eq("store_id", storeId),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_BATCH": {
        const b = item.payload as ProductBatch;
        const { error } = await withNetworkTimeout(
          supabase.from("product_batches").upsert(
            [
              {
                id: b.id,
                store_id: storeId,
                product_id: b.productId,
                batch_number: b.batchNumber,
                expiry_date: b.expiryDate,
                initial_quantity: b.initialQuantity,
                current_quantity: b.currentQuantity,
                order_id: b.orderId || null,
                created_at: b.createdAt || new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "DELETE_BATCH": {
        const { error } = await withNetworkTimeout(
          supabase
            .from("product_batches")
            .delete()
            .eq("id", item.entityId)
            .eq("store_id", storeId),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_CATEGORY": {
        const cat = item.payload as Category;
        const { error } = await withNetworkTimeout(
          supabase.from("categories").upsert(
            [
              {
                id: cat.id,
                store_id: storeId,
                name: cat.name,
                icon: cat.icon || "📦",
                color: cat.color || "#6343EA",
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "DELETE_CATEGORY": {
        const { error } = await withNetworkTimeout(
          supabase
            .from("categories")
            .delete()
            .eq("id", item.entityId)
            .eq("store_id", storeId),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_EXPENSE":
      case "UPDATE_EXPENSE": {
        const exp = item.payload as Expense;
        if (
          item.opType === "UPDATE_EXPENSE" &&
          item.expectedUpdatedAt &&
          !forceOverwrite
        ) {
          const { data: srvExp } = await withNetworkTimeout(
            supabase
              .from("expenses")
              .select("*")
              .eq("id", exp.id)
              .eq("store_id", storeId)
              .maybeSingle(),
            4500
          );
          if (
            srvExp?.updated_at &&
            Date.parse(srvExp.updated_at) >
              Date.parse(item.expectedUpdatedAt) + 10
          ) {
            reportNetworkSuccess(Date.now() - t0);
            return {
              kind: "conflict",
              conflictData: {
                code: "VERSION_MISMATCH",
                message: `La dépense « ${exp.description} » a été modifiée sur un autre appareil.`,
                serverRecord: srvExp as Record<string, unknown>,
                localPayload: exp,
                detectedAt: new Date().toISOString(),
                resolutionOptions: ["keep_server", "force_local", "dismiss"],
              },
            };
          }
        }

        const { error } = await withNetworkTimeout(
          supabase.from("expenses").upsert(
            [
              {
                id: exp.id,
                store_id: storeId,
                date: exp.date,
                category: exp.category,
                description: exp.description,
                amount: Number(exp.amount) || 0,
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "DELETE_EXPENSE": {
        const { error } = await withNetworkTimeout(
          supabase
            .from("expenses")
            .delete()
            .eq("id", item.entityId)
            .eq("store_id", storeId),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_ORDER": {
        const o = item.payload as Order;
        const { error: orderErr } = await withNetworkTimeout(
          supabase.from("orders").upsert(
            [
              {
                id: o.id,
                store_id: storeId,
                supplier_name: o.supplierName,
                total_cost: Number(o.totalCost) || 0,
                status: o.status || "pending",
                created_at: o.createdAt || new Date().toISOString(),
                expected_at: o.expectedAt || null,
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (orderErr) return classifyThrownOrReturnedError(orderErr);

        if (o.items && o.items.length > 0) {
          const orderItems = o.items.map((it, idx) => ({
            id: `oi_${o.id}_${idx}`,
            order_id: o.id,
            store_id: storeId,
            user_id: userId,
            product_id: it.productId,
            product_name: it.productName,
            quantity: Number(it.quantity) || 1,
            cost_price: Number(it.costPrice) || 0,
            reference_unit_cost:
              (Number(it.unitMultiplier) || 1) > 0
                ? Number(
                    (
                      Number(it.costPrice) / (Number(it.unitMultiplier) || 1)
                    ).toFixed(4)
                  )
                : Number(it.costPrice) || 0,
            total: Number(it.total) || 0,
            unit_name: it.unitName || "Unité",
            unit_multiplier: Number(it.unitMultiplier) || 1,
            quantity_reference:
              it.quantityReference !== undefined &&
              it.quantityReference !== null &&
              Number(it.quantityReference) > 0
                ? Number(it.quantityReference)
                : Number(it.quantity) * (Number(it.unitMultiplier) || 1),
            batch_number: it.batchNumber || null,
            expiry_date: it.expiryDate || null,
          }));
          const { error: oiErr } = await withNetworkTimeout(
            supabase
              .from("order_items")
              .upsert(orderItems, { onConflict: "id" }),
            6000
          );
          if (oiErr) return classifyThrownOrReturnedError(oiErr);
        }

        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "UPDATE_ORDER_STATUS": {
        const { orderId } = item.payload as { orderId: string };
        const { error } = await withNetworkTimeout(
          supabase.rpc("receive_order_atomic", {
            p_store_id: storeId,
            p_order_id: orderId,
          }),
          7500
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "DELETE_ORDER": {
        const { error } = await withNetworkTimeout(
          supabase
            .from("orders")
            .delete()
            .eq("id", item.entityId)
            .eq("store_id", storeId),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_INVENTORY_SESSION": {
        const inv = item.payload as InventorySession;
        const { error } = await withNetworkTimeout(
          supabase.rpc("apply_inventory_session_atomic", {
            p_store_id: storeId,
            p_session_id: inv.id,
            p_date: inv.date || new Date().toISOString(),
            p_total_variance_value: Number(inv.totalVarianceValue) || 0,
            p_notes: inv.notes || null,
            p_items: inv.items || [],
            p_mode: "delta",
          }),
          8000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_QUOTE":
      case "UPDATE_QUOTE": {
        const q = item.payload as Quote;
        const { data: rpcRes, error } = await withNetworkTimeout(
          supabase.rpc("upsert_quote_atomic", {
            p_store_id: storeId,
            p_quote_id: q.id,
            p_quote_number: q.quoteNumber,
            p_customer_name: q.customerName,
            p_customer_phone: q.customerPhone || null,
            p_customer_address: q.customerAddress || null,
            p_subtotal: Number(q.subtotal) || 0,
            p_tax: Number(q.tax) || 0,
            p_discount: Number(q.discount) || 0,
            p_total: Number(q.total) || 0,
            p_status: q.status || "draft",
            p_validity_date: q.validityDate || null,
            p_notes: q.notes || null,
            p_items: q.items || [],
            p_expected_updated_at: forceOverwrite
              ? null
              : item.expectedUpdatedAt || null,
            p_force_overwrite: forceOverwrite,
          }),
          7500
        );
        if (error) return classifyThrownOrReturnedError(error);
        const resObj = rpcRes as {
          conflict?: boolean;
          reason?: string;
          server_record?: Record<string, unknown>;
        } | null;
        if (resObj?.conflict) {
          reportNetworkSuccess(Date.now() - t0);
          return {
            kind: "conflict",
            conflictData: {
              code: resObj.reason || "VERSION_MISMATCH",
              message: `Le devis ${q.quoteNumber} a été modifié ou converti sur un autre appareil.`,
              serverRecord: resObj.server_record || null,
              localPayload: q,
              detectedAt: new Date().toISOString(),
              resolutionOptions:
                resObj.reason === "QUOTE_ALREADY_CONVERTED"
                  ? ["keep_server", "dismiss"]
                  : ["keep_server", "force_local", "dismiss"],
            },
          };
        }
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "DELETE_QUOTE": {
        const { error } = await withNetworkTimeout(
          supabase
            .from("quotes")
            .delete()
            .eq("id", item.entityId)
            .eq("store_id", storeId),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "ADD_PRICE_HISTORY_ENTRY": {
        const h = item.payload as PriceHistoryEntry;
        const { error } = await withNetworkTimeout(
          supabase.from("product_price_history").upsert(
            [
              {
                id: h.id,
                store_id: storeId,
                product_id: h.productId,
                price_type: h.priceType,
                unit_name: h.unitName || null,
                old_price: Number(h.oldPrice) || 0,
                new_price: Number(h.newPrice) || 0,
                change_reason: h.changeReason || null,
                user_id: h.userId || userId,
                user_name: h.userName || "Admin",
                created_at: h.createdAt || new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          ),
          6000
        );
        if (error) return classifyThrownOrReturnedError(error);
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      case "UPDATE_SETTINGS": {
        const s = item.payload as Partial<StoreSettings>;
        const { data: rpcRes, error } = await withNetworkTimeout(
          supabase.rpc("upsert_store_settings_atomic", {
            p_store_id: storeId,
            p_settings: s,
            p_expected_updated_at: forceOverwrite
              ? null
              : item.expectedUpdatedAt || null,
            p_force_overwrite: forceOverwrite,
          }),
          7000
        );
        if (error) return classifyThrownOrReturnedError(error);
        const resObj = rpcRes as {
          conflict?: boolean;
          reason?: string;
          server_record?: Record<string, unknown>;
        } | null;
        if (resObj?.conflict) {
          reportNetworkSuccess(Date.now() - t0);
          return {
            kind: "conflict",
            conflictData: {
              code: resObj.reason || "VERSION_MISMATCH",
              message:
                "Les paramètres de la boutique ont été modifiés sur un autre appareil.",
              serverRecord: resObj.server_record || null,
              localPayload: s,
              detectedAt: new Date().toISOString(),
              resolutionOptions: ["keep_server", "force_local", "dismiss"],
            },
          };
        }
        reportNetworkSuccess(Date.now() - t0);
        return { kind: "success" };
      }

      default:
        return {
          kind: "permanent_error",
          error: new Error(`Opération inconnue: ${item.opType}`),
          code: "UNKNOWN_OP",
        };
    }
  } catch (thrown) {
    return classifyThrownOrReturnedError(thrown);
  }
}

// ─── Vérification des dépendances causales dans la file ──────────────────────

function hasUnresolvedPrerequisite(
  item: OutboxItem,
  blockerIds: Set<string>,
  pendingByEntity: Map<string, OutboxItem[]>
): boolean {
  // Si un remboursement de dette référence une vente encore non synchronisée ou bloquée
  if (item.opType === "RECORD_DEBT_PAYMENT") {
    const dp = item.payload as { saleId?: string };
    if (dp?.saleId) {
      const blockers = pendingByEntity.get(`sale:${dp.saleId}`) || [];
      if (blockers.some((b) => b.id !== item.id && blockerIds.has(b.id))) {
        return true;
      }
    }
  }
  // Si une réception / suppression référence une commande encore bloquée
  if (
    item.opType === "UPDATE_ORDER_STATUS" ||
    item.opType === "DELETE_ORDER"
  ) {
    const blockers = pendingByEntity.get(`order:${item.entityId}`) || [];
    if (
      blockers.some(
        (b) => b.id !== item.id && b.opType === "ADD_ORDER" && blockerIds.has(b.id)
      )
    ) {
      return true;
    }
  }
  // Si une conversion de devis dépend d'un ADD_QUOTE bloqué
  if (item.opType === "CONVERT_QUOTE_TO_SALE") {
    const p = item.payload as { quoteId?: string };
    if (p?.quoteId) {
      const blockers = pendingByEntity.get(`quote:${p.quoteId}`) || [];
      if (
        blockers.some(
          (b) => b.id !== item.id && b.opType === "ADD_QUOTE" && blockerIds.has(b.id)
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

// ─── Orchestrateur de Synchronisation Montante (Outbox) ─────────────────────

export async function processOutboxForScope(params: {
  userId: string;
  storeId: string;
  role: string;
  forceAll?: boolean;
}): Promise<SyncRunResult> {
  const scopeKey = makeScopeKey(params.userId, params.storeId);

  const existingInflight = inflightScopeSync.get(scopeKey);
  if (existingInflight && !params.forceAll) {
    return existingInflight;
  }

  const runPromise = runWithMultiTabLock<SyncRunResult>(
    params.storeId,
    async (): Promise<SyncRunResult> => {
      const summary: SyncRunResult = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        conflicts: 0,
        authPaused: false,
        networkOffline: false,
        skippedLocked: false,
        syncedEntityTypes: [],
      };

      const syncedEntitiesSet = new Set<string>();

      // 1. Reprendre proprement d'éventuelles opérations interrompues (`syncing`)
      await recoverStaleSyncingItems(params.userId, params.storeId);

      // 2. Récupérer les opérations à traiter par ordre causal strict
      const candidates = await getOutboxItems({
        scopeKey,
        storeId: params.storeId,
        statuses: params.forceAll
          ? ["pending", "auth_paused"]
          : ["pending"],
        includeLegacyUserForStore: true,
      });

      const ordered = sortOutboxItemsDeterministically(candidates);
      if (ordered.length === 0) return summary;

      broadcastOfflineEvent({
        type: "SYNC_STATUS_CHANGED",
        storeId: params.storeId,
        status: "syncing",
        at: new Date().toISOString(),
      });

      const nowMs = Date.now();
      const blockerIds = new Set<string>();
      const pendingByEntity = new Map<string, OutboxItem[]>();
      for (const it of ordered) {
        const key = `${it.entityType}:${it.entityId}`;
        const arr = pendingByEntity.get(key) || [];
        arr.push(it);
        pendingByEntity.set(key, arr);
        blockerIds.add(it.id);
      }

      for (const item of ordered) {
        // Respecter le backoff sauf si l'utilisateur force une synchro manuelle
        const nextRetryTime = Date.parse(item.nextRetryAt || "") || 0;
        if (!params.forceAll && nextRetryTime > nowMs) {
          continue;
        }

        if (hasUnresolvedPrerequisite(item, blockerIds, pendingByEntity)) {
          continue;
        }

        summary.processed += 1;
        await updateOutboxItem(item.id, {
          status: "syncing",
          lastAttemptAt: new Date().toISOString(),
        });

        const outcome = await executeOutboxItem(item, params);

        if (outcome.kind === "success") {
          blockerIds.delete(item.id);
          await removeOutboxItem(item.id);
          // Nettoyer également les éventuels miroirs legacy LS si présents
          cleanupLegacyMirrorsOnItemSynced(item);
          summary.succeeded += 1;
          syncedEntitiesSet.add(item.entityType);

          await appendSyncLog({
            userId: params.userId,
            storeId: params.storeId,
            level: "info",
            opType: item.opType,
            entityId: item.entityId,
            message: `Synchronisation réussie : ${item.opType}`,
          });
          continue;
        }

        if (outcome.kind === "auth_error") {
          await updateOutboxItem(item.id, {
            status: "auth_paused",
            lastError: "Session expirée — reconnexion requise",
            errorCode: "AUTH_EXPIRED",
          });
          await markOutboxAuthPaused(params.userId, params.storeId, true);
          summary.authPaused = true;

          await appendSyncLog({
            userId: params.userId,
            storeId: params.storeId,
            level: "warn",
            opType: item.opType,
            entityId: item.entityId,
            message:
              "Synchronisation mise en pause : jeton de session expiré.",
          });
          break; // Stopper immédiatement sans perdre les autres opérations
        }

        if (outcome.kind === "network_error") {
          const nextRetries = (item.retryCount || 0) + 1;
          const delay = computeExponentialBackoffMs(nextRetries);
          await updateOutboxItem(item.id, {
            status: "pending",
            retryCount: nextRetries,
            nextRetryAt: new Date(Date.now() + delay).toISOString(),
            lastError: "Connexion interrompue — nouvelle tentative planifiée",
            errorCode: "NETWORK_ERROR",
          });
          summary.networkOffline = true;
          summary.failed += 1;

          await appendSyncLog({
            userId: params.userId,
            storeId: params.storeId,
            level: "warn",
            opType: item.opType,
            entityId: item.entityId,
            message: `Coupure réseau sur ${item.opType} (nouvelle tentative dans ${Math.round(delay / 1000)}s)`,
          });
          break; // Serveur inaccessible : inutile de boucler sur toute la file
        }

        if (outcome.kind === "conflict") {
          await updateOutboxItem(item.id, {
            status: "conflict",
            conflictData: outcome.conflictData,
            lastError: outcome.conflictData.message,
            errorCode: outcome.conflictData.code,
          });
          summary.conflicts += 1;

          broadcastOfflineEvent({
            type: "CONFLICT_DETECTED",
            storeId: params.storeId,
            itemId: item.id,
            at: new Date().toISOString(),
          });

          await appendSyncLog({
            userId: params.userId,
            storeId: params.storeId,
            level: "conflict",
            opType: item.opType,
            entityId: item.entityId,
            message: outcome.conflictData.message,
            details: { code: outcome.conflictData.code },
          });
          continue;
        }

        if (outcome.kind === "permanent_error") {
          const msg =
            extractErrMsg(outcome.error) ||
            "Opération refusée par les règles serveur";
          await updateOutboxItem(item.id, {
            status: "failed",
            retryCount: (item.retryCount || 0) + 1,
            lastError: msg,
            errorCode: outcome.code || "PERMANENT_ERROR",
          });
          summary.failed += 1;

          await appendSyncLog({
            userId: params.userId,
            storeId: params.storeId,
            level: "error",
            opType: item.opType,
            entityId: item.entityId,
            message: `Échec définitif (${item.opType}) : ${msg}`,
          });
          continue;
        }

        // retryable_error (erreur SQL transitoire ou inconnue)
        const nextRetries = (item.retryCount || 0) + 1;
        const msg = extractErrMsg(outcome.error) || "Erreur serveur";
        if (nextRetries >= MAX_DETERMINISTIC_RETRIES) {
          await updateOutboxItem(item.id, {
            status: "failed",
            retryCount: nextRetries,
            lastError: msg,
            errorCode: "MAX_RETRIES_EXCEEDED",
          });
          await appendSyncLog({
            userId: params.userId,
            storeId: params.storeId,
            level: "error",
            opType: item.opType,
            entityId: item.entityId,
            message: `Échec après ${nextRetries} tentatives (${item.opType}) : ${msg}`,
          });
        } else {
          const delay = computeExponentialBackoffMs(nextRetries);
          await updateOutboxItem(item.id, {
            status: "pending",
            retryCount: nextRetries,
            nextRetryAt: new Date(Date.now() + delay).toISOString(),
            lastError: msg,
            errorCode: "TRANSIENT_ERROR",
          });
        }
        summary.failed += 1;
      }

      summary.syncedEntityTypes = Array.from(syncedEntitiesSet);

      broadcastOfflineEvent({
        type: "SYNC_STATUS_CHANGED",
        storeId: params.storeId,
        status: "idle",
        at: new Date().toISOString(),
      });

      return summary;
    },
    (): SyncRunResult => ({
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      authPaused: false,
      networkOffline: false,
      skippedLocked: true,
      syncedEntityTypes: [],
    })
  );

  inflightScopeSync.set(scopeKey, runPromise);
  try {
    return await runPromise;
  } finally {
    inflightScopeSync.delete(scopeKey);
  }
}

function cleanupLegacyMirrorsOnItemSynced(item: OutboxItem): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (item.opType === "COMPLETE_SALE") {
      const raw = window.localStorage.getItem("boutiquepro_offline_sales");
      if (raw) {
        const arr = JSON.parse(raw) as Array<{ id: string }>;
        window.localStorage.setItem(
          "boutiquepro_offline_sales",
          JSON.stringify(arr.filter((x) => x.id !== item.entityId))
        );
      }
    } else if (item.opType === "RECORD_DEBT_PAYMENT") {
      const raw = window.localStorage.getItem(
        "boutiquepro_pending_debt_payments"
      );
      if (raw) {
        const arr = JSON.parse(raw) as Array<{ id: string }>;
        window.localStorage.setItem(
          "boutiquepro_pending_debt_payments",
          JSON.stringify(arr.filter((x) => x.id !== item.entityId))
        );
      }
    } else if (
      item.opType === "OPEN_CASH_SESSION" ||
      item.opType === "CLOSE_CASH_SESSION"
    ) {
      const raw = window.localStorage.getItem(
        "boutiquepro_pending_cash_sessions"
      );
      if (raw) {
        const arr = JSON.parse(raw) as Array<{ id: string }>;
        window.localStorage.setItem(
          "boutiquepro_pending_cash_sessions",
          JSON.stringify(arr.filter((x) => x.id !== item.entityId))
        );
      }
    }
  } catch {}
}

// ─── Résolution Manuelle de Conflit ─────────────────────────────────────────

export async function resolveOutboxConflict(params: {
  itemId: string;
  decision: "keep_server" | "force_local" | "dismiss";
  userId: string;
  storeId: string;
  role: string;
}): Promise<{ success: boolean; error?: string }> {
  const item = await getOutboxItem(params.itemId);
  if (!item) return { success: false, error: "Opération introuvable." };

  if (params.decision === "keep_server" || params.decision === "dismiss") {
    await removeOutboxItem(item.id);
    await appendSyncLog({
      userId: params.userId,
      storeId: params.storeId,
      level: "info",
      opType: item.opType,
      entityId: item.entityId,
      message: `Conflit résolu en conservant la version serveur (${item.opType})`,
    });
    return { success: true };
  }

  // force_local : injecter le marqueur __forceOverwrite et relancer
  const nextPayload =
    typeof item.payload === "object" &&
    item.payload !== null &&
    !Array.isArray(item.payload)
      ? {
          ...(item.payload as Record<string, unknown>),
          __forceOverwrite: true,
        }
      : item.payload;

  await updateOutboxItem(item.id, {
    payload: nextPayload,
    status: "pending",
    retryCount: 0,
    nextRetryAt: new Date(0).toISOString(),
    conflictData: undefined,
    lastError: undefined,
    errorCode: undefined,
  });

  await appendSyncLog({
    userId: params.userId,
    storeId: params.storeId,
    level: "warn",
    opType: item.opType,
    entityId: item.entityId,
    message: `Résolution manuelle : écrasement forcé par version locale (${item.opType})`,
  });

  const runRes = await processOutboxForScope({
    userId: params.userId,
    storeId: params.storeId,
    role: params.role,
    forceAll: true,
  });

  if (runRes.conflicts > 0 || runRes.failed > 0) {
    return {
      success: false,
      error: "Impossible d'appliquer l'écrasement local pour le moment.",
    };
  }
  return { success: true };
}

// ─── Synchronisation Descendante Incrémentale + Bouclier Outbox ─────────────

function computeOverlapWatermark(isoCursor: string): string {
  const t = Date.parse(isoCursor);
  if (Number.isNaN(t)) return isoCursor;
  return new Date(Math.max(0, t - CURSOR_OVERLAP_MS)).toISOString();
}

function maxTimestampIso(
  currentMax: string | null,
  candidates: Array<string | null | undefined>
): string {
  let maxMs = currentMax ? Date.parse(currentMax) || 0 : 0;
  for (const c of candidates) {
    if (!c) continue;
    const ms = Date.parse(c);
    if (!Number.isNaN(ms) && ms > maxMs) {
      maxMs = ms;
    }
  }
  return new Date(maxMs || Date.now()).toISOString();
}

function mergeById<T extends { id: string }>(
  base: T[],
  delta: T[],
  validIdsSet?: Set<string> | null
): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    if (!item?.id) continue;
    if (validIdsSet && !validIdsSet.has(item.id)) continue;
    map.set(item.id, item);
  }
  for (const item of delta) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export async function pullStoreIncrementalDelta(params: {
  userId: string;
  storeId: string;
  storeName: string;
  role: string;
  currentState: StoreState;
  currentExtra?: StoreSnapshotExtra;
  forceFull?: boolean;
}): Promise<PullStateResult> {
  const { userId, storeId, storeName, role, currentState, forceFull } = params;
  const isAdmin = isAdminRole(role);
  const scopeKey = makeScopeKey(userId, storeId);

  const cursors = forceFull
    ? []
    : await getAllSyncCursorsForScope(userId, storeId);
  const cursorMap = new Map<string, string>();
  for (const c of cursors) {
    cursorMap.set(c.entityTable, c.lastSyncedAt);
  }

  const hasPreviousData =
    !forceFull &&
    cursorMap.size > 0 &&
    (currentState.products.length > 0 || currentState.sales.length > 0);

  // Construire les curseurs incrémentaux avec marge de 5s anti-chevauchement
  const wm = (table: string) => {
    if (!hasPreviousData) return null;
    const raw = cursorMap.get(table);
    return raw ? computeOverlapWatermark(raw) : null;
  };

  const t0 = Date.now();

  const buildFilteredQuery = <TQuery extends { gte: (col: string, val: string) => TQuery }>(
    baseQuery: TQuery,
    watermark: string | null
  ): TQuery => (watermark ? baseQuery.gte("updated_at", watermark) : baseQuery);

  // Exécuter les requêtes réseau avec timeout global 12s
  const [
    settingsRes,
    categoriesRes,
    productsRes,
    salesRes,
    saleDebtPaymentsRes,
    customersRes,
    ordersRes,
    inventoryRes,
    expensesRes,
    cashSessionsRes,
    productCostsRes,
    saleItemCostsRes,
    productUnitsRes,
    productBatchesRes,
    priceHistoryRes,
    quotesRes,
    // Listes légères d'IDs existants lors des pulls delta pour répercuter les suppressions distantes
    productIdsRes,
    expenseIdsRes,
    quoteIdsRes,
    batchIdsRes,
    categoryIdsRes,
  ] = await withNetworkTimeout(
    Promise.all([
      supabase.from("settings").select("*").eq("store_id", storeId).maybeSingle(),
      supabase.from("categories").select("*").eq("store_id", storeId),
      buildFilteredQuery(
        supabase
          .from("products")
          .select(
            "id, name, sku, category, price, stock, min_stock, image, created_at, updated_at, user_id, store_id"
          )
          .eq("store_id", storeId),
        wm("products")
      ),
      buildFilteredQuery(
        supabase
          .from("sales")
          .select("*, items:sale_items(*)")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        wm("sales")
      ),
      buildFilteredQuery(
        supabase
          .from("sale_debt_payments")
          .select("*")
          .eq("store_id", storeId)
          .order("paid_at", { ascending: false }),
        wm("sale_debt_payments")
      ),
      buildFilteredQuery(
        supabase.from("customers").select("*").eq("store_id", storeId),
        wm("customers")
      ),
      isAdmin
        ? buildFilteredQuery(
            supabase
              .from("orders")
              .select("*, items:order_items(*)")
              .eq("store_id", storeId),
            wm("orders")
          )
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      isAdmin
        ? buildFilteredQuery(
            supabase
              .from("inventory_sessions")
              .select("*, items:inventory_items(*)")
              .eq("store_id", storeId),
            wm("inventory_sessions")
          )
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      isAdmin
        ? buildFilteredQuery(
            supabase
              .from("expenses")
              .select("*")
              .eq("store_id", storeId)
              .order("date", { ascending: false }),
            wm("expenses")
          )
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      buildFilteredQuery(
        supabase
          .from("cash_sessions")
          .select("*")
          .eq("store_id", storeId)
          .order("opened_at", { ascending: false }),
        wm("cash_sessions")
      ),
      isAdmin
        ? supabase
            .from("product_costs")
            .select("product_id, cost, updated_at")
            .eq("store_id", storeId)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      isAdmin
        ? buildFilteredQuery(
            supabase
              .from("sale_item_costs")
              .select("sale_item_id, sale_id, unit_cost, is_estimated, created_at")
              .eq("store_id", storeId),
            wm("sales")
          )
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      supabase.from("product_units").select("*").eq("store_id", storeId),
      buildFilteredQuery(
        supabase
          .from("product_batches")
          .select("*")
          .eq("store_id", storeId)
          .order("expiry_date", { ascending: true }),
        wm("product_batches")
      ),
      buildFilteredQuery(
        supabase
          .from("product_price_history")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        wm("product_price_history")
      ),
      buildFilteredQuery(
        supabase
          .from("quotes")
          .select("*, items:quote_items(*)")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        wm("quotes")
      ),
      wm("products")
        ? supabase.from("products").select("id").eq("store_id", storeId)
        : Promise.resolve({ data: null }),
      isAdmin && wm("expenses")
        ? supabase.from("expenses").select("id").eq("store_id", storeId)
        : Promise.resolve({ data: null }),
      wm("quotes")
        ? supabase.from("quotes").select("id").eq("store_id", storeId)
        : Promise.resolve({ data: null }),
      wm("product_batches")
        ? supabase.from("product_batches").select("id").eq("store_id", storeId)
        : Promise.resolve({ data: null }),
      supabase.from("categories").select("id").eq("store_id", storeId),
    ]),
    14000
  );

  // Vérifier si une erreur réseau ou auth est remontée par l'une des requêtes critiques
  const criticalErr =
    productsRes.error || salesRes.error || categoriesRes.error || settingsRes.error;
  if (criticalErr) {
    if (isCaptivePortalOrParseError(criticalErr) || isNetworkLikeError(criticalErr)) {
      reportNetworkFailure(criticalErr);
      throw criticalErr;
    }
    if (isAuthInvalidError(criticalErr)) {
      reportNetworkFailure(criticalErr);
      throw criticalErr;
    }
  }

  reportNetworkSuccess(Date.now() - t0);
  const serverSyncAt = new Date().toISOString();

  // Map des unités par produit
  const unitsByProduct = new Map<string, ProductUnit[]>();
  for (const u of (productUnitsRes.data || []) as Record<string, unknown>[]) {
    const pid = String(u.product_id || "");
    const list = unitsByProduct.get(pid) || [];
    list.push({
      id: String(u.id),
      storeId: String(u.store_id),
      productId: pid,
      name: String(u.name || ""),
      multiplier: Number(u.multiplier) || 1,
      price:
        u.price !== null && u.price !== undefined ? Number(u.price) : null,
      cost: isAdmin && u.cost !== null && u.cost !== undefined ? Number(u.cost) : null,
      barcode: (u.barcode as string | null) || null,
      isReference: Boolean(u.is_reference),
      createdAt: u.created_at as string | undefined,
    });
    unitsByProduct.set(pid, list);
  }

  const costsMap = new Map<string, number>();
  if (isAdmin) {
    for (const c of (productCostsRes.data || []) as Record<string, unknown>[]) {
      costsMap.set(String(c.product_id), Number(c.cost) || 0);
    }
  }

  const frozenCostsMap = new Map<
    string,
    { unit_cost: number; is_estimated: boolean }
  >();
  if (isAdmin) {
    for (const sc of (saleItemCostsRes.data || []) as Record<string, unknown>[]) {
      frozenCostsMap.set(String(sc.sale_item_id), {
        unit_cost: Number(sc.unit_cost) || 0,
        is_estimated: Boolean(sc.is_estimated),
      });
    }
  }

  // Regrouper sale_debt_payments par sale_id
  const serverPaymentsBySale = new Map<string, DebtPayment[]>();
  const sdpRows = (saleDebtPaymentsRes.data || []) as Record<string, unknown>[];
  for (const p of sdpRows) {
    const sid = String(p.sale_id || "");
    if (!sid) continue;
    const arr = serverPaymentsBySale.get(sid) || [];
    arr.push({
      id: String(p.id),
      saleId: sid,
      amount: Number(p.amount) || 0,
      paymentMethod:
        (p.payment_method as "cash" | "mobile_money" | "card") || "cash",
      paidAt: String(p.paid_at || p.created_at || new Date().toISOString()),
      cashierName: (p.cashier_name as string | undefined) || undefined,
      note: (p.note as string | undefined) || undefined,
    });
    serverPaymentsBySale.set(sid, arr);
  }

  // ── Mapping des lignes serveur ───────────────────────────────────────────

  const serverProducts: Product[] = (
    (productsRes.data || []) as Record<string, unknown>[]
  ).map((p) => {
    const pid = String(p.id);
    const pUnits = unitsByProduct.get(pid) || [];
    const refUnit = pUnits.find((u) => u.isReference);
    return {
      id: pid,
      name: String(p.name || ""),
      sku: String(p.sku || ""),
      category: String(p.category || ""),
      price: Number(p.price) || 0,
      cost: isAdmin ? (costsMap.get(pid) ?? 0) : 0,
      stock: Number(p.stock) || 0,
      minStock: Number(p.min_stock ?? 5),
      image: String(p.image || "📦"),
      createdAt: String(p.created_at || new Date().toISOString()),
      updatedAt: (p.updated_at as string | undefined) || undefined,
      userId: p.user_id as string | undefined,
      storeId: p.store_id as string | undefined,
      unit: refUnit ? refUnit.name : "Pièce / Unité",
      units: pUnits,
    };
  });

  // Fusion incrémentale ou complète des produits
  const validProductIds = productIdsRes.data
    ? new Set(
        (productIdsRes.data as Array<{ id: string }>).map((r) => String(r.id))
      )
    : null;
  let mergedProducts = hasPreviousData && wm("products")
    ? mergeById(currentState.products, serverProducts, validProductIds)
    : serverProducts;

  // Toujours rafraîchir les coûts & unités sur les produits non touchés par un delta produit
  if (hasPreviousData && wm("products")) {
    mergedProducts = mergedProducts.map((p) => ({
      ...p,
      cost: isAdmin ? (costsMap.get(p.id) ?? p.cost ?? 0) : 0,
      units: unitsByProduct.get(p.id) ?? p.units,
    }));
  }

  const serverSales: Sale[] = (
    (salesRes.data || []) as Record<string, unknown>[]
  ).map((s) => {
    const sid = String(s.id);
    const isCredit = s.payment_method === "credit";
    const total = Number.isFinite(Number(s.total)) ? Number(s.total) : 0;
    const rawPaid =
      s.amount_paid !== null &&
      s.amount_paid !== undefined &&
      Number.isFinite(Number(s.amount_paid))
        ? Number(s.amount_paid)
        : null;
    const amountPaid = rawPaid !== null ? rawPaid : isCredit ? 0 : total;
    const rawRem =
      s.remaining_amount !== null &&
      s.remaining_amount !== undefined &&
      Number.isFinite(Number(s.remaining_amount))
        ? Number(s.remaining_amount)
        : null;
    let remainingAmount =
      rawRem !== null ? rawRem : isCredit ? Math.max(0, total - amountPaid) : 0;
    if (isCredit && total > amountPaid && remainingAmount <= 0) {
      remainingAmount = Math.max(0, total - amountPaid);
    }
    const paymentStatus = isCredit
      ? remainingAmount === 0
        ? "paid"
        : amountPaid > 0
          ? "partial"
          : "unpaid"
      : (s.payment_status as "paid" | "partial" | "unpaid" | undefined) || "paid";

    const existingLocalSale = currentState.sales.find((ls) => ls.id === sid);
    const srvPayments = serverPaymentsBySale.get(sid) || [];
    const paymentMap = new Map<string, DebtPayment>();
    (existingLocalSale?.payments || []).forEach((p) => {
      if (p?.id) paymentMap.set(p.id, p);
    });
    srvPayments.forEach((p) => paymentMap.set(p.id, p));
    if (isCredit && amountPaid > 0 && paymentMap.size === 0) {
      paymentMap.set(`init-${sid}`, {
        id: `init-${sid}`,
        saleId: sid,
        amount: amountPaid,
        paymentMethod: "cash",
        paidAt: String(s.created_at || new Date().toISOString()),
        note: "Acompte initial à la caisse",
        cashierName: "Caissier",
      });
    }
    const mergedSalePayments = Array.from(paymentMap.values()).sort(
      (a, b) => (Date.parse(b.paidAt) || 0) - (Date.parse(a.paidAt) || 0)
    );

    const rawItems = Array.isArray(s.items)
      ? (s.items as Record<string, unknown>[])
      : [];

    return {
      id: sid,
      subtotal: Number(s.subtotal) || 0,
      tax: Number(s.tax) || 0,
      discount: Number(s.discount) || 0,
      total,
      paymentMethod:
        (s.payment_method as Sale["paymentMethod"]) || "cash",
      amountGiven: s.amount_given ? Number(s.amount_given) : undefined,
      change: s.change ? Number(s.change) : undefined,
      customerName: (s.customer_name as string | undefined) || undefined,
      customerPhone: (s.customer_phone as string | undefined) || undefined,
      amountPaid,
      remainingAmount,
      paymentStatus,
      dueDate: (s.due_date as string | undefined) || undefined,
      notes: (s.notes as string | undefined) || undefined,
      createdAt: String(s.created_at || new Date().toISOString()),
      userId: s.user_id as string | undefined,
      storeId: s.store_id as string | undefined,
      payments: mergedSalePayments,
      items: rawItems.map((i) => {
        const frozen = frozenCostsMap.get(String(i.id));
        const unitCost =
          frozen !== undefined
            ? Number(frozen.unit_cost)
            : (costsMap.get(String(i.product_id)) ?? 0);
        return {
          id: i.id as string | undefined,
          productId: String(i.product_id),
          productName: String(i.product_name || ""),
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unit_price) || 0,
          total: Number(i.total) || 0,
          unitName: (i.unit_name as string) || "Unité",
          unitMultiplier: Number(i.unit_multiplier) || 1,
          quantityReference:
            i.quantity_reference !== undefined &&
            i.quantity_reference !== null &&
            Number(i.quantity_reference) > 0
              ? Number(i.quantity_reference)
              : Number(i.quantity) * (Number(i.unit_multiplier) || 1),
          cost: isAdmin ? unitCost : undefined,
          isEstimated: isAdmin && frozen ? frozen.is_estimated : undefined,
          batchId: (i.batch_id as string | undefined) || undefined,
          batchNumber: (i.batch_number as string | undefined) || undefined,
          expiryDate: (i.expiry_date as string | undefined) || undefined,
        };
      }),
    };
  });

  // Fusionner également d'éventuels nouveaux paiements `sale_debt_payments` pour des ventes non modifiées dans ce delta
  let mergedSales =
    hasPreviousData && wm("sales")
      ? mergeById(currentState.sales, serverSales)
      : serverSales;

  if (serverPaymentsBySale.size > 0) {
    mergedSales = mergedSales.map((s) => {
      const extraPayments = serverPaymentsBySale.get(s.id);
      if (!extraPayments || extraPayments.length === 0) return s;
      const pMap = new Map<string, DebtPayment>();
      (s.payments || []).forEach((p) => pMap.set(p.id, p));
      extraPayments.forEach((p) => pMap.set(p.id, p));
      return {
        ...s,
        payments: Array.from(pMap.values()).sort(
          (a, b) => (Date.parse(b.paidAt) || 0) - (Date.parse(a.paidAt) || 0)
        ),
      };
    });
  }

  const serverCustomers: Customer[] = (
    (customersRes.data || []) as Record<string, unknown>[]
  ).map((c) => ({
    id: String(c.id),
    name: String(c.name || ""),
    phone: String(c.phone || ""),
    email: (c.email as string | undefined) || undefined,
    totalPurchases: Number(c.total_purchases) || 0,
    lastVisit: String(c.last_visit || new Date().toISOString()),
  }));
  const mergedCustomers =
    hasPreviousData && wm("customers")
      ? mergeById(currentState.customers, serverCustomers)
      : serverCustomers;

  const serverBatches: ProductBatch[] = (
    (productBatchesRes.data || []) as Record<string, unknown>[]
  ).map((b) => ({
    id: String(b.id),
    storeId: String(b.store_id),
    productId: String(b.product_id),
    batchNumber: String(b.batch_number || ""),
    expiryDate: String(b.expiry_date || ""),
    initialQuantity: Number(b.initial_quantity) || 0,
    currentQuantity: Number(b.current_quantity) || 0,
    orderId: (b.order_id as string | undefined) || undefined,
    createdAt: String(b.created_at || new Date().toISOString()),
    updatedAt: b.updated_at as string | undefined,
  }));
  const validBatchIds = batchIdsRes.data
    ? new Set(
        (batchIdsRes.data as Array<{ id: string }>).map((r) => String(r.id))
      )
    : null;
  let mergedBatches =
    hasPreviousData && wm("product_batches")
      ? mergeById(currentState.batches, serverBatches, validBatchIds)
      : serverBatches;

  const serverPriceHistory: PriceHistoryEntry[] = (
    (priceHistoryRes.data || []) as Record<string, unknown>[]
  )
    .filter((h) => isAdmin || h.price_type !== "cost")
    .map((h) => ({
      id: String(h.id),
      storeId: String(h.store_id),
      productId: String(h.product_id),
      priceType: h.price_type as PriceHistoryEntry["priceType"],
      unitName: (h.unit_name as string | null) || null,
      oldPrice: Number(h.old_price) || 0,
      newPrice: Number(h.new_price) || 0,
      changeReason: (h.change_reason as string | null) || null,
      userId: (h.user_id as string | null) || null,
      userName: (h.user_name as string | null) || null,
      createdAt: String(h.created_at || new Date().toISOString()),
    }));
  const mergedPriceHistory =
    hasPreviousData && wm("product_price_history")
      ? mergeById(currentState.priceHistory || [], serverPriceHistory)
      : serverPriceHistory;

  const serverQuotes: Quote[] = (
    (quotesRes.data || []) as Record<string, unknown>[]
  ).map((q) => ({
    id: String(q.id),
    storeId: String(q.store_id),
    userId: (q.user_id as string | null) || null,
    quoteNumber: String(q.quote_number || ""),
    customerName: String(q.customer_name || ""),
    customerPhone: (q.customer_phone as string | null) || null,
    customerAddress: (q.customer_address as string | null) || null,
    subtotal: Number(q.subtotal) || 0,
    tax: Number(q.tax) || 0,
    discount: Number(q.discount) || 0,
    total: Number(q.total) || 0,
    status: (q.status as Quote["status"]) || "draft",
    validityDate: (q.validity_date as string | null) || null,
    notes: (q.notes as string | null) || null,
    saleId: (q.sale_id as string | null) || null,
    createdAt: String(q.created_at || new Date().toISOString()),
    updatedAt: (q.updated_at as string | undefined) || undefined,
    items: Array.isArray(q.items)
      ? (q.items as Record<string, unknown>[]).map((qi) => ({
          id: String(qi.id),
          quoteId: String(qi.quote_id),
          productId: String(qi.product_id),
          productName: String(qi.product_name || ""),
          quantity: Number(qi.quantity) || 1,
          unitPrice: Number(qi.unit_price) || 0,
          total: Number(qi.total) || 0,
          unitName: (qi.unit_name as string) || "Unité",
          unitMultiplier: Number(qi.unit_multiplier) || 1,
        }))
      : [],
  }));
  const validQuoteIds = quoteIdsRes.data
    ? new Set(
        (quoteIdsRes.data as Array<{ id: string }>).map((r) => String(r.id))
      )
    : null;
  let mergedQuotes =
    hasPreviousData && wm("quotes")
      ? mergeById(currentState.quotes || [], serverQuotes, validQuoteIds)
      : serverQuotes;

  const serverCashSessions: CashSession[] = (
    (cashSessionsRes.data || []) as Record<string, unknown>[]
  ).map((cs) => ({
    id: String(cs.id),
    storeId: String(cs.store_id),
    userId: String(cs.user_id),
    cashierName: (cs.cashier_name as string | undefined) || undefined,
    openingAmount: Number(cs.opening_amount) || 0,
    closingAmount:
      cs.closing_amount !== null && cs.closing_amount !== undefined
        ? Number(cs.closing_amount)
        : undefined,
    expectedAmount:
      cs.expected_amount !== null && cs.expected_amount !== undefined
        ? Number(cs.expected_amount)
        : undefined,
    difference:
      cs.difference !== null && cs.difference !== undefined
        ? Number(cs.difference)
        : undefined,
    totalCashSales: Number(cs.total_cash_sales) || 0,
    totalMobileMoneySales: Number(cs.total_mobile_money_sales) || 0,
    totalCardSales: Number(cs.total_card_sales) || 0,
    totalSalesCount: Number(cs.total_sales_count) || 0,
    totalSalesAmount: Number(cs.total_sales_amount) || 0,
    openedAt: String(cs.opened_at || new Date().toISOString()),
    closedAt: (cs.closed_at as string | undefined) || undefined,
    status: (cs.status as "open" | "closed") || "open",
    notes: (cs.notes as string | undefined) || undefined,
  }));
  let mergedCashSessions =
    hasPreviousData && wm("cash_sessions")
      ? mergeById(currentState.cashSessions || [], serverCashSessions)
      : serverCashSessions;

  let mergedOrders: Order[] = [];
  let mergedInventory: InventorySession[] = [];
  let mergedExpenses: Expense[] = [];

  if (isAdmin) {
    const serverOrders: Order[] = (
      (ordersRes.data || []) as Record<string, unknown>[]
    ).map((o) => ({
      id: String(o.id),
      supplierName: String(o.supplier_name || ""),
      totalCost: Number(o.total_cost) || 0,
      status: (o.status as "pending" | "received") || "pending",
      createdAt: String(o.created_at || new Date().toISOString()),
      expectedAt: (o.expected_at as string | undefined) || undefined,
      items: Array.isArray(o.items)
        ? (o.items as Record<string, unknown>[]).map((i) => ({
            productId: String(i.product_id),
            productName: String(i.product_name || ""),
            costPrice: Number(i.cost_price) || 0,
            quantity: Number(i.quantity) || 1,
            total: Number(i.total) || 0,
            unitName: (i.unit_name as string) || "Unité",
            unitMultiplier: Number(i.unit_multiplier) || 1,
            quantityReference:
              i.quantity_reference !== undefined &&
              i.quantity_reference !== null &&
              Number(i.quantity_reference) > 0
                ? Number(i.quantity_reference)
                : Number(i.quantity) * (Number(i.unit_multiplier) || 1),
            batchNumber: (i.batch_number as string | undefined) || undefined,
            expiryDate: (i.expiry_date as string | undefined) || undefined,
          }))
        : [],
    }));
    mergedOrders =
      hasPreviousData && wm("orders")
        ? mergeById(currentState.orders || [], serverOrders)
        : serverOrders;

    const serverInv: InventorySession[] = (
      (inventoryRes.data || []) as Record<string, unknown>[]
    ).map((inv) => ({
      id: String(inv.id),
      date: String(inv.date || new Date().toISOString()),
      totalVarianceValue: Number(inv.total_variance_value) || 0,
      notes: (inv.notes as string | undefined) || undefined,
      items: Array.isArray(inv.items)
        ? (inv.items as Record<string, unknown>[]).map((i) => ({
            productId: String(i.product_id),
            productName: String(i.product_name || ""),
            expectedStock: Number(i.expected_stock) || 0,
            actualStock: Number(i.actual_stock) || 0,
            variance: Number(i.variance) || 0,
            costPrice: Number(i.cost_price) || 0,
          }))
        : [],
    }));
    mergedInventory =
      hasPreviousData && wm("inventory_sessions")
        ? mergeById(currentState.inventorySessions || [], serverInv)
        : serverInv;

    const serverExpenses: Expense[] = (
      (expensesRes.data || []) as Record<string, unknown>[]
    ).map((e) => ({
      id: String(e.id),
      date: String(e.date || ""),
      category: String(e.category || ""),
      description: String(e.description || ""),
      amount: Number(e.amount) || 0,
      createdAt: String(e.created_at || e.date || new Date().toISOString()),
      updatedAt: (e.updated_at as string | undefined) || undefined,
    }));
    const validExpIds = expenseIdsRes.data
      ? new Set(
          (expenseIdsRes.data as Array<{ id: string }>).map((r) => String(r.id))
        )
      : null;
    mergedExpenses =
      hasPreviousData && wm("expenses")
        ? mergeById(currentState.expenses || [], serverExpenses, validExpIds)
        : serverExpenses;
  }

  let mergedCategories: Category[] =
    (categoriesRes.data as Category[] | null) &&
    categoriesRes.data!.length > 0
      ? (categoriesRes.data as Category[])
      : currentState.categories;

  if (validIdsFilterNeeded(categoryIdsRes.data)) {
    const validCats = new Set(
      (categoryIdsRes.data as Array<{ id: string }>).map((r) => String(r.id))
    );
    mergedCategories = mergedCategories.filter((c) => validCats.has(c.id));
  }

  const sRow = settingsRes.data as Record<string, unknown> | null;
  let mergedSettings: StoreSettings = sRow
    ? {
        name: storeName || String(sRow.name || currentState.settings.name),
        currency: String(sRow.currency || currentState.settings.currency || "FCFA"),
        taxRate:
          sRow.tax_rate !== undefined && sRow.tax_rate !== null
            ? Number(sRow.tax_rate)
            : (currentState.settings.taxRate ?? 0),
        logo: String(sRow.logo || currentState.settings.logo || "/logo.png"),
        city: (sRow.city as string | undefined) ?? currentState.settings.city,
        country:
          (sRow.country as string | undefined) ?? currentState.settings.country,
        email:
          (sRow.email as string | undefined) ?? currentState.settings.email,
        phone:
          (sRow.phone as string | undefined) ?? currentState.settings.phone,
        managerName:
          (sRow.manager_name as string | undefined) ??
          currentState.settings.managerName,
        allowNegativeStock:
          sRow.allow_negative_stock !== undefined &&
          sRow.allow_negative_stock !== null
            ? Boolean(sRow.allow_negative_stock)
            : Boolean(currentState.settings.allowNegativeStock),
        updatedAt:
          (sRow.updated_at as string | undefined) ??
          currentState.settings.updatedAt,
      }
    : { ...currentState.settings, name: storeName || currentState.settings.name };

  // ── BOUCLIER ANTI-ÉCRASEMENT : Protéger toutes les opérations encore en Outbox ──
  const pendingOutbox = await getOutboxItems({
    scopeKey,
    storeId,
    statuses: ["pending", "syncing", "auth_paused", "conflict"],
    includeLegacyUserForStore: true,
  });

  const unsyncedSaleIds = new Set<string>();
  const stockAdjustments = new Map<string, number>();

  for (const op of pendingOutbox) {
    switch (op.opType) {
      case "OPEN_CASH_SESSION":
      case "CLOSE_CASH_SESSION": {
        const cs = op.payload as CashSession;
        const idx = mergedCashSessions.findIndex((x) => x.id === cs.id);
        if (idx >= 0) {
          mergedCashSessions[idx] = cs;
        } else {
          mergedCashSessions = [cs, ...mergedCashSessions];
        }
        break;
      }
      case "COMPLETE_SALE": {
        const s = op.payload as Sale;
        if (!s?.id) break;
        const alreadyOnServer = serverSales.some((srv) => srv.id === s.id);
        if (!alreadyOnServer) {
          unsyncedSaleIds.add(s.id);
          if (!mergedSales.some((ms) => ms.id === s.id)) {
            mergedSales = [s, ...mergedSales];
          }
          for (const it of s.items || []) {
            const refQty =
              it.quantityReference && Number(it.quantityReference) > 0
                ? Number(it.quantityReference)
                : Number(it.quantity) * (Number(it.unitMultiplier) || 1);
            stockAdjustments.set(
              it.productId,
              (stockAdjustments.get(it.productId) || 0) - refQty
            );
          }
        }
        break;
      }
      case "CONVERT_QUOTE_TO_SALE": {
        const payload = op.payload as { quoteId: string; sale: Sale };
        if (payload?.quoteId) {
          mergedQuotes = mergedQuotes.map((q) =>
            q.id === payload.quoteId
              ? { ...q, status: "converted", saleId: payload.sale?.id || null }
              : q
          );
        }
        if (payload?.sale?.id) {
          const alreadyOnServer = serverSales.some(
            (srv) => srv.id === payload.sale.id
          );
          if (!alreadyOnServer) {
            unsyncedSaleIds.add(payload.sale.id);
            if (!mergedSales.some((s) => s.id === payload.sale.id)) {
              mergedSales = [payload.sale, ...mergedSales];
            }
            for (const it of payload.sale.items || []) {
              const refQty =
                it.quantityReference && Number(it.quantityReference) > 0
                  ? Number(it.quantityReference)
                  : Number(it.quantity) * (Number(it.unitMultiplier) || 1);
              stockAdjustments.set(
                it.productId,
                (stockAdjustments.get(it.productId) || 0) - refQty
              );
            }
          }
        }
        break;
      }
      case "RECORD_DEBT_PAYMENT": {
        const dp = op.payload as {
          id: string;
          saleId: string;
          paymentAmount: number;
          newPaid?: number;
          newRemaining?: number;
          newStatus?: "paid" | "partial" | "unpaid";
          method: "cash" | "mobile_money" | "card";
          note?: string;
          cashierName?: string;
          createdAt?: string;
        };
        mergedSales = mergedSales.map((ms) => {
          if (ms.id !== dp.saleId) return ms;
          const hasPay = (ms.payments || []).some((p) => p.id === dp.id);
          const nextPaid = Math.max(ms.amountPaid || 0, dp.newPaid ?? 0);
          const nextRem = Math.max(0, ms.total - nextPaid);
          return {
            ...ms,
            amountPaid: nextPaid,
            remainingAmount: nextRem,
            paymentStatus:
              nextRem === 0 ? "paid" : nextPaid > 0 ? "partial" : "unpaid",
            payments: hasPay
              ? ms.payments
              : [
                  {
                    id: dp.id,
                    saleId: dp.saleId,
                    amount: dp.paymentAmount,
                    paymentMethod: dp.method,
                    paidAt: dp.createdAt || op.createdAt,
                    note: dp.note,
                    cashierName: dp.cashierName,
                  },
                  ...(ms.payments || []),
                ],
          };
        });
        break;
      }
      case "ADD_PRODUCT":
      case "UPDATE_PRODUCT": {
        const p = op.payload as Product;
        const idx = mergedProducts.findIndex((mp) => mp.id === p.id);
        if (idx >= 0) mergedProducts[idx] = p;
        else mergedProducts.push(p);
        stockAdjustments.set(p.id, 0);
        break;
      }
      case "BATCH_ADD_PRODUCTS": {
        const arr = (op.payload as Product[]) || [];
        arr.forEach((p) => {
          const idx = mergedProducts.findIndex((mp) => mp.id === p.id);
          if (idx >= 0) mergedProducts[idx] = p;
          else mergedProducts.push(p);
          stockAdjustments.set(p.id, 0);
        });
        break;
      }
      case "DELETE_PRODUCT": {
        mergedProducts = mergedProducts.filter((p) => p.id !== op.entityId);
        break;
      }
      case "ADD_CUSTOMER": {
        const c = op.payload as Customer;
        if (!mergedCustomers.some((mc) => mc.id === c.id)) {
          mergedCustomers.push(c);
        }
        break;
      }
      case "ADD_CATEGORY": {
        const cat = op.payload as Category;
        if (!mergedCategories.some((c) => c.id === cat.id)) {
          mergedCategories.push(cat);
        }
        break;
      }
      case "DELETE_CATEGORY": {
        mergedCategories = mergedCategories.filter((c) => c.id !== op.entityId);
        break;
      }
      case "ADD_BATCH": {
        const b = op.payload as ProductBatch;
        if (!mergedBatches.some((mb) => mb.id === b.id)) {
          mergedBatches.push(b);
        }
        break;
      }
      case "DELETE_BATCH": {
        mergedBatches = mergedBatches.filter((b) => b.id !== op.entityId);
        break;
      }
      case "ADD_EXPENSE":
      case "UPDATE_EXPENSE": {
        if (!isAdmin) break;
        const exp = op.payload as Expense;
        const idx = mergedExpenses.findIndex((e) => e.id === exp.id);
        if (idx >= 0) mergedExpenses[idx] = exp;
        else mergedExpenses.unshift(exp);
        break;
      }
      case "DELETE_EXPENSE": {
        mergedExpenses = mergedExpenses.filter((e) => e.id !== op.entityId);
        break;
      }
      case "ADD_ORDER": {
        if (!isAdmin) break;
        const o = op.payload as Order;
        if (!mergedOrders.some((mo) => mo.id === o.id)) {
          mergedOrders.unshift(o);
        }
        break;
      }
      case "UPDATE_ORDER_STATUS": {
        if (!isAdmin) break;
        const { orderId } = op.payload as { orderId: string };
        const ord = mergedOrders.find((o) => o.id === orderId);
        if (ord && ord.status !== "received") {
          mergedOrders = mergedOrders.map((o) =>
            o.id === orderId ? { ...o, status: "received" } : o
          );
          for (const it of ord.items) {
            const mult = Number(it.unitMultiplier) || 1;
            const refQty =
              it.quantityReference && Number(it.quantityReference) > 0
                ? Number(it.quantityReference)
                : Number(it.quantity) * mult;
            stockAdjustments.set(
              it.productId,
              (stockAdjustments.get(it.productId) || 0) + refQty
            );
          }
        }
        break;
      }
      case "DELETE_ORDER": {
        mergedOrders = mergedOrders.filter((o) => o.id !== op.entityId);
        break;
      }
      case "ADD_QUOTE":
      case "UPDATE_QUOTE": {
        const q = op.payload as Quote;
        const idx = mergedQuotes.findIndex((mq) => mq.id === q.id);
        if (idx >= 0) mergedQuotes[idx] = q;
        else mergedQuotes.unshift(q);
        break;
      }
      case "DELETE_QUOTE": {
        mergedQuotes = mergedQuotes.filter((q) => q.id !== op.entityId);
        break;
      }
      case "ADD_INVENTORY_SESSION": {
        const inv = op.payload as InventorySession;
        if (!mergedInventory.some((i) => i.id === inv.id)) {
          mergedInventory.unshift(inv);
          for (const item of inv.items) {
            stockAdjustments.set(
              item.productId,
              (stockAdjustments.get(item.productId) || 0) + Number(item.variance || 0)
            );
          }
        }
        break;
      }
      case "ADD_PRICE_HISTORY_ENTRY": {
        const h = op.payload as PriceHistoryEntry;
        if (h?.id && !mergedPriceHistory.some((mh) => mh.id === h.id)) {
          mergedPriceHistory.unshift(h);
        }
        break;
      }
      case "UPDATE_SETTINGS": {
        const patch = op.payload as Partial<StoreSettings>;
        mergedSettings = { ...mergedSettings, ...patch };
        break;
      }
    }
  }

  // Appliquer les ajustements de stock des ventes/réceptions/inventaires encore en attente
  if (stockAdjustments.size > 0) {
    mergedProducts = mergedProducts.map((p) => {
      const adj = stockAdjustments.get(p.id);
      if (!adj) return p;
      const nextStock = mergedSettings.allowNegativeStock
        ? Math.round((p.stock + adj) * 1000) / 1000
        : Math.max(0, Math.round((p.stock + adj) * 1000) / 1000);
      return { ...p, stock: nextStock };
    });
  }

  // Tris déterministes
  mergedProducts.sort((a, b) => a.name.localeCompare(b.name));
  mergedSales.sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );
  mergedCashSessions.sort(
    (a, b) => (Date.parse(b.openedAt) || 0) - (Date.parse(a.openedAt) || 0)
  );
  mergedExpenses.sort(
    (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
  );

  // Déterminer session caisse active (priorité à l'utilisateur courant si caissier)
  const activeSession =
    mergedCashSessions.find(
      (cs) =>
        cs.status === "open" &&
        (isAdmin || !cs.userId || cs.userId === userId)
    ) || null;

  const nextState: StoreState = {
    products: mergedProducts,
    sales: mergedSales,
    orders: mergedOrders,
    expenses: mergedExpenses,
    customers: mergedCustomers,
    cart: currentState.cart || [],
    categories: mergedCategories,
    inventorySessions: mergedInventory,
    cashSessions: mergedCashSessions,
    activeCashSession: activeSession,
    settings: mergedSettings,
    batches: mergedBatches,
    priceHistory: mergedPriceHistory.sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    ),
    quotes: mergedQuotes.sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    ),
  };

  // Enregistrer les nouveaux curseurs incrémentaux
  const cursorUpdates: Array<{ table: string; ts: string; count: number }> = [
    {
      table: "products",
      ts: maxTimestampIso(cursorMap.get("products") || null, [
        ...((productsRes.data || []) as Array<{ updated_at?: string; created_at?: string }>).map(
          (r) => r.updated_at || r.created_at
        ),
        serverSyncAt,
      ]),
      count: (productsRes.data || []).length,
    },
    {
      table: "sales",
      ts: maxTimestampIso(cursorMap.get("sales") || null, [
        ...((salesRes.data || []) as Array<{ updated_at?: string; created_at?: string }>).map(
          (r) => r.updated_at || r.created_at
        ),
        serverSyncAt,
      ]),
      count: (salesRes.data || []).length,
    },
    {
      table: "sale_debt_payments",
      ts: maxTimestampIso(cursorMap.get("sale_debt_payments") || null, [
        ...sdpRows.map((r) => String(r.updated_at || r.paid_at || "")),
        serverSyncAt,
      ]),
      count: sdpRows.length,
    },
    {
      table: "customers",
      ts: maxTimestampIso(cursorMap.get("customers") || null, [serverSyncAt]),
      count: (customersRes.data || []).length,
    },
    {
      table: "cash_sessions",
      ts: maxTimestampIso(cursorMap.get("cash_sessions") || null, [serverSyncAt]),
      count: (cashSessionsRes.data || []).length,
    },
    {
      table: "product_batches",
      ts: maxTimestampIso(cursorMap.get("product_batches") || null, [serverSyncAt]),
      count: (productBatchesRes.data || []).length,
    },
    {
      table: "product_price_history",
      ts: maxTimestampIso(cursorMap.get("product_price_history") || null, [
        serverSyncAt,
      ]),
      count: (priceHistoryRes.data || []).length,
    },
    {
      table: "quotes",
      ts: maxTimestampIso(cursorMap.get("quotes") || null, [serverSyncAt]),
      count: (quotesRes.data || []).length,
    },
  ];

  if (isAdmin) {
    cursorUpdates.push(
      {
        table: "orders",
        ts: maxTimestampIso(cursorMap.get("orders") || null, [serverSyncAt]),
        count: (ordersRes.data || []).length,
      },
      {
        table: "inventory_sessions",
        ts: maxTimestampIso(cursorMap.get("inventory_sessions") || null, [
          serverSyncAt,
        ]),
        count: (inventoryRes.data || []).length,
      },
      {
        table: "expenses",
        ts: maxTimestampIso(cursorMap.get("expenses") || null, [serverSyncAt]),
        count: (expensesRes.data || []).length,
      }
    );
  }

  await Promise.all(
    cursorUpdates.map((cu) =>
      saveSyncCursor({
        userId,
        storeId,
        entityTable: cu.table,
        lastSyncedAt: cu.ts,
        lastRecordCount: cu.count,
      })
    )
  );

  const extra: StoreSnapshotExtra = {
    debtPayments: Object.fromEntries(serverPaymentsBySale.entries()),
    productUnitsByProduct: Object.fromEntries(unitsByProduct.entries()),
  };

  // Sauvegarder le snapshot structuré isolé par `${userId}:${storeId}`
  await saveStoreSnapshot({
    userId,
    storeId,
    role,
    state: nextState,
    lastServerSyncAt: serverSyncAt,
    extra,
  });

  return {
    state: nextState,
    extra,
    serverSyncAt,
    wasIncremental: Boolean(hasPreviousData),
  };
}

function validIdsFilterNeeded(data: unknown): data is Array<{ id: string }> {
  return Array.isArray(data) && data.length > 0;
}

export async function clearDoneOutboxItems(
  userId: string,
  storeId: string
): Promise<number> {
  return clearOutboxForScope(makeScopeKey(userId, storeId), {
    mode: "scope",
    includeUnsynced: false,
    statuses: ["done"],
  });
}
