import type { Metadata } from "next";
import LogoutButton from "@/components/auth/LogoutButton";
import { ButtonLink, buttonClasses } from "@/components/common/Button";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.unauthorizedTitle };
}

export default async function UnauthorizedPage() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="font-display text-accent-text text-7xl font-bold">403</p>
      <h1 className="text-h3">{t.auth.unauthorizedTitle}</h1>
      <p className="text-body-lg text-muted max-w-sm">{t.auth.unauthorizedText}</p>
      <div className="flex gap-2">
        <ButtonLink href="/">{t.auth.goToSite}</ButtonLink>
        <LogoutButton className={buttonClasses("secondary")}>{t.auth.switchAccount}</LogoutButton>
      </div>
    </main>
  );
}
