"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { useI18n } from "@/i18n/client";
import { useZodForm } from "@/hooks/useZodForm";
import { Button } from "@/components/common/Button";
import { Card, CardHeader } from "@/components/common/Card";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Checkbox, Input } from "@/components/common/Field";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/apiClient";
import { changePasswordSchema, profileSchema } from "@/lib/validation";

interface ProfileData {
  name: string;
  email: string;
  phone: string | null;
  remind24h: boolean;
  remind2h: boolean;
}

export default function ProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const { t } = useI18n();
  const { validate, clientErrors } = useZodForm();

  const save = useAsync(async (body: z.infer<typeof profileSchema>) => {
    await apiFetch("/api/users/me", { method: "PATCH", body });
    setSaved(true);
    router.refresh();
  });
  const changePw = useAsync(async (body: z.infer<typeof changePasswordSchema>) => {
    await apiFetch("/api/users/me/password", { method: "POST", body });
    setPwSaved(true);
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const data = validate(profileSchema, {
      name: fd.get("name"),
      phone: fd.get("phone"),
      remind24h: fd.get("remind24h") === "on",
      remind2h: fd.get("remind2h") === "on",
    });
    if (data) void save.run(data);
  }

  function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwSaved(false);
    const form = e.currentTarget;
    const data = validate(changePasswordSchema, Object.fromEntries(new FormData(form)));
    if (data) void changePw.run(data).then(() => form.reset());
  }

  const errors = { ...save.fieldErrors, ...changePw.fieldErrors, ...clientErrors };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t.profile.personal} />
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {saved && <ErrorAlert tone="success">{t.profile.saved}</ErrorAlert>}
          <ErrorAlert>{save.error}</ErrorAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t.profile.name} name="name" defaultValue={profile.name} autoComplete="name" error={errors.name} />
            <Input label={t.profile.phone} name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" error={errors.phone} />
            <Input label={t.profile.email} name="email" value={profile.email} disabled hint={t.profile.emailHint} fieldClassName="sm:col-span-2" readOnly />
          </div>
          <fieldset className="space-y-3 border-t border-line pt-4">
            <legend className="mb-2 text-sm font-medium">{t.profile.notifications}</legend>
            <Checkbox name="remind24h" defaultChecked={profile.remind24h} label={t.profile.remind24h} description={t.profile.remind24hHint} />
            <Checkbox name="remind2h" defaultChecked={profile.remind2h} label={t.profile.remind2h} description={t.profile.remind2hHint} />
            <p className="text-caption text-muted">{t.profile.alwaysSent}</p>
          </fieldset>
          <Button type="submit" loading={save.loading}>{t.common.save}</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={t.profile.password} />
        <form onSubmit={onPassword} noValidate className="space-y-4">
          {pwSaved && <ErrorAlert tone="success">{t.profile.passwordSaved}</ErrorAlert>}
          <ErrorAlert>{changePw.error}</ErrorAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t.profile.currentPassword} name="currentPassword" type="password" autoComplete="current-password" error={errors.currentPassword} />
            <Input label={t.profile.newPassword} name="newPassword" type="password" autoComplete="new-password" error={errors.newPassword} hint={t.auth.passwordHint} />
          </div>
          <Button type="submit" variant="secondary" loading={changePw.loading}>{t.profile.changePassword}</Button>
        </form>
      </Card>
    </div>
  );
}
