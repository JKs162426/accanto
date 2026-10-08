import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import { Card } from "@/components/common/Card";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { Skeleton } from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import Logo from "@/components/common/Logo";
import { getI18n } from "@/i18n/server";
import { SHOW_DEMO_CREDENTIALS } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.login };
}

export default async function AdminLoginPage() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <LanguageSwitcher tone="dark" />
        </div>
        <Card className="p-6 sm:p-8">
          <h1 className="text-h3">{t.auth.adminTitle}</h1>
          <p className="mt-1 mb-6 text-muted">{t.auth.adminLead}</p>
          <Suspense fallback={<Skeleton className="h-56" />}>
            <LoginForm adminOnly />
          </Suspense>
          {SHOW_DEMO_CREDENTIALS && (
            <p className="mt-6 rounded-md bg-surface-raised px-4 py-3 font-ui text-caption text-muted">
              {t.auth.demo} <code>admin@accanto.local</code> / <code>AdminPass123!</code>
            </p>
          )}
        </Card>
        <p className="mt-4 text-center text-sm">
          <LocaleLink href="/" className="font-ui text-muted hover:text-primary">{t.auth.backToSite}</LocaleLink>
        </p>
      </div>
    </main>
  );
}
