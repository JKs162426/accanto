import type { Metadata } from "next";
import { Suspense } from "react";
import Loading from "@/components/common/Loading";
import ReserveFlow from "@/components/reservations/ReserveFlow";
import { getI18n } from "@/i18n/server";
import { getCachedRestaurant } from "@/services/restaurantService";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.reserve.title };
}

async function Flow() {
  const restaurant = await getCachedRestaurant();
  return <ReserveFlow restaurant={restaurant} />;
}

export default async function ReservePage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[34px] leading-tight sm:text-h2">{t.reserve.title}</h1>
      <p className="mt-2 mb-8 text-body-lg text-muted">{t.reserve.lead}</p>
      <Suspense fallback={<Loading rows={3} label={t.common.loading} />}>
        <Flow />
      </Suspense>
    </div>
  );
}
