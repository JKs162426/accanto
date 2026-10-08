"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/common/Button";
import { StatusBadge } from "@/components/common/Badge";
import ErrorAlert from "@/components/common/ErrorAlert";
import Modal from "@/components/common/Modal";
import { useReservations } from "@/hooks/useReservations";
import { ApiRequestError } from "@/lib/apiClient";
import { formatDate, formatMonthShort, tableTags } from "@/lib/helpers";
import LocaleLink from "@/components/common/LocaleLink";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/format";
import type { ReservationDTO } from "@/types";

/**
 * One reservation. Cancelling flips the badge immediately (useOptimistic);
 * if the API refuses, React drops the optimistic state and we show why.
 */
export default function ReservationCard({ reservation, editable }: { reservation: ReservationDTO; editable: boolean }) {
  const { cancel } = useReservations();
  const { t, lang } = useI18n();
  const [status, setOptimisticStatus] = useOptimistic(reservation.status);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onCancel() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      setOptimisticStatus("CANCELLED");
      try {
        await cancel(reservation.id);
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : t.myReservations.cancelFailed);
      }
    });
  }

  const [, month, day] = reservation.date.split("-");
  const canAct = editable && status === "CONFIRMED";

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-hover sm:flex-row sm:items-center sm:p-6">
      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-lg border border-gold bg-surface-raised text-primary">
        <span className="font-display text-3xl leading-none font-bold">{Number(day)}</span>
        <span className="font-ui text-caption tracking-wide text-accent-text uppercase">
          {formatMonthShort(Number(month), lang)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h4 leading-tight first-letter:uppercase">{formatDate(reservation.date, lang)}</h3>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-foreground">
          {reservation.time} · {plural(reservation.partySize, t.common.people)} · {fmt(t.common.table, { n: reservation.table.number })} (
          {tableTags(t, reservation.table).join(", ")})
        </p>
        <p className="mt-1 font-mono text-caption tracking-wider text-muted">{reservation.code}</p>
        {error && <ErrorAlert className="mt-2">{error}</ErrorAlert>}
      </div>
      <div className="flex gap-2 sm:flex-col sm:items-stretch">
        <LocaleLink
          href={`/my-reservations/${reservation.id}`}
          className={buttonClasses("secondary", "sm")}
        >
          {canAct ? t.myReservations.viewEdit : t.myReservations.viewDetail}
        </LocaleLink>
        {canAct && (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)} loading={pending}>
            {t.myReservations.cancel}
          </Button>
        )}
      </div>
      <Modal open={confirming} onClose={() => setConfirming(false)} title={t.myReservations.cancelTitle}>
        <p className="text-muted">
          {fmt(t.myReservations.cancelText, {
            table: reservation.table.number,
            date: formatDate(reservation.date, lang),
            time: reservation.time,
          })}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>{t.myReservations.keep}</Button>
          <Button variant="danger" onClick={onCancel}>{t.myReservations.confirmCancel}</Button>
        </div>
      </Modal>
    </article>
  );
}
