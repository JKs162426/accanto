"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/common/Button";
import { Card, CardHeader } from "@/components/common/Card";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Input, Textarea } from "@/components/common/Field";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/apiClient";
import { formatDate } from "@/lib/helpers";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { RestaurantDTO } from "@/services/restaurantService";
import type { ShiftName } from "@/types/database";

type Hours = RestaurantDTO["openingHours"];
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const SHIFTS: ShiftName[] = ["LUNCH", "DINNER"];
const DEFAULTS: Record<ShiftName, [string, string]> = { LUNCH: ["12:00", "15:00"], DINNER: ["18:00", "23:00"] };

/** Weekly schedule grid: each day × shift can be toggled and timed. */
function ScheduleEditor({ hours, onChange }: { hours: Hours; onChange: (h: Hours) => void }) {
  const { t } = useI18n();
  const day = (d: number) => t.enums.weekdays[d];
  const shift = (s: ShiftName) => t.enums.shift[s];
  const find = (d: number, s: ShiftName) => hours.find((h) => h.dayOfWeek === d && h.shift === s);
  const set = (d: number, s: ShiftName, patch: Partial<Hours[number]> | null) => {
    const rest = hours.filter((h) => !(h.dayOfWeek === d && h.shift === s));
    if (patch === null) return onChange(rest);
    const current = find(d, s) ?? { dayOfWeek: d, shift: s, opensAt: DEFAULTS[s][0], closesAt: DEFAULTS[s][1] };
    onChange([...rest, { ...current, ...patch }]);
  };
  const timeInput = "w-24 rounded-md border border-line bg-surface-raised px-2 py-1 text-sm tabular-nums focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none";

  return (
    <div className="divide-y divide-line">
      {DAYS.map((d) => (
        <div key={d} className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr_1fr] sm:items-center">
          <p className="font-medium text-primary">{day(d)}</p>
          {SHIFTS.map((s) => {
            const h = find(d, s);
            return (
              <div key={s} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-24 items-center gap-2">
                  <input type="checkbox" checked={Boolean(h)} onChange={(e) => set(d, s, e.target.checked ? {} : null)} className="size-4 accent-[var(--primary)]" />
                  {shift(s)}
                </label>
                {h && (
                  <>
                    <input type="time" aria-label={fmt(t.admin.settings.opensAt, { day: day(d), shift: shift(s) })} value={h.opensAt} step={900} onChange={(e) => set(d, s, { opensAt: e.target.value })} className={timeInput} />
                    <span className="text-muted">–</span>
                    <input type="time" aria-label={fmt(t.admin.settings.closesAt, { day: day(d), shift: shift(s) })} value={h.closesAt} step={900} onChange={(e) => set(d, s, { closesAt: e.target.value })} className={timeInput} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function SettingsForm({ restaurant }: { restaurant: RestaurantDTO }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const st = t.admin.settings;
  const [hours, setHours] = useState<Hours>(restaurant.openingHours);
  const [saved, setSaved] = useState(false);
  const [workerResult, setWorkerResult] = useState<string | null>(null);

  const save = useAsync(async (body: Record<string, unknown>) => {
    await apiFetch("/api/restaurant", { method: "PATCH", body });
    setSaved(true);
    router.refresh();
  });
  const addClosed = useAsync(async (body: { date: string; reason: string }) => {
    await apiFetch("/api/restaurant/closed-dates", { method: "POST", body: { ...body, reason: body.reason || null } });
    router.refresh();
  });
  const removeClosed = useAsync(async (id: string) => {
    await apiFetch(`/api/restaurant/closed-dates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  });
  const runWorker = useAsync(async () => {
    const res = await apiFetch<{ reminders: { reminders24h: number; reminders2h: number }; delivery: { sent: number; failed: number } }>("/api/emails", { method: "POST" });
    setWorkerResult(fmt(st.workerResult, { reminders: res.reminders.reminders24h + res.reminders.reminders2h, sent: res.delivery.sent, failed: res.delivery.failed }));
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    void save.run({ ...fd, openingHours: hours });
  }

  const err = save.fieldErrors;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {saved && <ErrorAlert tone="success">{st.saved}</ErrorAlert>}
        <ErrorAlert>{save.error}</ErrorAlert>

        <Card>
          <CardHeader title={st.restaurant} description={st.restaurantHint} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={st.name} name="name" defaultValue={restaurant.name} error={err.name} />
            <Input label={st.phone} name="phone" defaultValue={restaurant.phone ?? ""} error={err.phone} />
            <Input label={st.email} name="email" type="email" defaultValue={restaurant.email ?? ""} error={err.email} />
            <Input label={st.address} name="address" defaultValue={restaurant.address ?? ""} error={err.address} />
            <Textarea label={st.description} name="description" defaultValue={restaurant.description ?? ""} fieldClassName="sm:col-span-2" error={err.description} />
          </div>
        </Card>

        <Card>
          <CardHeader title={st.rules} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={st.turnover} name="turnoverMinutes" type="number" min={30} max={360} step={15} defaultValue={restaurant.turnoverMinutes} error={err.turnoverMinutes} hint={st.turnoverHint} />
            <Input label={st.interval} name="slotIntervalMinutes" type="number" step={15} min={15} max={60} defaultValue={restaurant.slotIntervalMinutes} error={err.slotIntervalMinutes} hint={st.intervalHint} />
            <Input label={st.window} name="bookingWindowDays" type="number" min={1} max={365} defaultValue={restaurant.bookingWindowDays} error={err.bookingWindowDays} />
            <Input label={st.maxParty} name="maxPartySize" type="number" min={1} max={30} defaultValue={restaurant.maxPartySize} error={err.maxPartySize} />
            <Input label={st.avgSpend} name="avgSpendPerGuest" type="number" min={0} step={0.5} defaultValue={restaurant.avgSpendPerGuest} error={err.avgSpendPerGuest} hint={st.avgSpendHint} />
            <Input label={st.timezone} name="timezone" defaultValue={restaurant.timezone} error={err.timezone} hint={st.timezoneHint} />
          </div>
        </Card>

        <Card>
          <CardHeader title={st.weekly} description={st.weeklyHint} />
          <ScheduleEditor hours={hours} onChange={setHours} />
          {err.openingHours && <p className="mt-2 text-caption text-danger">{err.openingHours[0]}</p>}
        </Card>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button type="submit" size="lg" loading={save.loading} className="shadow-modal">{st.saveAll}</Button>
        </div>
      </form>

      <Card>
        <CardHeader title={st.closedDays} description={st.closedDaysHint} />
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            void addClosed.run({ date: String(fd.get("date")), reason: String(fd.get("reason") ?? "") }).then(() => form.reset());
          }}
        >
          <Input label={st.date} name="date" type="date" required fieldClassName="w-44" error={addClosed.fieldErrors.date} />
          <Input label={st.reason} name="reason" placeholder={st.reasonPlaceholder} fieldClassName="min-w-48 flex-1" />
          <Button type="submit" variant="secondary" loading={addClosed.loading}>{t.common.add}</Button>
        </form>
        <ErrorAlert>{addClosed.error ?? removeClosed.error}</ErrorAlert>
        {restaurant.closedDates.length === 0 ? (
          <p className="text-sm text-muted">{st.noClosedDays}</p>
        ) : (
          <ul className="divide-y divide-line">
            {restaurant.closedDates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span><span className="font-medium text-primary first-letter:uppercase">{formatDate(c.date, lang)}</span>{c.reason && <span className="text-muted"> · {c.reason}</span>}</span>
                <Button size="sm" variant="ghost" onClick={() => void removeClosed.run(c.id)}>{t.common.remove}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={st.emailQueue} description={st.emailQueueHint} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" loading={runWorker.loading} onClick={() => void runWorker.run()}>{st.runNow}</Button>
          {workerResult && <span className="text-sm text-muted">{workerResult}</span>}
        </div>
        <ErrorAlert className="mt-3">{runWorker.error}</ErrorAlert>
      </Card>
    </div>
  );
}
