"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  GitMerge,
  HardDrive,
  History,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import type { OutboxItem, OutboxOperationType } from "@/lib/offlineDb";
import { probeServerHealth } from "@/lib/networkMonitor";

const OP_LABELS: Record<OutboxOperationType, string> = {
  OPEN_CASH_SESSION: "Ouverture de caisse",
  CLOSE_CASH_SESSION: "Clôture de caisse (Rapport Z)",
  COMPLETE_SALE: "Vente POS",
  CONVERT_QUOTE_TO_SALE: "Conversion devis en vente",
  RECORD_DEBT_PAYMENT: "Encaissement créance client",
  ADD_CUSTOMER: "Ajout client",
  ADD_PRODUCT: "Création produit",
  UPDATE_PRODUCT: "Modification produit",
  DELETE_PRODUCT: "Suppression produit",
  BATCH_ADD_PRODUCTS: "Importation catalogue en lot",
  ADD_BATCH: "Ajout lot / péremption",
  DELETE_BATCH: "Suppression lot / péremption",
  ADD_CATEGORY: "Ajout catégorie",
  DELETE_CATEGORY: "Suppression catégorie",
  ADD_EXPENSE: "Ajout dépense",
  UPDATE_EXPENSE: "Modification dépense",
  DELETE_EXPENSE: "Suppression dépense",
  ADD_ORDER: "Nouvelle commande fournisseur",
  UPDATE_ORDER_STATUS: "Réception commande fournisseur",
  DELETE_ORDER: "Suppression commande fournisseur",
  ADD_INVENTORY_SESSION: "Validation inventaire physique",
  ADD_QUOTE: "Création devis / proforma",
  UPDATE_QUOTE: "Modification devis",
  DELETE_QUOTE: "Suppression devis",
  ADD_PRICE_HISTORY_ENTRY: "Historique tarifaire",
  UPDATE_SETTINGS: "Paramètres boutique",
};

function formatOpLabel(opType: OutboxOperationType): string {
  return OP_LABELS[opType] || opType;
}

function summarizePayload(item: OutboxItem): string {
  const p = (item.payload || {}) as Record<string, unknown>;
  if (item.opType === "COMPLETE_SALE") {
    const total = Number(p.total || 0).toLocaleString("fr-FR");
    const method = String(p.paymentMethod || "");
    const cust = p.customerName ? ` • ${String(p.customerName)}` : "";
    return `Total ${total} FCFA (${method})${cust}`;
  }
  if (item.opType === "RECORD_DEBT_PAYMENT") {
    const amt = Number(p.paymentAmount || p.amount || 0).toLocaleString("fr-FR");
    return `Versement ${amt} FCFA`;
  }
  if (item.opType === "ADD_PRODUCT" || item.opType === "UPDATE_PRODUCT") {
    return String(p.name || item.entityId);
  }
  if (item.opType === "OPEN_CASH_SESSION" || item.opType === "CLOSE_CASH_SESSION") {
    return String(p.cashierName || "Session de caisse");
  }
  if (item.opType === "ADD_QUOTE" || item.opType === "UPDATE_QUOTE") {
    return `${String(p.quoteNumber || "Devis")} • ${String(p.customerName || "")}`.trim();
  }
  if (item.opType === "ADD_ORDER") {
    return `${String(p.supplierName || "Fournisseur")}`;
  }
  if (item.opType === "UPDATE_SETTINGS") {
    return String(p.name || "Boutique");
  }
  return item.entityId;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "N/A";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function NetworkStatusPill({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  const {
    networkStatus,
    networkHealth,
    isSyncing,
    outboxCounts,
    isRealtimeActive,
  } = useStore();
  const { sessionExpired } = useAuth();

  const hasConflictOrAuth =
    sessionExpired ||
    outboxCounts.conflict > 0 ||
    outboxCounts.authPaused > 0 ||
    outboxCounts.failed > 0;

  const pendingCount = outboxCounts.actionableTotal;

  let badgeClasses =
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/15";
  let dotClasses = "bg-emerald-500";
  let label = "En ligne";
  let Icon = Wifi;

  if (hasConflictOrAuth) {
    badgeClasses =
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35 hover:bg-rose-500/20";
    dotClasses = "bg-rose-500";
    Icon = ShieldAlert;
    label = sessionExpired
      ? "Session expirée"
      : outboxCounts.conflict > 0
      ? `${outboxCounts.conflict} conflit(s)`
      : outboxCounts.authPaused > 0
      ? `Reconnexion requise (${outboxCounts.authPaused})`
      : `${outboxCounts.failed} échec(s)`;
  } else if (networkStatus === "offline") {
    badgeClasses =
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 hover:bg-amber-500/20";
    dotClasses = "bg-amber-500";
    Icon = WifiOff;
    label = "Hors-ligne";
  } else if (networkStatus === "degraded") {
    badgeClasses =
      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 hover:bg-orange-500/20";
    dotClasses = "bg-orange-500";
    Icon = AlertTriangle;
    label =
      networkHealth.latencyMs !== null
        ? `Réseau lent (${Math.round(networkHealth.latencyMs)} ms)`
        : "Réseau lent";
  } else if (networkStatus === "checking" || isSyncing) {
    badgeClasses =
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20";
    dotClasses = "bg-blue-500";
    Icon = RefreshCw;
    label = isSyncing ? "Synchronisation..." : "Vérification...";
  } else if (pendingCount > 0) {
    badgeClasses =
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20";
    dotClasses = "bg-blue-500";
    Icon = RefreshCw;
    label = `${pendingCount} en attente`;
  } else if (!compact && isRealtimeActive) {
    label = "En ligne • Direct";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-2xs ${badgeClasses}`}
      title="Ouvrir le Centre de Synchronisation, Conflits & Stockage Hors-Ligne"
    >
      {networkStatus === "checking" || isSyncing ? (
        <Icon className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : (
        <>
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClasses} ${
              networkStatus === "online" && !hasConflictOrAuth
                ? "animate-pulse"
                : ""
            }`}
          />
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </>
      )}
      <span className="truncate max-w-[175px]">{label}</span>
      {pendingCount > 0 && (hasConflictOrAuth || networkStatus === "offline" || networkStatus === "degraded") && (
        <span className="ml-0.5 rounded-full bg-background/80 px-1.5 py-0.2 text-[10px] font-black text-foreground border border-border/50">
          {pendingCount}
        </span>
      )}
    </button>
  );
}

