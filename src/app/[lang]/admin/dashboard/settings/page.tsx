import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/admin/PageHeader";
import SettingsForm from "@/components/admin/SettingsForm";
import Loading from "@/components/common/Loading";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getRestaurant, toRestaurantDTO } from "@/services/restaurantService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.settings.title };
}

async function Settings() {
  const { lang } = await getI18n();
  await requireAdmin(lang);
  return <SettingsForm restaurant={toRestaurantDTO(await getRestaurant())} />;
}

export default async function SettingsPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.admin.settings.title} description={t.admin.settings.lead} />
      <Suspense fallback={<Loading rows={4} label={t.common.loading} />}>
        <Settings />
      </Suspense>
    </>
  );
}
