import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/admin/PageHeader";
import ReportsView from "@/components/admin/ReportsView";
import Loading from "@/components/common/Loading";
import { requireAdmin } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/helpers";
import { reportQuerySchema } from "@/lib/validation";
import { getI18n } from "@/i18n/server";
import { getReport } from "@/services/reportService";
import { getRestaurant } from "@/services/restaurantService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.reports.title };
}

async function Reports({ searchParams }: { searchParams: PageProps<"/[lang]/admin/dashboard/reports">["searchParams"] }) {
  const { lang } = await getI18n();
  await requireAdmin(lang);
  const [sp, restaurant] = await Promise.all([searchParams, getRestaurant()]);
  const today = todayIn(restaurant.timezone);
  const parsed = reportQuerySchema.safeParse(sp);
  let { from, to } = parsed.success ? parsed.data : { from: addDays(today, -29), to: today };
  if (from > to) [from, to] = [to, from];
  // Keep reports to at most a year so the in-memory aggregation stays cheap.
  if (addDays(from, 366) < to) from = addDays(to, -366);
  return <ReportsView report={await getReport(from, to)} today={today} />;
}

export default async function ReportsPage(props: PageProps<"/[lang]/admin/dashboard/reports">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.admin.reports.title} description={t.admin.reports.lead} />
      <Suspense fallback={<Loading rows={4} label={t.common.loading} />}>
        <Reports searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
