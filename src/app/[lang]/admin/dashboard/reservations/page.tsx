import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import PageHeader from "@/components/admin/PageHeader";
import ReservationTable from "@/components/admin/ReservationTable";
import Loading from "@/components/common/Loading";
import Pagination from "@/components/common/Pagination";
import { requireAdmin } from "@/lib/auth";
import { dayOfWeek, minutesToTime, timeToMinutes, todayIn } from "@/lib/helpers";
import { reservationListQuerySchema } from "@/lib/validation";
import { listReservations, reservationsForDay, toReservationDTO } from "@/services/reservationService";
import { getRestaurant } from "@/services/restaurantService";
import { getI18n } from "@/i18n/server";
import { listTables } from "@/services/tableService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.reservations.title };
}

type SP = PageProps<"/[lang]/admin/dashboard/reservations">["searchParams"];

async function Reservations({ searchParams }: { searchParams: SP }) {
  await connection();
  const { t, lang } = await getI18n();
  const admin = await requireAdmin(lang);
  const raw = await searchParams;
  const sp = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string" && v)) as Record<string, string>;
  const parsed = reservationListQuerySchema.safeParse({ scope: "upcoming", ...sp });
  const filters = parsed.success ? parsed.data : reservationListQuerySchema.parse({ scope: "upcoming" });
  // A specific date shows that whole day regardless of the upcoming/past scope.
  if (filters.date) filters.scope = "all";

  const restaurant = await getRestaurant();
  const today = todayIn(restaurant.timezone);
  const view = sp.view === "day" ? "day" : "table";

  let day = null;
  if (view === "day") {
    const date = filters.date ?? today;
    const [rows, tables] = await Promise.all([reservationsForDay(date), listTables()]);
    const shifts = restaurant.openingHours.filter((h) => h.dayOfWeek === dayOfWeek(date));
    const range = shifts.length
      ? {
          start: minutesToTime(Math.min(...shifts.map((s) => timeToMinutes(s.opensAt)))),
          end: minutesToTime(Math.max(...shifts.map((s) => timeToMinutes(s.closesAt)))),
        }
      : null;
    day = { date, reservations: rows.map((r) => toReservationDTO(r, admin)), tables, range };
  }

  const result = view === "table" ? await listReservations(filters, admin) : null;

  return (
    <>
      <ReservationTable
        reservations={result?.items.map((r) => toReservationDTO(r, admin)) ?? []}
        view={view}
        day={day}
        defaultDate={today}
        openNew={sp.new === "1"}
      />
      {result && (
        <Pagination
          t={t}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          basePath="/admin/dashboard/reservations"
          params={{ q: sp.q, date: sp.date, status: sp.status, scope: sp.scope }}
        />
      )}
    </>
  );
}

export default async function ReservationsPage(props: PageProps<"/[lang]/admin/dashboard/reservations">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.admin.reservations.title} description={t.admin.reservations.lead} />
      <Suspense fallback={<Loading rows={4} label={t.common.loading} />}>
        <Reservations searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
