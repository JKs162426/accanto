"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { splitLocale } from "@/i18n/config";
import { cn } from "@/lib/helpers";
import LocaleLink from "./LocaleLink";

function Links({ path }: { path: string | null }) {
  const { t } = useI18n();
  const items = [
    { href: "/reserve", label: t.nav.reserve },
    { href: "/my-reservations", label: t.nav.myReservations },
  ];
  return items.map((l) => {
    const active = path !== null && (path === l.href || path.startsWith(`${l.href}/`));
    return (
      <LocaleLink
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10",
          active ? "font-semibold text-cream underline decoration-gold decoration-2 underline-offset-8" : "text-cream/80 hover:text-cream",
        )}
      >
        {l.label}
      </LocaleLink>
    );
  });
}

/** URL-dependent bits live behind Suspense so dynamic routes can still prerender the header. */
function ActiveLinks() {
  return <Links path={splitLocale(usePathname()).path} />;
}

function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(() => onNavigate(), [pathname, onNavigate]);
  return null;
}

/** Main site navigation with a collapsible menu on small screens. */
export default function Navigation({ userSlot }: { userSlot: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const links = (
    <Suspense fallback={<Links path={null} />}>
      <ActiveLinks />
    </Suspense>
  );

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label={t.nav.main}>
        {links}
        <div className="ml-3 border-l border-white/20 pl-3">{userSlot}</div>
      </nav>
      <button
        type="button"
        className="rounded-md p-2 text-cream hover:bg-white/10 md:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={closeMenu} />
      </Suspense>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full border-b-2 border-gold/60 bg-primary px-4 py-4 shadow-modal md:hidden">
          <nav className="flex flex-col gap-1" aria-label={t.nav.main}>
            {links}
          </nav>
          <div className="mt-3 border-t border-white/15 pt-3">{userSlot}</div>
        </div>
      )}
    </>
  );
}
