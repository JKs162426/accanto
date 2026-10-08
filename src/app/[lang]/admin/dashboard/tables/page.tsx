import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import PageHeader from "@/components/admin/PageHeader";
import TableManager from "@/components/admin/TableManager";
import Loading from "@/components/common/Loading";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { listTablesWithState } from "@/services/tableService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.tables.title };
}

async function Tables() {
  await connection();
  const { lang } = await getI18n();
  await requireAdmin(lang);
  return <TableManager initialTables={await listTablesWithState()} />;
}

export default async function TablesPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.admin.tables.title} description={t.admin.tables.lead} />
      <Suspense fallback={<Loading rows={3} label={t.common.loading} />}>
        <Tables />
      </Suspense>
    </>
  );
}
