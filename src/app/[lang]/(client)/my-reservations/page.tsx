import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, chipClasses } from "@/components/common/Button";
import Loading from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import Pagination from "@/components/common/Pagination";
import ReservationsList from "@/components/reservations/ReservationsList";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isClientEditable, listReservations, toReservationDTO } from "@/services/reservationService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.myReservations.title };
}

type SP = PageProps<"/[lang]/my-reservations">["searchParams"];

async function List({ searchParams }: { searchParams: SP }) {
  const [sp, { t, lang }] = await Promise.all([searchParams, getI18n()]);
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const user = await requireUser(lang, "/my-reservations");
  const result = await listReservations({ scope: tab, page, pageSize: 10 }, user);
  const now = new Date();
  const editable = new Set(result.items.filter((r) => isClientEditable(r, now)).map((r) => r.id));

  return (
    <>
      <nav className="mb-6 flex gap-2" aria-label={t.myReservations.filter}>
        <LocaleLink href="/my-reservations" className={chipClasses(tab === "upcoming", "px-4 py-2")} aria-current={tab === "upcoming" ? "page" : undefined}>
          {t.myReservations.upcoming}
        </LocaleLink>
        <LocaleLink href="/my-reservations?tab=past" className={chipClasses(tab === "past", "px-4 py-2")} aria-current={tab === "past" ? "page" : undefined}>
          {t.myReservations.past}
        </LocaleLink>
      </nav>
      <ReservationsList
        reservations={result.items.map((r) => toReservationDTO(r, user))}
        editableIds={editable}
        emptyTitle={tab === "upcoming" ? t.myReservations.emptyUpcoming : t.myReservations.emptyPast}
        emptyCta={tab === "upcoming" ? t.myReservations.bookCta : undefined}
      />
      <Pagination t={t} page={result.page} pageSize={result.pageSize} total={result.total} basePath="/my-reservations" params={{ tab: tab === "past" ? "past" : undefined }} />
    </>
  );
}

export default async function MyReservationsPage(props: PageProps<"/[lang]/my-reservations">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] leading-tight sm:text-h2">{t.myReservations.title}</h1>
          <p className="mt-1 text-body-lg text-muted">{t.myReservations.lead}</p>
        </div>
        <ButtonLink href="/reserve">{t.myReservations.newReservation}</ButtonLink>
      </div>
      <Suspense fallback={<Loading rows={3} label={t.common.loading} />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
