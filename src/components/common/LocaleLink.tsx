"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "@/i18n/client";

/**
 * next/link that prefixes app paths with the current locale:
 * <LocaleLink href="/reserve"> → /it/reserve or /en/reserve.
 * External URLs, mailto:, tel: and anchors are left untouched.
 */
export default function LocaleLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const { href: localize } = useI18n();
  return <Link href={typeof href === "string" ? localize(href) : href} {...rest} />;
}
