"use client";

import LocaleLink from "./LocaleLink";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { splitLocale } from "@/i18n/config";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { cn } from "@/lib/helpers";
import Logo from "./Logo";

const ITEMS = [
  { href: "/admin/dashboard", key: "overview", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/admin/dashboard/reservations", key: "reservations", icon: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" },
  { href: "/admin/dashboard/tables", key: "tables", icon: "M4 9h16M6 9v10M18 9v10M8 5h8" },
  { href: "/admin/dashboard/clients", key: "clients", icon: "M16 19v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 10a3 3 0 100-6 3 3 0 000 6zM20 19v-1a4 4 0 00-3-3.87M16 4.13a3 3 0 010 5.74" },
  { href: "/admin/dashboard/reports", key: "reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/admin/dashboard/settings", key: "settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
] as const;

function Links({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-1" aria-label={t.admin.nav.label}>
      {ITEMS.map((item) => {
        const active =
          pathname !== null &&
          (item.href === "/admin/dashboard" ? pathname === item.href : pathname.startsWith(item.href));
        return (
          <LocaleLink
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-gold bg-white/10 font-semibold text-cream"
                : "border-transparent text-cream/75 hover:bg-white/5 hover:text-cream",
            )}
          >
            <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={item.icon} />
            </svg>
            {t.admin.nav[item.key]}
          </LocaleLink>
        );
      })}
    </nav>
  );
}

/** Reads the URL, so it sits behind Suspense (dynamic [id] routes resolve it at request time). */
function ActiveLinks({ onNavigate }: { onNavigate: () => void }) {
  return <Links pathname={splitLocale(usePathname()).path} onNavigate={onNavigate} />;
}

/** Admin navigation: fixed column on desktop, slide-over on mobile. */
export default function Sidebar({ footer }: { footer?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const nav = (
    <Suspense fallback={<Links pathname={null} onNavigate={close} />}>
      <ActiveLinks onNavigate={close} />
    </Suspense>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-gold/60 bg-primary px-4 text-cream lg:hidden">
        <LocaleLink href="/admin/dashboard"><Logo tone="light" /></LocaleLink>
        <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 hover:bg-white/10"
          aria-label={t.nav.openMenu}
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-soft-black/50" aria-label={t.nav.closeMenu} onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-primary p-4 shadow-modal">
            <Logo tone="light" />
            {nav}
            <div className="mt-auto">{footer}</div>
          </aside>
        </div>
      )}
      {/* Desktop column */}
      {/* The column stretches with the page; the content inside stays pinned. */}
      <div className="hidden w-64 shrink-0 bg-primary lg:block">
        <aside className="sticky top-0 flex h-screen flex-col gap-8 p-5 text-cream">
          <LocaleLink href="/admin/dashboard"><Logo tone="light" /></LocaleLink>
          {nav}
          <div className="mt-auto space-y-4">
            <LanguageSwitcher />
            {footer}
          </div>
        </aside>
      </div>
    </>
  );
}
