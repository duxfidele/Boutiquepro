"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  RotateCcw,
  Check,
  X
} from "lucide-react";

export type PeriodType = "today" | "week" | "month" | "all" | "custom_day" | "custom_range";

export interface DatePeriodFilterProps {
  period: PeriodType;
  setPeriod: (period: PeriodType) => void;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  startDate: string; // YYYY-MM-DD
  setStartDate: (date: string) => void;
  endDate: string; // YYYY-MM-DD
  setEndDate: (date: string) => void;
  periodLabel: string;
  className?: string;
}

export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDayShort(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function DatePeriodFilter({
  period,
  setPeriod,
  selectedDate,
  setSelectedDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  periodLabel,
  className = "",
}: DatePeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customMode, setCustomMode] = useState<"day" | "range">("day");

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateString(d);
  }, []);
  const twoDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return toLocalDateString(d);
  }, []);
  const threeDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return toLocalDateString(d);
  }, []);
  const fourDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 4);
    return toLocalDateString(d);
  }, []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalDateString(d);
  }, []);

  const handleSelectCustomDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    setPeriod("custom_day");
  };

  const handleSelectRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setPeriod("custom_range");
  };

  const isCustomActive = period === "custom_day" || period === "custom_range";

  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      {/* Barre des boutons de période */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="inline-flex items-center p-1 rounded-2xl bg-secondary/80 border border-border/60 shadow-inner flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setPeriod("today");
              setIsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === "today"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Aujourd&apos;hui
          </button>

          <button
            type="button"
            onClick={() => {
              setPeriod("week");
              setIsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === "week"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Cette Semaine
          </button>

          <button
            type="button"
            onClick={() => {
              setPeriod("month");
              setIsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === "month"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            Ce Mois-ci
          </button>

          <button
            type="button"
            onClick={() => {
              setPeriod("all");
              setIsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === "all"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            Tout
          </button>

          {/* Bouton Calendrier / Période Personnalisée */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isCustomActive
                ? "bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md scale-[1.02]"
                : isOpen
                ? "bg-secondary text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
            title="Choisir un jour précis ou une période personnalisée"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>
              {isCustomActive ? periodLabel : "Calendrier / Période"}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Panneau déroulant de sélection avancée */}
      {isOpen && (
        <div className="mt-1 p-4 rounded-2xl bg-card border border-border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 z-30 max-w-lg space-y-4">
          {/* Header du panneau */}
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CalendarRange className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Filtrer par date ou période</p>
                <p className="text-[11px] text-muted-foreground">Consultez les données passées de votre boutique</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Onglets Jour Précis vs Plage de Dates */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border/40 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setCustomMode("day");
                if (period !== "custom_day") {
                  setPeriod("custom_day");
                  if (!selectedDate) setSelectedDate(yesterdayStr);
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                customMode === "day"
                  ? "bg-background shadow-xs text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Jour précis
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomMode("range");
                if (period !== "custom_range") {
                  setPeriod("custom_range");
                  if (!startDate) setStartDate(sevenDaysAgoStr);
                  if (!endDate) setEndDate(todayStr);
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                customMode === "range"
                  ? "bg-background shadow-xs text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Plage de dates (Du... Au...)
            </button>
          </div>

          {/* Contenu selon le mode */}
          {customMode === "day" ? (
            <div className="space-y-3">
              {/* Raccourcis rapides */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Raccourcis rapides :
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "Hier", date: yesterdayStr },
                    { label: "Avant-hier", date: twoDaysAgoStr },
                    { label: "Il y a 3 jours", date: threeDaysAgoStr },
                    { label: "Il y a 4 jours", date: fourDaysAgoStr },
                    { label: "Il y a 7 jours", date: sevenDaysAgoStr },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleSelectCustomDay(chip.date)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        period === "custom_day" && selectedDate === chip.date
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendrier date picker natif */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Ou choisissez une journée dans le calendrier :</span>
                  {selectedDate && (
                    <span className="text-primary font-bold text-[11px]">
                      {formatDayDisplay(selectedDate)}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  max={todayStr}
                  value={selectedDate}
                  onChange={(e) => handleSelectCustomDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Raccourcis de plage */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Plages prédéfinies :
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    {
                      label: "7 derniers jours",
                      start: sevenDaysAgoStr,
                      end: todayStr,
                    },
                    {
                      label: "14 derniers jours",
                      start: (() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 14);
                        return toLocalDateString(d);
                      })(),
                      end: todayStr,
                    },
                    {
                      label: "30 derniers jours",
                      start: (() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        return toLocalDateString(d);
                      })(),
                      end: todayStr,
                    },
                    {
                      label: "Mois précédent",
                      start: (() => {
                        const d = new Date();
                        const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
                        return toLocalDateString(first);
                      })(),
                      end: (() => {
                        const d = new Date();
                        const last = new Date(d.getFullYear(), d.getMonth(), 0);
                        return toLocalDateString(last);
                      })(),
                    },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleSelectRange(chip.start, chip.end)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        period === "custom_range" && startDate === chip.start && endDate === chip.end
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélection Du / Au */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Du (Date de début) :</label>
                  <input
                    type="date"
                    max={endDate || todayStr}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPeriod("custom_range");
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Au (Date de fin) :</label>
                  <input
                    type="date"
                    min={startDate}
                    max={todayStr}
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPeriod("custom_range");
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer statut & validation */}
          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span className="truncate max-w-[240px]">Période active : {periodLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPeriod("today");
                  setIsOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1 hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-primary text-primary-foreground rounded-lg font-bold text-xs hover:opacity-90 shadow-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
