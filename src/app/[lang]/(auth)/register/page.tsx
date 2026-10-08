import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterForm from "@/components/auth/RegisterForm";
import { Card } from "@/components/common/Card";
import { Skeleton } from "@/components/common/Loading";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.register };
}

export default async function RegisterPage() {
  const { t } = await getI18n();
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-h3 font-semibold">{t.auth.registerTitle}</h1>
      <p className="mt-1 mb-6 text-muted">{t.auth.registerLead}</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RegisterForm />
      </Suspense>
    </Card>
  );
}
