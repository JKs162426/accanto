"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Input, Textarea } from "@/components/common/Field";
import { Skeleton } from "@/components/common/Loading";
import Modal from "@/components/common/Modal";
import { useAsync } from "@/hooks/useAsync";
import { useAvailability } from "@/hooks/useAvailability";
import { useReservations } from "@/hooks/useReservations";
import { addDays } from "@/lib/helpers";
import type { ReservationDTO } from "@/types";
import { SlotPicker } from "./AvailableTables";
import { useI18n } from "@/i18n/client";

/**
 * Client-side edit/cancel for one reservation. `initialAction` comes from the
 * email buttons (?action=edit|cancel).
 */
export default function ReservationEditor({
  reservation,
  today,
  bookingWindowDays,
  maxPartySize,
  initialAction,
}: {
  reservation: ReservationDTO;
  today: string;
  bookingWindowDays: number;
  maxPartySize: number;
  initialAction?: "edit" | "cancel";
}) {
  const router = useRouter();
  const { t, href } = useI18n();
  const { update, cancel } = useReservations();
  const [editing, setEditing] = useState(initialAction === "edit");
  const [confirmCancel, setConfirmCancel] = useState(initialAction === "cancel");
  const [date, setDate] = useState(reservation.date);
  const [partySize, setPartySize] = useState(reservation.partySize);
  const [time, setTime] = useState<string | undefined>(reservation.time);
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [saved, setSaved] = useState(false);

  const { availability, loading } = useAvailability(
    editing ? { date, partySize, excludeReservationId: reservation.id } : null,
  );
  const save = useAsync(async () => {
    await update(reservation.id, { date, time, partySize, notes: notes || null });
    setEditing(false);
    setSaved(true);
  });
  const doCancel = useAsync(async () => {
    await cancel(reservation.id);
    setConfirmCancel(false);
    router.push(href("/my-reservations"));
  });

  const unchanged =
    date === reservation.date && time === reservation.time && partySize === reservation.partySize && notes === (reservation.notes ?? "");

  return (
    <div className="space-y-4">
      {saved && <ErrorAlert tone="success">{t.myReservations.updated}</ErrorAlert>}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setEditing(true); setSaved(false); }}>{t.myReservations.edit}</Button>
          <Button variant="danger" onClick={() => setConfirmCancel(true)}>{t.myReservations.cancelReservation}</Button>
        </div>
      ) : (
        <form
          className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save.run();
          }}
        >
          <h2 className="text-h4 font-semibold">{t.myReservations.edit}</h2>
          <ErrorAlert>{save.error}</ErrorAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t.reserve.date}
              name="date"
              type="date"
              value={date}
              min={today}
              max={addDays(today, bookingWindowDays)}
              onChange={(e) => { setDate(e.target.value); setTime(undefined); }}
              error={save.fieldErrors.date}
            />
            <Input
              label={t.reserve.people}
              name="partySize"
              type="number"
              min={1}
              max={maxPartySize}
              value={partySize}
              onChange={(e) => { setPartySize(Number(e.target.value)); setTime(undefined); }}
              error={save.fieldErrors.partySize}
            />
          </div>
          <div>
            <p className="mb-2 font-ui text-[13px] font-medium">{t.reserve.time}</p>
            {!availability && loading ? (
              <Skeleton className="h-24" />
            ) : availability?.open ? (
              <SlotPicker slots={availability.slots} selected={time} onSelect={setTime} />
            ) : (
              <ErrorAlert tone="info">{availability?.message}</ErrorAlert>
            )}
            <p className="mt-2 text-body-sm text-muted">{t.myReservations.reassignHint}</p>
          </div>
          <Textarea label={t.myReservations.specialRequests} name="notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" loading={save.loading} disabled={!time || unchanged}>{t.myReservations.saveChanges}</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>{t.common.discard}</Button>
          </div>
        </form>
      )}

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={t.myReservations.cancelTitle}>
        <p className="text-muted">{t.myReservations.irreversible}</p>
        <ErrorAlert className="mt-3">{doCancel.error}</ErrorAlert>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>{t.myReservations.keep}</Button>
          <Button variant="danger" loading={doCancel.loading} onClick={() => void doCancel.run()}>{t.myReservations.confirmCancel}</Button>
        </div>
      </Modal>
    </div>
  );
}
