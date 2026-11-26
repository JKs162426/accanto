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
      <p className="text-muted mt-1 mb-6">{t.auth.loginLead}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LoginForm />
      </Suspense>
      {SHOW_DEMO_CREDENTIALS && (
        <p className="bg-surface-raised font-ui text-caption text-muted mt-6 rounded-md px-4 py-3">
          {t.auth.demo} <code>client1@accanto.local</code> / <code>ClientPass123!</code>
        </p>
      )}
    </Card>
  );
}
