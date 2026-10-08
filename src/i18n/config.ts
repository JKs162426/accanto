/**
 * Locale configuration. Framework-free so it can be imported anywhere
 * (proxy, server, client, tests).
 *
 * Italian is the primary language; English is the alternative, switchable
 * from the header. Routes live under /it/... and /en/...
 */
export const locales = ["it", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "it";

/** Cookie that remembers the visitor's last chosen language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function hasLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** BCP 47 tag used for Intl formatting (dates, currency, numbers). */
export const intlLocale: Record<Locale, string> = { it: "it-IT", en: "en-GB" };

export const localeNames: Record<Locale, string> = { it: "Italiano", en: "English" };

/** Prefix an app path with the locale: ("en", "/reserve") → "/en/reserve". */
export function localePath(locale: Locale, path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  // API routes are not localized.
  if (clean.startsWith("/api/")) return clean;
  // Idempotent: a path that already carries a locale is returned as is.
  if (splitLocale(clean.split(/[?#]/)[0]).locale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Split "/en/reserve?x=1" into { locale: "en", path: "/reserve?x=1" }. */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (hasLocale(first)) return { locale: first, path: `/${rest.join("/")}` };
  return { locale: null, path: pathname };
}
