/**
 * Locale access for Server Components, via the `[lang]` root param — no prop
 * drilling. Not usable in Route Handlers (use `requestLocale` there).
 */
import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, localePath, type Locale } from "./index";

export async function getLang(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getI18n() {
  const locale = await getLang();
  return {
    lang: locale,
    t: getDictionary(locale),
    href: (path: string) => localePath(locale, path),
  };
}
