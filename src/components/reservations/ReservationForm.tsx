"use client";

import type { FormEvent } from "react";
import type { z } from "zod";
import { Button } from "@/components/common/Button";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Input, Textarea } from "@/components/common/Field";
import { useAsync } from "@/hooks/useAsync";
import { useZodForm } from "@/hooks/useZodForm";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/format";
import { formatDate, tableTags } from "@/lib/helpers";
import { createReservationSchema } from "@/lib/validation";
import type { ReservationDTO, SessionUser, PublicTableDTO } from "@/types";

export interface ReservationDraft {
  date: string;
  time: string;
  partySize: number;
  table: PublicTableDTO;
}

/** Final step: guest details (prefilled from the account) and confirmation. */
export default function ReservationForm({
  draft,
  user,
  onSubmit,
}: {
  draft: ReservationDraft;
  user: Pick<SessionUser, "name" | "email" | "phone">;
  onSubmit: (body: z.infer<typeof createReservationSchema>) => Promise<ReservationDTO>;
}) {
  const { t, lang } = useI18n();
  const { validate, clientErrors } = useZodForm();
  const { run, loading, error, fieldErrors } = useAsync(onSubmit);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = validate(createReservationSchema, {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      date: draft.date,
      time: draft.time,
      partySize: draft.partySize,
      tableId: draft.table.id,
    });
    if (data) await run(data);
  }

  const errors = { ...fieldErrors, ...clientErrors };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="rounded-lg border border-line bg-surface-raised p-4">
        <p className="font-display text-h4 font-semibold text-primary first-letter:uppercase">{formatDate(draft.date, lang)}</p>
        <p className="mt-1 text-body-sm">
          {draft.time} · {plural(draft.partySize, t.common.people)} · {fmt(t.common.table, { n: draft.table.number })} (
          {tableTags(t, draft.table).join(", ")})
        </p>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t.reserve.guestName} name="guestName" defaultValue={user.name} autoComplete="name" required error={errors.guestName} />
        <Input label={t.reserve.guestEmail} name="guestEmail" type="email" value={user.email} readOnly aria-readonly="true" className="bg-surface-muted" error={errors.guestEmail} hint={t.reserve.guestEmailHint} />
        <Input label={t.reserve.guestPhone} name="guestPhone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" error={errors.guestPhone} fieldClassName="sm:col-span-2" />
        <Textarea
          label={t.reserve.notes}
          name="notes"
          maxLength={500}
          placeholder={t.reserve.notesPlaceholder}
          error={errors.notes}
          fieldClassName="sm:col-span-2"
        />
      </div>
      <Button type="submit" size="lg" loading={loading} className="w-full sm:w-auto">
        {t.reserve.confirm}
      </Button>
    </form>
  );
}
