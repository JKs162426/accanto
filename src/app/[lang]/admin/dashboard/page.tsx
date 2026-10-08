import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Dashboard from "@/components/admin/Dashboard";
import PageHeader from "@/components/admin/PageHeader";
import { ButtonLink } from "@/components/common/Button";
import Loading from "@/components/common/Loading";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getDashboardSummary } from "@/services/reportService";
import { reservationsForDay, toReservationDTO } from "@/services/reservationService";
import { listTablesWithState } from "@/services/tableService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.dashboard.title };
}

async function DashboardContent() {
  await connection();
  const { lang } = await getI18n();
  const admin = await requireAdmin(lang);
  const summary = await getDashboardSummary();
  const [today, tables] = await Promise.all([reservationsForDay(summary.today), listTablesWithState()]);
  return (
    <Dashboard data={summary} todayReservations={today.map((r) => toReservationDTO(r, admin))} initialTables={tables} />
  );
}

export default async function DashboardPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader
        title={t.admin.dashboard.title}
        description={t.admin.dashboard.lead}
        actions={<ButtonLink href="/admin/dashboard/reservations?new=1">{t.admin.newReservation}</ButtonLink>}
      />
      <Suspense fallback={<Loading rows={4} label={t.common.loading} />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
