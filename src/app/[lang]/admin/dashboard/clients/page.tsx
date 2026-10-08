import type { Metadata } from "next";
import { Suspense } from "react";
import ClientManager from "@/components/admin/ClientManager";
import PageHeader from "@/components/admin/PageHeader";
import Loading from "@/components/common/Loading";
import Pagination from "@/components/common/Pagination";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { listClients } from "@/services/userService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.clients.title };
}

async function Clients({ searchParams }: { searchParams: PageProps<"/[lang]/admin/dashboard/clients">["searchParams"] }) {
  const [sp, { t, lang }] = await Promise.all([searchParams, getI18n()]);
  await requireAdmin(lang);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listClients({ q, page });
  return (
    <>
      <ClientManager
        clients={result.items.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          lastVisit: c.lastVisit?.toISOString() ?? null,
        }))}
      />
      <Pagination t={t} page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/dashboard/clients" params={{ q }} />
    </>
  );
}

export default async function ClientsPage(props: PageProps<"/[lang]/admin/dashboard/clients">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.admin.clients.title} description={t.admin.clients.lead} />
      <Suspense fallback={<Loading rows={4} label={t.common.loading} />}>
        <Clients searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
