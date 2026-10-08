import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientNotes } from "@/components/admin/ClientManager";
import PageHeader from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/common/Badge";
import { Card, CardHeader, StatCard } from "@/components/common/Card";
import Loading from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import Pagination from "@/components/common/Pagination";
import { requireAdmin } from "@/lib/auth";
import { orNotFound } from "@/lib/pages";
import { formatDate, formatMonthYear, fromDbDate } from "@/lib/helpers";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { listReservations } from "@/services/reservationService";
import { getClient } from "@/services/userService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.clients.title };
}

type Props = PageProps<"/[lang]/admin/dashboard/clients/[id]">;

async function ClientDetail({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, sp, { t, lang }] = await Promise.all([params, searchParams, getI18n()]);
  const c = t.admin.clients;
  const admin = await requireAdmin(lang);
  const page = Math.max(1, Number(sp.page) || 1);
  const [client, history] = await Promise.all([
    orNotFound(getClient(id)),
    listReservations({ clientId: id, scope: "all", page, pageSize: 10 }, admin),
  ]);
  const s = client.stats;
  const reminders = [client.remind24h && "24 h", client.remind2h && "2 h"].filter(Boolean).join(c.and) || c.remindersOff;

  return (
    <>
      <PageHeader title={client.name} description={fmt(c.since, { date: formatMonthYear(client.createdAt, lang) })} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={c.visits} value={s.ATTENDED ?? 0} />
            <StatCard label={c.upcoming} value={s.CONFIRMED ?? 0} />
            <StatCard label={c.noShows} value={s.NO_SHOW ?? 0} />
            <StatCard label={c.cancelled} value={s.CANCELLED ?? 0} />
          </div>
          <Card>
            <CardHeader title={c.history} />
            {history.items.length === 0 ? (
              <p className="text-sm text-muted">{c.noReservations}</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.items.map((r) => (
                  <li key={r.id}>
                    <LocaleLink href={`/admin/dashboard/reservations/${r.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary">
                      <span>
                        <span className="font-medium">{formatDate(fromDbDate(r.date), lang, "short")} · {r.time}</span>
                        <span className="ml-2 text-muted">
                          {fmt(t.common.peopleShort, { n: r.partySize })} · {fmt(t.common.table, { n: r.table.number })}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            )}
            <Pagination t={t} page={history.page} pageSize={history.pageSize} total={history.total} basePath={`/admin/dashboard/clients/${id}`} params={{}} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={c.contact} />
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Email</dt><dd><a className="hover:text-primary hover:underline" href={`mailto:${client.email}`}>{client.email}</a></dd></div>
              <div><dt className="text-muted">{c.colPhone}</dt><dd>{client.phone ?? t.common.none}</dd></div>
              <div><dt className="text-muted">{c.reminders}</dt><dd>{reminders}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title={c.teamNotes} />
            <ClientNotes clientId={client.id} initial={client.adminNotes} />
          </Card>
        </div>
      </div>
    </>
  );
}

export default async function ClientPage(props: Props) {
  const { t } = await getI18n();
  return (
    <>
      <LocaleLink href="/admin/dashboard/clients" className="mb-2 inline-block text-sm text-muted hover:text-primary">{t.admin.clients.back}</LocaleLink>
      <Suspense fallback={<Loading rows={3} label={t.common.loading} />}>
        <ClientDetail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
