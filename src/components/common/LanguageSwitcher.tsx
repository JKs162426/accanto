"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/i18n/client";
import { localeNames, locales, splitLocale, type Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/helpers";

function Options({ hrefFor, tone }: { hrefFor: (l: Locale) => string; tone: "light" | "dark" }) {
  const { lang, t } = useI18n();
  return (
    <div className="flex items-center gap-0.5 font-ui text-caption font-semibold tracking-wider" role="group" aria-label={t.common.language}>
      {locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className={tone === "light" ? "text-cream/30" : "text-subtle"} aria-hidden>|</span>}
          {l === lang ? (
            <span
              aria-current="true"
              className={cn("rounded px-1.5 py-1 uppercase", tone === "light" ? "text-gold-light" : "text-primary")}
            >
              {l}
            </span>
          ) : (
            <Link
              href={hrefFor(l)}
              hrefLang={l}
              lang={l}
              title={fmt(t.common.switchTo, { language: localeNames[l] })}
              aria-label={fmt(t.common.switchTo, { language: localeNames[l] })}
              className={cn(
                "rounded px-1.5 py-1 uppercase transition-colors",
                tone === "light" ? "text-cream/60 hover:text-cream" : "text-muted hover:text-primary",
              )}
            >
              {l}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}

/** Reads the URL, so it sits behind Suspense (fallback links to each language's home). */
function CurrentPageOptions({ tone }: { tone: "light" | "dark" }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { path } = splitLocale(pathname);
  return <Options tone={tone} hrefFor={(l) => `/${l}${path === "/" ? "" : path}${search ? `?${search}` : ""}`} />;
}

/** IT | EN toggle: switches language and stays on the same page. */
export default function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Suspense fallback={<Options tone={tone} hrefFor={(l) => `/${l}`} />}>
      <CurrentPageOptions tone={tone} />
    </Suspense>
  );
}
