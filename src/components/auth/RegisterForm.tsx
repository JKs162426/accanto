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
import { registerSchema } from "@/lib/validation";
import { safeNext } from "./LoginForm";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, href } = useI18n();
  const { register } = useAuth();
  const { validate, clientErrors } = useZodForm();
  const { run, loading, error, fieldErrors } = useAsync(register);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = validate(registerSchema, Object.fromEntries(new FormData(e.currentTarget)));
    if (!data) return;
    const user = await run({ ...data, phone: data.phone ?? undefined });
    if (!user) return;
    router.push(safeNext(searchParams.get("next"), href("/reserve")));
    router.refresh();
  }

  const errors = { ...fieldErrors, ...clientErrors };
  const next = searchParams.get("next");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ErrorAlert>{error}</ErrorAlert>
      <Input label={t.auth.name} name="name" autoComplete="name" required error={errors.name} />
      <Input label={t.auth.email} name="email" type="email" autoComplete="email" required error={errors.email} />
      <Input label={t.auth.phoneOptional} name="phone" type="tel" autoComplete="tel" error={errors.phone} hint={t.auth.phoneHint} />
      <Input
        label={t.auth.password}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
        hint={t.auth.passwordHint}
      />
      <Button type="submit" loading={loading} className="w-full" size="lg">
        {t.auth.submitRegister}
      </Button>
      <p className="text-center text-body-sm text-muted">
        {t.auth.haveAccount}{" "}
        <LocaleLink href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className={linkClasses}>
          {t.auth.toLogin}
        </LocaleLink>
      </p>
    </form>
  );
}
