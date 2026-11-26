import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import Loading from "@/components/common/Loading";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { formatDate, fromDbDate, tableTags } from "@/lib/helpers";
import { fmt, plural } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { getReservation } from "@/services/reservationService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.reserve.confirmedTitle };
}

async function Confirmation({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/reserve/confirmation">["searchParams"];
}) {
  const [{ id }, { t, lang }] = await Promise.all([searchParams, getI18n()]);
  const user = await requireUser(lang, "/my-reservations");
  const reservation =
    typeof id === "string"
      ? await getReservation(id, user).catch((e) =>
          e instanceof AppError ? null : Promise.reject(e),
        )
      : null;

  if (!reservation) {
    return (
      <Card className="text-center">
        <p className="font-display text-h4 text-primary font-semibold">{t.reserve.notFound}</p>
        <ButtonLink href="/my-reservations" className="mt-4">
          {t.nav.myReservations}
        </ButtonLink>
      </Card>
    );
  }

  const rows: Array<[string, string]> = [
    [t.reserve.when, formatDate(fromDbDate(reservation.date), lang)],
    [t.reserve.time, reservation.time],
    [t.reserve.people, plural(reservation.partySize, t.common.people)],
    [
      t.reserve.table,
      `${reservation.table.number} · ${tableTags(t, reservation.table).join(", ")}`,
    ],
  ];

  return (
    <Card className="p-6 text-center sm:p-10">
      <div className="bg-success-soft text-success mx-auto flex size-14 items-center justify-center rounded-full">
        <svg
          viewBox="0 0 24 24"
          className="size-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>
      <h1 className="text-h3 sm:text-h2 mt-4">{t.reserve.confirmedTitle}</h1>
      <p className="text-body-lg text-muted mt-2">
        {fmt(t.reserve.confirmedSent, { email: reservation.guestEmail })}
      </p>
      <p className="font-ui text-caption text-muted mt-6 tracking-widest uppercase">
        {t.reserve.code}
      </p>
      <p className="border-gold bg-surface-raised text-accent-text mt-1 inline-block rounded-md border px-4 py-2 font-mono text-3xl font-bold tracking-widest">
        {reservation.code}
      </p>
      <dl className="mx-auto mt-6 grid max-w-sm gap-2 text-left text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <ButtonLink href={`/my-reservations/${reservation.id}`}>{t.reserve.viewOrEdit}</ButtonLink>
        <ButtonLink href="/my-reservations" variant="secondary">
          {t.nav.myReservations}
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function ConfirmationPage(props: PageProps<"/[lang]/reserve/confirmation">) {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<Loading rows={2} />}>
        <Confirmation searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
