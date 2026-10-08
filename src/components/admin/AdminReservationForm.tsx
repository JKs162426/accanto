"use client";

import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { Button } from "@/components/common/Button";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Input, Textarea } from "@/components/common/Field";
import { Skeleton } from "@/components/common/Loading";
import AvailableTables, { SlotPicker } from "@/components/reservations/AvailableTables";
import { useAsync } from "@/hooks/useAsync";
import { useAvailability } from "@/hooks/useAvailability";
import { useReservations } from "@/hooks/useReservations";
import { adminCreateReservationSchema } from "@/lib/validation";
import { useZodForm } from "@/hooks/useZodForm";
import { useI18n } from "@/i18n/client";

import type { ReservationDTO } from "@/types";

/**
 * Manual booking from the dashboard (phone / walk-in). If the email belongs
 * to a registered client the reservation is linked to their account.
 */
export default function AdminReservationForm({
  defaultDate,
  onCreated,
}: {
  defaultDate: string;
  onCreated: (r: ReservationDTO) => void;
}) {
  const { create } = useReservations();
  const { t } = useI18n();
  const f = t.admin.reservations.form;
  const { validate, clientErrors } = useZodForm();
  const [date, setDate] = useState(defaultDate);
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState<string>();
  const [tableId, setTableId] = useState<string>();
  const { availability, loading } = useAvailability({ date, partySize, time });
  const submit = useAsync(async (body: z.infer<typeof adminCreateReservationSchema>) => onCreated(await create(body)));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const data = validate(adminCreateReservationSchema, { ...fd, date, time, partySize, tableId });
    if (data) void submit.run(data);
  }
  const errors = { ...submit.fieldErrors, ...clientErrors };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorAlert>{submit.error}</ErrorAlert>
      <div className="grid grid-cols-2 gap-4">
        <Input label={t.reserve.date} name="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(undefined); setTableId(undefined); }} error={errors.date} />
        <Input label={t.reserve.people} name="partySize" type="number" min={1} max={20} value={partySize} onChange={(e) => { setPartySize(Number(e.target.value)); setTime(undefined); setTableId(undefined); }} error={errors.partySize} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{f.time}</p>
        {!availability && loading ? <Skeleton className="h-20" /> : availability?.open ? (
          <SlotPicker slots={availability.slots} selected={time} onSelect={(t) => { setTime(t); setTableId(undefined); }} />
        ) : <ErrorAlert tone="info">{availability?.message}</ErrorAlert>}
        {errors.time && <p className="mt-1 text-caption text-danger">{errors.time[0]}</p>}
      </div>
      {time && availability?.time === time && (
        <div>
          <p className="mb-2 text-sm font-medium">{f.table}</p>
          {availability.tables?.length ? (
            <AvailableTables tables={availability.tables} selected={tableId} onSelect={setTableId} />
          ) : <ErrorAlert tone="info">{f.noTables}</ErrorAlert>}
          {errors.tableId && <p className="mt-1 text-caption text-danger">{errors.tableId[0]}</p>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={f.clientName} name="guestName" required error={errors.guestName} />
        <Input label={t.reserve.guestEmail} name="guestEmail" type="email" required error={errors.guestEmail} hint={f.emailHint} />
        <Input label={t.reserve.guestPhone} name="guestPhone" type="tel" error={errors.guestPhone} />
        <Textarea label={f.clientNotes} name="notes" rows={2} error={errors.notes} />
        <Textarea label={t.admin.reservations.internalNotes} name="internalNotes" rows={2} error={errors.internalNotes} fieldClassName="sm:col-span-2" />
      </div>
      <Button type="submit" loading={submit.loading} disabled={!tableId}>{f.create}</Button>
    </form>
  );
}
