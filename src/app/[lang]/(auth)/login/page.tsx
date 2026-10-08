import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import { Card } from "@/components/common/Card";
import { Skeleton } from "@/components/common/Loading";
import { getI18n } from "@/i18n/server";
import { SHOW_DEMO_CREDENTIALS } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.login };
}

export default async function LoginPage() {
  const { t } = await getI18n();
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-h3 font-semibold">{t.auth.loginTitle}</h1>
      <p className="mt-1 mb-6 text-muted">{t.auth.loginLead}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LoginForm />
      </Suspense>
      {SHOW_DEMO_CREDENTIALS && (
        <p className="mt-6 rounded-md bg-surface-raised px-4 py-3 font-ui text-caption text-muted">
          {t.auth.demo} <code>client1@accanto.local</code> / <code>ClientPass123!</code>
        </p>
      )}
    </Card>
  );
}
