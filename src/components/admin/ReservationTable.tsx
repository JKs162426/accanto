"use client";

import LocaleLink from "@/components/common/LocaleLink";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StatusBadge } from "@/components/common/Badge";
import { Button, chipClasses } from "@/components/common/Button";
import { EmptyState } from "@/components/common/Card";
import Modal from "@/components/common/Modal";
import { cn, formatDate, timeToMinutes } from "@/lib/helpers";
import type { ReservationDTO, TableDTO } from "@/types";
import AdminReservationForm from "./AdminReservationForm";

const control = "rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none";

/** Filter bar: every filter lives in the URL so views are linkable. */
function Filters() {
  const { t } = useI18n();
  const a = t.admin.reservations;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`${pathname}?${next}`);
  }

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={onSearch} className="flex min-w-0 flex-1 gap-2 sm:flex-none" role="search">
        <label htmlFor="q" className="sr-only">{a.searchLabel}</label>
        <input id="q" name="q" defaultValue={sp.get("q") ?? ""} placeholder={a.searchPlaceholder} className={cn(control, "min-w-0 flex-1 sm:w-72")} />
        <Button type="submit" variant="secondary">{t.common.search}</Button>
      </form>
      <label className="sr-only" htmlFor="f-date">{a.dateLabel}</label>
      <input id="f-date" type="date" value={sp.get("date") ?? ""} onChange={(e) => apply({ date: e.target.value })} className={control} />
      <label className="sr-only" htmlFor="f-status">{a.statusLabel}</label>
      <select id="f-status" value={sp.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} className={control}>
        <option value="">{a.allStatuses}</option>
        {Object.entries(t.enums.reservationStatus).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-scope">{a.scopeLabel}</label>
      <select id="f-scope" value={sp.get("scope") ?? "upcoming"} onChange={(e) => apply({ scope: e.target.value })} className={control} disabled={Boolean(sp.get("date"))}>
        <option value="upcoming">{a.scopeUpcoming}</option>
        <option value="past">{a.scopePast}</option>
        <option value="all">{a.scopeAll}</option>
      </select>
      {(sp.get("q") || sp.get("date") || sp.get("status")) && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>{t.common.clear}</Button>
      )}
    </div>
  );
}

/** Day agenda: one row per table, reservations as blocks across the service hours. */
function DayView({
  date,
  reservations,
  tables,
  range,
}: {
  date: string;
  reservations: ReservationDTO[];
  tables: Pick<TableDTO, "id" | "number" | "capacity">[];
  range: { start: string; end: string } | null;
}) {
  const { t, lang } = useI18n();
  if (!range) return <EmptyState title={t.admin.reservations.closedDay} />;
  const start = timeToMinutes(range.start);
  const span = timeToMinutes(range.end) - start;
  const hours: number[] = [];
  for (let m = Math.ceil(start / 60) * 60; m <= start + span; m += 60) hours.push(m);
  const pct = (m: number) => `${((m - start) / span) * 100}%`;

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
      <div className="min-w-[44rem] p-5">
        <p className="mb-3 font-display text-h4 font-semibold text-primary first-letter:uppercase">{formatDate(date, lang)}</p>
        <div className="relative ml-16 h-5 text-[11px] text-muted">
          {hours.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>{String(m / 60).padStart(2, "0")}:00</span>
          ))}
        </div>
        <ul className="space-y-1.5">
          {tables.map((table) => (
            <li key={table.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-sm">
                <span className="font-semibold text-primary">{fmt(t.common.tableShort, { n: table.number })}</span>{" "}
                <span className="text-caption text-muted">·{table.capacity}</span>
              </span>
              <div className="relative h-9 flex-1 rounded-md bg-surface-raised">
                {hours.map((m) => <span key={m} className="absolute inset-y-0 w-px bg-grid" style={{ left: pct(m) }} aria-hidden />)}
                {reservations.filter((r) => r.table.id === table.id).map((r) => {
                  const s = timeToMinutes(r.time);
                  const dur = (new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime()) / 60000;
                  return (
                    <LocaleLink
                      key={r.id}
                      href={`/admin/dashboard/reservations/${r.id}`}
                      title={`${r.time} · ${r.guestName} (${r.partySize}) · ${t.enums.reservationStatus[r.status]}`}
                      className={cn(
                        "absolute inset-y-0.5 flex items-center overflow-hidden rounded-md border-x-2 border-surface px-2 text-caption whitespace-nowrap",
                        r.status === "ATTENDED" ? "bg-info-soft text-info" : r.status === "NO_SHOW" ? "bg-warning-soft text-warning" : "bg-success-soft text-success",
                      )}
                      style={{ left: pct(s), width: `${(Math.min(dur, start + span - s) / span) * 100}%` }}
                    >
                      <span className="font-semibold">{r.time}</span>&nbsp;{r.guestName.split(" ")[0]} ({r.partySize})
                    </LocaleLink>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ReservationTable({
  reservations,
  view,
  day,
  defaultDate,
  openNew,
}: {
  reservations: ReservationDTO[];
  view: "table" | "day";
  day: { date: string; reservations: ReservationDTO[]; tables: Pick<TableDTO, "id" | "number" | "capacity">[]; range: { start: string; end: string } | null } | null;
  defaultDate: string;
  openNew: boolean;
}) {
  const { t, lang, href } = useI18n();
  const a = t.admin.reservations;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [creating, setCreating] = useState(openNew);

  const setView = (v: "table" | "day") => {
    const next = new URLSearchParams(sp);
    next.set("view", v);
    if (v === "day" && !next.get("date")) next.set("date", defaultDate);
    router.push(`${pathname}?${next}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1" role="group" aria-label={a.view}>
          {(["table", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={chipClasses(view === v, "px-4")}
            >
              {v === "table" ? a.list : a.agenda}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreating(true)}>{t.admin.newReservation}</Button>
      </div>
      <Filters />

      {view === "day" && day ? (
        <DayView {...day} />
      ) : reservations.length === 0 ? (
        <EmptyState title={a.empty} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-line bg-beige-light text-left text-caption tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">{a.colDate}</th>
                <th className="px-4 py-3 font-medium">{a.colClient}</th>
                <th className="px-4 py-3 text-right font-medium">{a.colPeople}</th>
                <th className="px-4 py-3 font-medium">{a.colTable}</th>
                <th className="px-4 py-3 font-medium">{a.colCode}</th>
                <th className="px-4 py-3 font-medium">{a.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reservations.map((r) => (
                <tr key={r.id} className="cursor-pointer bg-surface-raised hover:bg-primary-soft/50" onClick={() => router.push(href(`/admin/dashboard/reservations/${r.id}`))}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LocaleLink href={`/admin/dashboard/reservations/${r.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {formatDate(r.date, lang, "short")}
                    </LocaleLink>
                    <span className="ml-2 text-muted tabular-nums">{r.time}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{r.guestName}</span>
                    <span className="block text-caption text-muted">{r.guestEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.partySize}</td>
                  <td className="px-4 py-3">{r.table.number}</td>
                  <td className="px-4 py-3 font-mono text-caption">{r.code}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={t.admin.newReservation} size="lg">
        <AdminReservationForm
          defaultDate={sp.get("date") ?? defaultDate}
          onCreated={(r) => {
            setCreating(false);
            router.push(href(`/admin/dashboard/reservations/${r.id}`));
          }}
        />
      </Modal>
    </div>
  );
}
