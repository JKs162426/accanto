"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Button, linkClasses } from "@/components/common/Button";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Input } from "@/components/common/Field";
import LocaleLink from "@/components/common/LocaleLink";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import { useI18n } from "@/i18n/client";
import { loginSchema } from "@/lib/validation";

/**
 * Only allow same-origin redirects after login (prevents open redirects via
 * ?next=). Resolving with URL catches tricks a prefix check misses, like
 * "/\\evil.com" or "/\tevil.com", which browsers treat as "//evil.com".
 */
export function safeNext(next: string | null, fallback: string, origin = window.location.origin): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export default function LoginForm({ adminOnly = false }: { adminOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, href } = useI18n();
  const { login } = useAuth();
  const { validate, clientErrors } = useZodForm();
  const { run, loading, error, fieldErrors } = useAsync(login);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = validate(loginSchema, Object.fromEntries(new FormData(e.currentTarget)));
    if (!data) return;
    const user = await run(data.email, data.password, adminOnly);
    if (!user) return;
    const fallback = href(user.role === "ADMIN" ? "/admin/dashboard" : "/my-reservations");
    router.push(safeNext(searchParams.get("next"), fallback));
    router.refresh();
  }

  const errors = { ...fieldErrors, ...clientErrors };
  const next = searchParams.get("next");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ErrorAlert>{error}</ErrorAlert>
      <Input label={t.auth.email} name="email" type="email" autoComplete="email" required error={errors.email} />
      <Input label={t.auth.password} name="password" type="password" autoComplete="current-password" required error={errors.password} />
      <Button type="submit" loading={loading} className="w-full" size="lg">
        {t.auth.submitLogin}
      </Button>
      {!adminOnly && (
        <p className="text-center text-body-sm text-muted">
          {t.auth.noAccount}{" "}
          <LocaleLink href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className={linkClasses}>
            {t.auth.toRegister}
          </LocaleLink>
        </p>
      )}
    </form>
  );
}
