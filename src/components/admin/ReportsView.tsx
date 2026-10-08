"use client";

import { usePathname, useRouter } from "next/navigation";
import { buttonClasses, chipClasses } from "@/components/common/Button";
import { Card, CardHeader, StatCard } from "@/components/common/Card";
import LocaleLink from "@/components/common/LocaleLink";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { addDays, formatCurrency, formatDate, formatPercent } from "@/lib/helpers";
import type { Report } from "@/services/reportService";
import ReportsChart from "./ReportsChart";

/** Date range controls (one row, above the charts) + KPIs + charts + tables. */
export default function ReportsView({ report, today }: { report: Report; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useI18n();
  const r = t.admin.reports;
  const go = (from: string, to: string) => router.push(`${pathname}?from=${from}&to=${to}`);
  const monthStart = `${today.slice(0, 8)}01`;
  const presets = [
    { label: r.presets.d7, from: addDays(today, -6), to: today },
    { label: r.presets.d30, from: addDays(today, -29), to: today },
    { label: r.presets.month, from: monthStart, to: addDays(`${addDays(monthStart, 32).slice(0, 8)}01`, -1) },
    { label: r.presets.next30, from: today, to: addDays(today, 29) },
  ];
  const control = "rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none";
  const money = (n: number) => formatCurrency(n, lang);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => go(p.from, p.to)}
            aria-pressed={report.from === p.from && report.to === p.to}
            className={chipClasses(report.from === p.from && report.to === p.to)}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
        <label className="sr-only" htmlFor="from">{r.from}</label>
        <input id="from" type="date" value={report.from} max={report.to} onChange={(e) => e.target.value && go(e.target.value, report.to)} className={control} />
        <span className="text-muted">→</span>
        <label className="sr-only" htmlFor="to">{r.to}</label>
        <input id="to" type="date" value={report.to} min={report.from} onChange={(e) => e.target.value && go(report.from, e.target.value)} className={control} />
        {/* API route (no locale prefix): the language comes from the NEXT_LOCALE cookie. */}
        <a href={`/api/reports/export?from=${report.from}&to=${report.to}`} className={buttonClasses("secondary", "sm", "ml-auto")}>
          {r.export}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={r.occupancy} value={formatPercent(report.occupancy, lang)} hint={fmt(r.occupancyHint, { booked: report.bookedTurns, available: report.availableTurns })} />
        <StatCard label={r.revenue} value={money(report.revenueEstimated)} hint={fmt(r.revenueHint, { covers: report.coversAttended, spend: money(report.avgSpendPerGuest) })} />
        <StatCard label={r.cancellations} value={formatPercent(report.cancellationRate, lang)} hint={fmt(r.cancellationsHint, { n: report.byStatus.CANCELLED, total: report.total })} />
        <StatCard label={r.noShows} value={formatPercent(report.noShowRate, lang)} hint={fmt(r.noShowsHint, { n: report.byStatus.NO_SHOW })} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <ReportsChart
            title={r.byDay}
            description={t.admin.chart.excludesCancelled}
            data={report.byDay}
            formatLabel={(l) => l.slice(8)}
            formatTooltipLabel={(l) => formatDate(l, lang)}
          />
        </Card>
        <Card>
          <ReportsChart title={r.byHour} description={t.admin.chart.excludesCancelled} data={report.byHour} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title={r.frequent} description={r.frequentHint} />
          {report.frequentClients.length === 0 ? (
            <p className="text-sm text-muted">{r.noData}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-caption tracking-wide text-muted uppercase">
                <tr>
                  <th className="py-2 font-medium">{r.colClient}</th>
                  <th className="py-2 text-right font-medium">{r.colReservations}</th>
                  <th className="py-2 text-right font-medium">{r.colVisits}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.frequentClients.map((c) => (
                  <tr key={c.key}>
                    <td className="py-2">
                      {c.clientId ? (
                        <LocaleLink href={`/admin/dashboard/clients/${c.clientId}`} className="font-medium text-primary hover:underline">{c.name}</LocaleLink>
                      ) : (
                        <span className="font-medium">{c.name}</span>
                      )}
                      <span className="block text-caption text-muted">{c.email}{!c.clientId && r.noAccount}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{c.reservations}</td>
                    <td className="py-2 text-right tabular-nums">{c.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <CardHeader title={r.byStatus} />
          <dl className="divide-y divide-line text-sm">
            {([
              [r.statusConfirmed, report.byStatus.CONFIRMED],
              [r.statusAttended, report.byStatus.ATTENDED],
              [r.statusNoShow, report.byStatus.NO_SHOW],
              [r.statusCancelled, report.byStatus.CANCELLED],
              [r.total, report.total],
            ] as Array<[string, number]>).map(([label, value]) => (
              <div key={label} className="flex justify-between py-2"><dt className="text-muted">{label}</dt><dd className="tabular-nums">{value}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-caption text-muted">{fmt(r.footnote, { projected: money(report.revenueProjected) })}</p>
        </Card>
      </div>
    </div>
  );
}
