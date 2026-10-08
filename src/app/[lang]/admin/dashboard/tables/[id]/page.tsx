import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/admin/PageHeader";
import TableEditor from "@/components/admin/TableEditor";
import { StatusBadge } from "@/components/common/Badge";
import { Card, CardHeader } from "@/components/common/Card";
import Loading from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import { requireAdmin } from "@/lib/auth";
import { orNotFound } from "@/lib/pages";
import { db } from "@/lib/db";
import { formatDate, fromDbDate } from "@/lib/helpers";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { getTable, toTableDTO } from "@/services/tableService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.tables.title };
}

async function TableDetail({ params }: { params: PageProps<"/[lang]/admin/dashboard/tables/[id]">["params"] }) {
  const [{ id }, { t, lang }] = await Promise.all([params, getI18n()]);
  await requireAdmin(lang);
  const table = await orNotFound(getTable(id));
  const [upcoming, completed] = await Promise.all([
    db.reservation.findMany({
      where: { tableId: id, status: "CONFIRMED", endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 15,
    }),
    db.reservation.count({ where: { tableId: id, status: "ATTENDED" } }),
  ]);

  return (
    <>
      <PageHeader title={fmt(t.common.table, { n: table.number })} description={fmt(t.admin.tables.completed, { n: completed })} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.admin.tables.config} />
          <TableEditor table={toTableDTO(table)} />
        </Card>
        <Card>
          <CardHeader title={t.admin.tables.upcoming} />
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">{t.admin.tables.noUpcoming}</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <LocaleLink href={`/admin/dashboard/reservations/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary hover:underline">
                    <span>{formatDate(fromDbDate(r.date), lang, "short")} · {r.time} · {r.guestName} ({r.partySize})</span>
                    <StatusBadge status={r.status} />
                  </LocaleLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export default async function TablePage(props: PageProps<"/[lang]/admin/dashboard/tables/[id]">) {
  const { t } = await getI18n();
  return (
    <>
      <LocaleLink href="/admin/dashboard/tables" className="mb-2 inline-block text-sm text-muted hover:text-primary">{t.admin.tables.back}</LocaleLink>
      <Suspense fallback={<Loading rows={2} label={t.common.loading} />}>
        <TableDetail params={props.params} />
      </Suspense>
    </>
  );
}
