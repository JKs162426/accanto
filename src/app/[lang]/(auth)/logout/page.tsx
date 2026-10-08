import type { Metadata } from "next";
import LogoutButton from "@/components/auth/LogoutButton";
import { ButtonLink, buttonClasses } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.logout };
}

/**
 * Explicit confirmation: visiting this URL never signs you out by itself, so
 * a link on another site can't log users out (logout CSRF).
 */
export default async function LogoutPage() {
  const { t } = await getI18n();
  return (
    <Card className="p-6 text-center sm:p-8">
      <h1 className="text-h3">{t.auth.logoutTitle}</h1>
      <p className="mt-2 mb-6 text-muted">{t.auth.logoutText}</p>
      <div className="flex justify-center gap-2">
        <LogoutButton className={buttonClasses("primary")}>{t.nav.logout}</LogoutButton>
        <ButtonLink href="/" variant="secondary">{t.common.cancel}</ButtonLink>
      </div>
    </Card>
  );
}
