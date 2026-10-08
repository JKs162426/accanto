import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import LogoutButton from "@/components/auth/LogoutButton";
import LanguageSwitcher from "./LanguageSwitcher";
import LocaleLink from "./LocaleLink";
import Logo from "./Logo";
import Navigation from "./Navigation";
import { buttonClasses } from "./Button";
import { Skeleton } from "./Loading";

/** Reads the session, so it streams in behind the header's Suspense boundary. */
async function UserMenu() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getI18n()]);
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <LocaleLink href="/login" className={buttonClasses("inverse-ghost", "sm")}>
          {t.nav.login}
        </LocaleLink>
        <LocaleLink href="/register" className={buttonClasses("inverse", "sm")}>
          {t.nav.register}
        </LocaleLink>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {user.role === "ADMIN" && (
        <LocaleLink href="/admin/dashboard" className={buttonClasses("inverse", "sm")}>
          {t.nav.adminPanel}
        </LocaleLink>
      )}
      <LocaleLink href="/profile" className={buttonClasses("inverse-ghost", "sm")}>
        <span className="flex size-6 items-center justify-center rounded-full bg-gold text-caption font-semibold text-primary-strong">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-32 truncate">{user.name.split(" ")[0]}</span>
      </LocaleLink>
      <LogoutButton className={buttonClasses("inverse-ghost", "sm", "text-cream/70")}>{t.nav.logout}</LogoutButton>
    </div>
  );
}

export default async function Header() {
  const { t } = await getI18n();
  return (
    <header className="sticky top-0 z-30 border-b-2 border-gold/60 bg-primary text-cream shadow-card">
      <div className="relative mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <LocaleLink href="/" aria-label={t.nav.home}>
          <Logo tone="light" />
        </LocaleLink>
        <div className="flex items-center gap-2">
          <Navigation
            userSlot={
              <Suspense fallback={<Skeleton className="h-8 w-36 bg-white/10" />}>
                <UserMenu />
              </Suspense>
            }
          />
          <span className="hidden h-6 w-px bg-white/20 md:block" aria-hidden />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
