"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import type { Dictionary } from "./dictionaries/it";
import { localePath, type Locale } from "./config";

interface I18nValue {
  lang: Locale;
  t: Dictionary;
  href: (path: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Provided once by the [lang] root layout; client components read it with useI18n(). */
export function I18nProvider({ lang, t, children }: { lang: Locale; t: Dictionary; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ lang, t, href: (path) => localePath(lang, path) }), [lang, t]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
