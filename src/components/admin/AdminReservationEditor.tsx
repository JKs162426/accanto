"use client";

import { useOptimistic, useState, useTransition } from "react";
import { StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader } from "@/components/common/Card";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Input, Select, Textarea } from "@/components/common/Field";
import { Skeleton } from "@/components/common/Loading";
import Modal from "@/components/common/Modal";
import { SlotPicker } from "@/components/reservations/AvailableTables";
import { useAsync } from "@/hooks/useAsync";
import { useAvailability } from "@/hooks/useAvailability";
import { useReservations } from "@/hooks/useReservations";
import { ApiRequestError } from "@/lib/apiClient";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { ReservationStatus } from "@/types/database";
import type { ReservationDTO } from "@/types";

/** Attendance buttons with optimistic status, plus edit / notes / cancel. */
export default function AdminReservationEditor({ reservation }: { reservation: ReservationDTO }) {
  const { update, cancel } = useReservations();
  const { t } = useI18n();
  const a = t.admin.reservations;
  const [status, setOptimisticStatus] = useOptimistic(reservation.status);
  const [pending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [date, setDate] = useState(reservation.date);
  const [time, setTime] = useState<string | undefined>(reservation.time);
  const [partySize, setPartySize] = useState(reservation.partySize);
  const [tableId, setTableId] = useState(reservation.table.id);
  const { availability, loading } = useAvailability(
    editing ? { date, partySize, time, excludeReservationId: reservation.id } : null,
  );

  const saveSlot = useAsync(async () => {
    await update(reservation.id, { date, time, partySize, tableId });
    setEditing(false);
  });
  const saveNotes = useAsync(async (internalNotes: string) => update(reservation.id, { internalNotes: internalNotes || null }));
  const doCancel = useAsync(async () => {
    await cancel(reservation.id);
    setConfirmCancel(false);
  });

  function setStatus(next: Exclude<ReservationStatus, "CANCELLED">) {
    setStatusError(null);
    startTransition(async () => {
      setOptimisticStatus(next);
      try {
        await update(reservation.id, { status: next });
      } catch (e) {
        setStatusError(e instanceof ApiRequestError ? e.message : a.statusFailed);
      }
    });
  }

  const cancelled = status === "CANCELLED";
  const tableOptions = availability?.time === time ? availability?.tables ?? [] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={a.attendance} description={a.attendanceHint} action={<StatusBadge status={status} />} />
        <ErrorAlert>{statusError}</ErrorAlert>
        {!cancelled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant={status === "ATTENDED" ? "primary" : "secondary"} disabled={pending} onClick={() => setStatus("ATTENDED")}>{a.attended}</Button>
            <Button variant={status === "NO_SHOW" ? "primary" : "secondary"} disabled={pending} onClick={() => setStatus("NO_SHOW")}>{a.noShow}</Button>
            {status !== "CONFIRMED" && <Button variant="ghost" disabled={pending} onClick={() => setStatus("CONFIRMED")}>{a.backToConfirmed}</Button>}
          </div>
        ) : (
          <p className="text-sm text-muted">{a.isCancelled}</p>
        )}
      </Card>

      {!cancelled && (
        <Card>
          <CardHeader
            title={a.slotTitle}
            action={!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{t.common.edit}</Button>}
          />
          {!editing ? (
            <p className="text-sm text-muted">{a.slotHint}</p>
          ) : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveSlot.run(); }}>
              <ErrorAlert>{saveSlot.error}</ErrorAlert>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t.reserve.date} name="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(undefined); }} />
                <Input label={t.reserve.people} name="partySize" type="number" min={1} max={20} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} />
              </div>
              {!availability && loading ? <Skeleton className="h-20" /> : availability?.open ? (
                <SlotPicker slots={availability.slots} selected={time} onSelect={setTime} />
              ) : <ErrorAlert tone="info">{availability?.message}</ErrorAlert>}
              {time && (
                <Select label={a.form.table} name="tableId" value={tableId} onChange={(e) => setTableId(e.target.value)}
                  hint={tableOptions.some((x) => x.id === tableId) ? undefined : a.tableUnavailable}>
                  {!tableOptions.some((x) => x.id === tableId) && (
                    <option value={tableId}>{fmt(a.tableNotAvailableOption, { n: reservation.table.number })}</option>
                  )}
                  {tableOptions.map((x) => (
                    <option key={x.id} value={x.id}>
                      {fmt(a.tableOption, { n: x.number, capacity: x.capacity, location: t.enums.location[x.location] })}
                    </option>
                  ))}
                </Select>
              )}
              <div className="flex gap-2">
                <Button type="submit" loading={saveSlot.loading} disabled={!time}>{t.common.save}</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>{t.common.discard}</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title={a.internalNotes} description={a.internalNotesHint} />
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveNotes.run(String(new FormData(e.currentTarget).get("internalNotes") ?? "")); }}>
          <ErrorAlert>{saveNotes.error}</ErrorAlert>
          <Textarea label={a.notes} name="internalNotes" defaultValue={reservation.internalNotes ?? ""} maxLength={1000} />
          <Button type="submit" size="sm" variant="secondary" loading={saveNotes.loading}>{a.saveNotes}</Button>
        </form>
      </Card>

      {status === "CONFIRMED" && (
        <div>
          <Button variant="danger" onClick={() => setConfirmCancel(true)}>{a.cancelReservation}</Button>
        </div>
      )}
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={a.cancelTitle}>
        <p className="text-sm text-muted">{fmt(a.cancelText, { name: reservation.guestName })}</p>
        <ErrorAlert className="mt-3">{doCancel.error}</ErrorAlert>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>{t.common.back}</Button>
          <Button variant="danger" loading={doCancel.loading} onClick={() => void doCancel.run()}>{a.cancelReservation}</Button>
        </div>
      </Modal>
    </div>
  );
}
