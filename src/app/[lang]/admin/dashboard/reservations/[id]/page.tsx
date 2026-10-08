import type { Metadata } from "next";
import { Suspense } from "react";
import AdminReservationEditor from "@/components/admin/AdminReservationEditor";
import PageHeader from "@/components/admin/PageHeader";
import { Card, CardHeader } from "@/components/common/Card";
import Loading from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import { requireAdmin } from "@/lib/auth";
import { orNotFound } from "@/lib/pages";
import { formatDate, formatDateTime, tableTags } from "@/lib/helpers";
import { plural, type Dictionary } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { getReservation, getReservationHistory, toReservationDTO } from "@/services/reservationService";
import { getRestaurant } from "@/services/restaurantService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.reservations.title };
}

/** Human summary of a history entry's JSON diff, in the admin's language. */
function describe(t: Dictionary, changes: unknown): string {
  if (!changes || typeof changes !== "object") return "";
  const labels = t.admin.reservations.fields as Record<string, string>;
  const statuses = t.enums.reservationStatus as Record<string, string>;
  return Object.entries(changes as Record<string, unknown>)
    .map(([k, v]) => {
      if (v && typeof v === "object" && "from" in v && "to" in v) {
        const show = (x: unknown) => (k === "status" ? (statuses[String(x)] ?? String(x)) : (x ?? t.common.none) as string);
        return `${labels[k] ?? k}: ${show((v as { from: unknown }).from)} → ${show((v as { to: unknown }).to)}`;
      }
      return k === "by" ? "" : `${labels[k] ?? k}: ${String(v)}`;
    })
    .filter(Boolean)
    .join(" · ");
}

async function Detail({ params }: { params: PageProps<"/[lang]/admin/dashboard/reservations/[id]">["params"] }) {
  const [{ id }, { t, lang }] = await Promise.all([params, getI18n()]);
  const a = t.admin.reservations;
  const admin = await requireAdmin(lang);
  const [raw, history, restaurant] = await Promise.all([orNotFound(getReservation(id, admin)), getReservationHistory(id), getRestaurant()]);
  const r = toReservationDTO(raw, admin);

  return (
    <>
      <PageHeader title={r.guestName} description={<span className="font-mono tracking-wider">{r.code}</span>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <AdminReservationEditor reservation={r} />
        <div className="space-y-6">
          <Card>
            <CardHeader title={a.details} />
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted">{t.reserve.when}</dt><dd className="first-letter:uppercase">{formatDate(r.date, lang)} · {r.time}</dd></div>
              <div><dt className="text-muted">{t.reserve.people}</dt><dd>{plural(r.partySize, t.common.people)}</dd></div>
              <div><dt className="text-muted">{t.reserve.table}</dt><dd>{r.table.number} · {tableTags(t, r.table).join(", ")}</dd></div>
              <div>
                <dt className="text-muted">{a.contact}</dt>
                <dd><a href={`mailto:${r.guestEmail}`} className="hover:text-primary hover:underline">{r.guestEmail}</a></dd>
                {r.guestPhone && <dd><a href={`tel:${r.guestPhone.replace(/\s/g, "")}`} className="hover:text-primary hover:underline">{r.guestPhone}</a></dd>}
              </div>
              {r.notes && <div><dt className="text-muted">{a.clientRequests}</dt><dd className="mt-1 rounded-md border-l-2 border-gold bg-surface-raised px-3 py-2">{r.notes}</dd></div>}
              {r.clientId && (
                <div>
                  <dt className="text-muted">{a.registeredClient}</dt>
                  <dd><LocaleLink href={`/admin/dashboard/clients/${r.clientId}`} className="font-medium text-primary hover:underline">{a.viewClient}</LocaleLink></dd>
                </div>
              )}
            </dl>
          </Card>
          <Card>
            <CardHeader title={a.history} />
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-gold ring-2 ring-surface" aria-hidden />
                  <p className="font-medium">{a.actions[h.action]}</p>
                  <p className="text-caption text-muted">
                    {formatDateTime(h.timestamp, restaurant.timezone, lang)} ·{" "}
                    {h.actor ? `${h.actor.name}${h.actor.role === "ADMIN" ? a.adminSuffix : ""}` : a.system}
                  </p>
                  {h.action !== "CREATED" && describe(t, h.changes) && <p className="mt-0.5 text-caption">{describe(t, h.changes)}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

export default async function AdminReservationPage(props: PageProps<"/[lang]/admin/dashboard/reservations/[id]">) {
  const { t } = await getI18n();
  return (
    <>
      <LocaleLink href="/admin/dashboard/reservations" className="mb-2 inline-block text-sm text-muted hover:text-primary">{t.admin.reservations.back}</LocaleLink>
      <Suspense fallback={<Loading rows={3} label={t.common.loading} />}>
        <Detail params={props.params} />
      </Suspense>
    </>
  );
}
