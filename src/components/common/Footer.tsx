import { getI18n } from "@/i18n/server";
import LocaleLink from "./LocaleLink";
import Logo from "./Logo";

export default async function Footer() {
  const { t } = await getI18n();
  const link = "font-ui hover:text-gold-light";
  return (
    <footer className="mt-auto border-t-2 border-gold/60 bg-primary text-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-body-sm text-cream/80 sm:grid-cols-3 sm:px-6">
        <div className="space-y-2">
          <Logo tone="light" />
          <p className="font-display text-lg text-cream/90 italic">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-col gap-1.5" aria-label={t.footer.nav}>
          <LocaleLink href="/reserve" className={link}>{t.footer.bookTable}</LocaleLink>
          <LocaleLink href="/my-reservations" className={link}>{t.nav.myReservations}</LocaleLink>
          <LocaleLink href="/profile" className={link}>{t.nav.profile}</LocaleLink>
        </nav>
        <p className="sm:text-right">
          {t.footer.portfolio}
          <br />
          <LocaleLink href="/admin/login" className={link}>{t.footer.adminAccess}</LocaleLink>
        </p>
      </div>
    </footer>
  );
}
