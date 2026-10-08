"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/helpers";
import { useI18n } from "@/i18n/client";
import type { ReservationStatus } from "@/types/database";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 font-ui text-caption font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

// Brand status colours: confirmed = olive, attended = blue (info),
// no-show = terracotta (warning), cancelled = red (error).
const statusTone: Record<ReservationStatus, Tone> = {
  CONFIRMED: "success",
  ATTENDED: "info",
  NO_SHOW: "warning",
  CANCELLED: "danger",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const { t } = useI18n();
  return <Badge tone={statusTone[status]}>{t.enums.reservationStatus[status]}</Badge>;
}