export default function SyncCenterModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    networkStatus,
    networkHealth,
    isSyncing,
    lastSyncedAt,
    syncError,
    outboxCounts,
    outboxItems,
    conflictItems,
    syncLogs,
    storageDiagnostics,
    triggerManualSync,
    retryOutboxOperation,
    dismissOutboxOperation,
    resolveConflict,
    refreshOutbox,
    exportOfflineBackup,
  } = useStore();
  const { sessionExpired, activeStore, role } = useAuth();

  const [activeTab, setActiveTab] = useState<"queue" | "conflicts" | "logs">(
    conflictItems.length > 0 ? "conflicts" : "queue"
  );

  useEffect(() => {
    if (isOpen) {
      setStatusBanner(null);
      setConfirmDismissId(null);
      if (conflictItems.length > 0) {
        setActiveTab("conflicts");
      }
    }
  }, [isOpen, conflictItems.length]);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [confirmDismissId, setConfirmDismissId] = useState<string | null>(null);
  const [isCheckingConn, setIsCheckingConn] = useState(false);

  const visibleQueueItems = useMemo(
    () => outboxItems.filter((item) => item.status !== "done"),
    [outboxItems]
  );

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setStatusBanner(null);
    const res = await triggerManualSync({ forcePull: true });
    if (res.networkOffline) {
      setStatusBanner({
        type: "info",
        text: "Serveur inaccessible : vos données restent protégées localement et reprendront dès le retour du réseau.",
      });
    } else if (res.authPaused) {
      setStatusBanner({
        type: "error",
        text: "Session expirée détectée : reconnectez-vous depuis la bannière en haut de l'écran pour envoyer la file d'attente.",
      });
    } else if (res.conflicts > 0) {
      setActiveTab("conflicts");
      setStatusBanner({
        type: "error",
        text: `${res.conflicts} conflit(s) nécessitent votre décision dans l'onglet Conflits.`,
      });
    } else if (res.succeeded > 0 || res.failed === 0) {
      setStatusBanner({
        type: "success",
        text:
          res.succeeded > 0
            ? `Synchronisation terminée : ${res.succeeded} opération(s) envoyée(s).`
            : "Tout est déjà synchronisé avec le serveur.",
      });
    } else {
      setStatusBanner({
        type: "error",
        text: `${res.failed} opération(s) n'ont pas encore pu être envoyées.`,
      });
    }
  };

  const handleTestNetwork = async () => {
    setIsCheckingConn(true);
    setStatusBanner(null);
    try {
      const snap = await probeServerHealth({ timeoutMs: 3500, force: true });
      await refreshOutbox();
      if (snap.authInvalid) {
        setStatusBanner({
          type: "error",
          text: "Serveur joignable, mais le jeton de session doit être renouvelé.",
        });
      } else if (snap.isReachable) {
        setStatusBanner({
          type: "success",
          text: `Serveur joignable (${snap.latencyMs ?? 0} ms • statut ${
            snap.status === "degraded" ? "réseau lent" : "optimal"
          }).`,
        });
      } else {
        setStatusBanner({
          type: "info",
          text: "Serveur Supabase inaccessible (coupure internet ou portail captif Wi-Fi).",
        });
      }
    } finally {
      setIsCheckingConn(false);
    }
  };

  const handleConflictDecision = async (
    itemId: string,
    decision: "keep_server" | "force_local" | "dismiss"
  ) => {
    setBusyItemId(itemId);
    setStatusBanner(null);
    try {
      const res = await resolveConflict(itemId, decision);
      if (res.success) {
        setStatusBanner({
          type: "success",
          text:
            decision === "keep_server"
              ? "Version du serveur conservée et état local actualisé."
              : decision === "force_local"
              ? "Version locale forcée avec succès."
              : "Opération retirée de la file.",
        });
      } else {
        setStatusBanner({
          type: "error",
          text: res.error || "Impossible d'appliquer cette résolution pour le moment.",
        });
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const handleRetryOne = async (itemId: string) => {
    setBusyItemId(itemId);
    setStatusBanner(null);
    try {
      await retryOutboxOperation(itemId);
      setStatusBanner({
        type: "info",
        text: "Nouvelle tentative lancée.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDismissOne = async (itemId: string) => {
    setBusyItemId(itemId);
    setStatusBanner(null);
    try {
      await dismissOutboxOperation(itemId);
      setConfirmDismissId(null);
      setStatusBanner({
        type: "info",
        text: "Opération supprimée de la file locale.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleQuickBackupDownload = async () => {
    const payload = await exportOfflineBackup();
    if (!payload) {
      setStatusBanner({
        type: "error",
        text: "Impossible de générer la sauvegarde locale.",
      });
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const storeSlug = (activeStore?.name || "boutique")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `sauvegarde-offline-${storeSlug}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({
      type: "success",
      text: "Sauvegarde JSON téléchargée sur cet appareil.",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto print:hidden">
      <div className="w-full max-w-2xl rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-secondary/25">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              {networkStatus === "offline" ? (
                <CloudOff className="h-5 w-5 text-amber-500" />
              ) : (
                <Database className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-foreground truncate">
                Centre de Synchronisation &amp; Conflits
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {activeStore?.name || "Boutique active"} •{" "}
                {lastSyncedAt
                  ? `Dernière sync : ${new Date(lastSyncedAt).toLocaleString("fr-FR")}`
                  : "Aucune sync récente enregistrée"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Network & Storage Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 px-5 py-3.5 border-b border-border/40 bg-secondary/10">
          <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">
              État Réseau
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <span
                className={`h-2 w-2 rounded-full ${
                  networkStatus === "online"
                    ? "bg-emerald-500"
                    : networkStatus === "degraded"
                    ? "bg-orange-500"
                    : networkStatus === "checking"
                    ? "bg-blue-500"
                    : "bg-amber-500"
                }`}
              />
              <span>
                {networkStatus === "online"
                  ? "En ligne"
                  : networkStatus === "degraded"
                  ? "Réseau lent"
                  : networkStatus === "checking"
                  ? "Vérification..."
                  : "Hors-ligne"}
              </span>
              {networkHealth.latencyMs !== null && networkHealth.isReachable && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  ({Math.round(networkHealth.latencyMs)} ms)
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">
              File Locale (WAL)
            </div>
            <div className="mt-1 text-sm font-bold text-foreground">
              {outboxCounts.actionableTotal} en file{" "}
              {outboxCounts.conflict > 0 && (
                <span className="text-rose-600 dark:text-rose-400">
                  • {outboxCounts.conflict} conflit(s)
                </span>
              )}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-3 ${
              storageDiagnostics?.isNearLimit
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-border/50 bg-background/70"
            }`}
          >
            <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              <span>Stockage IndexedDB</span>
            </div>
            <div className="mt-1 text-sm font-bold text-foreground">
              {storageDiagnostics?.usagePercent !== null &&
              storageDiagnostics?.usagePercent !== undefined
                ? `${storageDiagnostics.usagePercent.toFixed(1)}% (${formatBytes(
                    storageDiagnostics.usageBytes
                  )})`
                : `${outboxItems.length} entrées locales`}
            </div>
          </div>
        </div>

        {/* Alerts inside modal */}
        {(statusBanner || syncError || storageDiagnostics?.isNearLimit || sessionExpired) && (
          <div className="px-5 pt-3 space-y-2">
            {sessionExpired && (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0" />
                <span>
                  Votre session d&apos;authentification a expiré. Utilisez la bannière de reconnexion en haut de l&apos;application sans perdre vos ventes locales.
                </span>
              </div>
            )}
            {storageDiagnostics?.isNearLimit && (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Stockage navigateur presque saturé ({storageDiagnostics.usagePercent?.toFixed(1)}%). Synchronisez et exportez une sauvegarde JSON par précaution.
                </span>
              </div>
            )}
            {syncError && (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {syncError}
              </div>
            )}
            {statusBanner && (
              <div
                className={`rounded-2xl border px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                  statusBanner.type === "success"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : statusBanner.type === "error"
                    ? "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                }`}
              >
                {statusBanner.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{statusBanner.text}</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "queue"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            File d&apos;attente ({visibleQueueItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("conflicts")}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "conflicts"
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitMerge className="h-3.5 w-3.5" />
            <span>Conflits ({conflictItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "logs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Journal ({syncLogs.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === "queue" && (
            <>
              {visibleQueueItems.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-foreground">
                    Aucune opération en attente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toutes les ventes, caisses et modifications locales ont été synchronisées.
                  </p>
                </div>
              ) : (
                visibleQueueItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/60 bg-secondary/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {formatOpLabel(item.opType)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === "conflict"
                              ? "bg-rose-500/15 text-rose-600"
                              : item.status === "failed"
                              ? "bg-red-500/15 text-red-600"
                              : item.status === "auth_paused"
                              ? "bg-amber-500/15 text-amber-700"
                              : item.status === "syncing"
                              ? "bg-blue-500/15 text-blue-600"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {item.status === "auth_paused"
                            ? "Session requise"
                            : item.status === "conflict"
                            ? "Conflit"
                            : item.status === "failed"
                            ? `Échec (${item.retryCount})`
                            : item.status === "syncing"
                            ? "Envoi..."
                            : "En attente"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {summarizePayload(item)} •{" "}
                        {new Date(item.createdAt).toLocaleString("fr-FR")}
                      </p>
                      {item.lastError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium break-words">
                          {item.lastError}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === "conflict" ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab("conflicts")}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-500/25 cursor-pointer"
                        >
                          Résoudre
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRetryOne(item.id)}
                          disabled={busyItemId === item.id || isSyncing}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Réessayer
                        </button>
                      )}

                      {confirmDismissId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDismissOne(item.id)}
                            disabled={busyItemId === item.id}
                            className="px-2.5 py-1.5 rounded-xl bg-destructive text-white text-xs font-bold cursor-pointer"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDismissId(null)}
                            className="px-2 py-1.5 rounded-xl border border-border/60 text-xs font-semibold cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDismissId(item.id)}
                          disabled={busyItemId === item.id}
                          className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Retirer manuellement cette opération locale"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === "conflicts" && (
            <>
              {conflictItems.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-foreground">
                    Aucun conflit détecté
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vos modifications locales et celles du serveur sont cohérentes.
                  </p>
                </div>
              ) : (
                conflictItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-rose-500/35 bg-rose-500/5 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold text-foreground">
                          {formatOpLabel(item.opType)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {summarizePayload(item)} •{" "}
                          {new Date(item.createdAt).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 text-[10px] font-bold uppercase">
                        {item.conflictData?.code || "CONFLIT"}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-background/70 rounded-xl p-2.5 border border-rose-500/20">
                      {item.conflictData?.message ||
                        item.lastError ||
                        "La ressource a été modifiée sur un autre appareil avant l'envoi de votre opération."}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConflictDecision(item.id, "force_local")}
                        disabled={busyItemId === item.id}
                        className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        Garder ma version
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConflictDecision(item.id, "keep_server")}
                        disabled={busyItemId === item.id}
                        className="px-3.5 py-2 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80 disabled:opacity-50 cursor-pointer"
                      >
                        Garder celle du serveur
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConflictDecision(item.id, "dismiss")}
                        disabled={busyItemId === item.id}
                        className="px-3 py-2 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer ml-auto"
                      >
                        Ignorer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === "logs" && (
            <>
              {syncLogs.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Aucun événement de synchronisation enregistré pour cette session.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {syncLogs.slice(0, 40).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border/40 bg-secondary/15 px-3 py-2 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span
                          className={`inline-block mr-2 font-bold uppercase text-[10px] ${
                            log.level === "error" || log.level === "conflict"
                              ? "text-rose-600"
                              : log.level === "warn"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          [{log.level}]
                        </span>
                        <span className="text-foreground break-words">
                          {log.message}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString("fr-FR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-border/50 bg-secondary/20 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestNetwork}
              disabled={isCheckingConn}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
            >
              <Wifi className={`h-3.5 w-3.5 ${isCheckingConn ? "animate-pulse" : ""}`} />
              <span>{isCheckingConn ? "Test..." : "Tester réseau"}</span>
            </button>

            {role === "admin" && (
              <button
                type="button"
                onClick={handleQuickBackupDownload}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                title="Exporter une copie de secours locale en JSON"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Backup JSON</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm cursor-pointer disabled:opacity-50 ml-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Synchronisation..." : "Synchroniser maintenant"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
