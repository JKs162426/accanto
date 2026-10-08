import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusBadge } from "@/components/common/Badge";
import { linkClasses } from "@/components/common/Button";
import { Card, CardHeader, StatCard } from "@/components/common/Card";
import Loading from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import ProfileForm from "@/components/profile/ProfileForm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, formatDate, formatMonthYear, fromDbDate } from "@/lib/helpers";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { listReservations } from "@/services/reservationService";
import { getProfile } from "@/services/userService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.profile.title };
}

async function Profile() {
  const { t, lang } = await getI18n();
  const user = await requireUser(lang, "/profile");
  const [profile, history, stats] = await Promise.all([
    getProfile(user.id),
    listReservations({ scope: "past", pageSize: 5 }, user),
    db.reservation.groupBy({ by: ["status"], where: { clientId: user.id }, _count: { _all: true } }),
  ]);
  const count = (s: string) => stats.find((x) => x.status === s)?._count._all ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ProfileForm profile={profile} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t.profile.visits} value={count("ATTENDED")} />
          <StatCard label={t.profile.upcoming} value={count("CONFIRMED")} />
        </div>
        <Card>
          <CardHeader
            title={t.profile.history}
            action={<LocaleLink href="/my-reservations?tab=past" className={cn(linkClasses, "text-sm")}>{t.profile.seeAll}</LocaleLink>}
          />
          {history.items.length === 0 ? (
            <p className="text-sm text-muted">{t.profile.noHistory}</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.items.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <LocaleLink href={`/my-reservations/${r.id}`} className="hover:text-primary">
                    {formatDate(fromDbDate(r.date), lang, "short")} · {r.time}
                  </LocaleLink>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="font-ui text-caption text-muted">{fmt(t.profile.memberSince, { date: formatMonthYear(profile.createdAt, lang) })}</p>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const { t } = await getI18n();
  return (
    <>
      <h1 className="mb-8 text-[34px] leading-tight sm:text-h2">{t.profile.title}</h1>
      <Suspense fallback={<Loading rows={3} label={t.common.loading} />}>
        <Profile />
      </Suspense>
    </>
  );
}
