"use client";

import { Badge, StatusBadge } from "@/components/common/Badge";
import { linkClasses } from "@/components/common/Button";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/common/Card";
import LocaleLink from "@/components/common/LocaleLink";
import { useTables, type LiveTable } from "@/hooks/useTables";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn, formatDate, formatPercent } from "@/lib/helpers";
import type { ReservationDTO } from "@/types";
import ReportsChart, { type ChartPoint } from "./ReportsChart";
import { LiveStateBadge } from "./TableManager";

export interface DashboardData {
  today: string;
  counts: { today: number; week: number; month: number; coversToday: number };
  occupancyNow: { occupied: number; total: number };
  todayByHour: ChartPoint[];
  upcomingByDay: ChartPoint[];
}

/** Admin home. Table states poll every 30 s through useTables. */
export default function Dashboard({
  data,
  todayReservations,
  initialTables,
}: {
  data: DashboardData;
  todayReservations: ReservationDTO[];
  initialTables: LiveTable[];
}) {
  const { t, lang } = useI18n();
  const d = t.admin.dashboard;
  const { tables } = useTables(initialTables);
  const active = tables.filter((x) => x.liveState !== "OUT_OF_SERVICE");
  const occupied = tables.filter((x) => x.liveState === "OCCUPIED").length;
  const ratio = active.length ? occupied / active.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={d.today}
          value={data.counts.today}
          hint={fmt(d.covers, { n: data.counts.coversToday })}
        />
        <StatCard label={d.week} value={data.counts.week} hint={d.weekHint} />
        <StatCard label={d.month} value={data.counts.month} />
        <StatCard
          label={d.occupancyNow}
          value={formatPercent(ratio, lang)}
          hint={fmt(d.occupancyHint, { occupied, total: active.length })}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <ReportsChart
            title={d.byHourToday}
            data={data.todayByHour}
            description={formatDate(data.today, lang)}
          />
        </Card>
        <Card>
          <ReportsChart
            title={d.byDayNext}
            data={data.upcomingByDay}
            formatLabel={(l) => l.slice(8)}
            formatTooltipLabel={(l) => formatDate(l, lang)}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            title={d.todayList}
            action={
              <LocaleLink
                href={`/admin/dashboard/reservations?view=day&date=${data.today}`}
                className={cn(linkClasses, "text-sm")}
              >
                {d.openAgenda}
              </LocaleLink>
            }
          />
          {todayReservations.length === 0 ? (
            <EmptyState title={d.noneToday} />
          ) : (
            <ul className="divide-line divide-y">
              {todayReservations.map((r) => (
                <li key={r.id}>
                  <LocaleLink
                    href={`/admin/dashboard/reservations/${r.id}`}
                    className="hover:bg-surface-raised -mx-2 flex items-center gap-3 rounded-md px-2 py-3"
                  >
                    <span className="text-primary w-14 font-semibold tabular-nums">{r.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.guestName}</span>
                      <span className="text-caption text-muted block">
                        {fmt(t.common.peopleShort, { n: r.partySize })} ·{" "}
                        {fmt(t.common.table, { n: r.table.number })}
                        {r.notes ? " · 📝" : ""}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </LocaleLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title={d.liveTables}
            description={d.liveHint}
            action={
              <LocaleLink href="/admin/dashboard/tables" className={cn(linkClasses, "text-sm")}>
                {d.manage}
              </LocaleLink>
            }
          />
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {tables.map((x) => (
              <li
                key={x.id}
                className="border-line bg-surface-raised rounded-md border p-2.5 text-center"
              >
                <p className="font-display text-primary text-xl font-bold">{x.number}</p>
                <LiveStateBadge state={x.liveState} compact />
                {x.next && x.liveState !== "OCCUPIED" && (
                  <p className="text-muted mt-1 text-[11px]">{x.next.time}</p>
                )}
              </li>
            ))}
          </ul>
          {tables.length === 0 && <Badge>{d.noTables}</Badge>}
        </Card>
      </div>
    </div>
  );
}
