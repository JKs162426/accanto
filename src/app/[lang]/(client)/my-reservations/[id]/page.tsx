import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusBadge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import Loading from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import ReservationEditor from "@/components/reservations/ReservationEditor";
import { requireUser } from "@/lib/auth";
import { orNotFound } from "@/lib/pages";
import { formatDate, tableTags, todayIn } from "@/lib/helpers";
import { fmt, plural } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { getReservation, isClientEditable, toReservationDTO } from "@/services/reservationService";
import { getRestaurant } from "@/services/restaurantService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.myReservations };
}

type Props = PageProps<"/[lang]/my-reservations/[id]">;

async function Detail({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, sp, { t, lang }] = await Promise.all([params, searchParams, getI18n()]);
  const user = await requireUser(lang, `/my-reservations/${id}`);
  const [raw, restaurant] = await Promise.all([orNotFound(getReservation(id, user)), getRestaurant()]);
  const reservation = toReservationDTO(raw, user);
  const editable = isClientEditable(raw);
  const action = sp.action === "edit" || sp.action === "cancel" ? sp.action : undefined;

  const rows: Array<[string, string]> = [
    [t.reserve.time, reservation.time],
    [t.reserve.people, plural(reservation.partySize, t.common.people)],
    [t.reserve.table, `${reservation.table.number} · ${tableTags(t, reservation.table).join(", ")}`],
    [t.myReservations.bookedFor, reservation.guestName],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-semibold tracking-widest text-accent-text">{reservation.code}</p>
            <h1 className="mt-1 text-h3 first-letter:uppercase">{formatDate(reservation.date, lang)}</h1>
          </div>
          <StatusBadge status={reservation.status} />
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="mt-0.5 text-base">{value}</dd>
            </div>
          ))}
          {reservation.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted">{t.myReservations.specialRequests}</dt>
              <dd className="mt-0.5">{reservation.notes}</dd>
            </div>
          )}
        </dl>
      </Card>
      {editable ? (
        <ReservationEditor
          reservation={reservation}
          today={todayIn(restaurant.timezone)}
          bookingWindowDays={restaurant.bookingWindowDays}
          maxPartySize={restaurant.maxPartySize}
          initialAction={action}
        />
      ) : (
        <p className="text-sm text-muted">
          {t.myReservations.notEditable}
          {restaurant.phone && fmt(t.myReservations.callUs, { phone: restaurant.phone })}
        </p>
      )}
    </div>
  );
}

export default async function ReservationDetailPage(props: Props) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-2xl">
      <LocaleLink href="/my-reservations" className="mb-4 inline-block font-ui text-sm text-muted hover:text-primary">
        {t.myReservations.back}
      </LocaleLink>
      <Suspense fallback={<Loading rows={2} label={t.common.loading} />}>
        <Detail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
