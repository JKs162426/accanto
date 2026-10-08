/**
 * Dictionaries + translation helpers usable anywhere on the server (pages,
 * route handlers, services, email rendering). Both dictionaries are small,
 * so they are imported statically.
 */
import en from "./dictionaries/en";
import it, { type Dictionary } from "./dictionaries/it";
import { defaultLocale, hasLocale, type Locale } from "./config";

export type { Dictionary };
export * from "./config";
export * from "./format";
export * from "./translate";

const dictionaries: Record<Locale, Dictionary> = { it, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/** Locale of an API request: x-locale header (set by apiFetch) → cookie → default. */
export function requestLocale(request: Request): Locale {
  const header = request.headers.get("x-locale");
  if (hasLocale(header)) return header;
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=(\w+)/)?.[1];
  return hasLocale(cookie) ? cookie : defaultLocale;
}
