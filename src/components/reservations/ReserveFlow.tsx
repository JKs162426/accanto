"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { buttonClasses } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Skeleton, Spinner } from "@/components/common/Loading";
import { useAuth } from "@/hooks/useAuth";
import { useAvailability } from "@/hooks/useAvailability";
import LocaleLink from "@/components/common/LocaleLink";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { useReservations } from "@/hooks/useReservations";
import { addDays, todayIn } from "@/lib/helpers";
import { getDaySchedule } from "@/lib/scheduling";
import type { RestaurantDTO } from "@/services/restaurantService";
import AvailableTables, { SlotPicker } from "./AvailableTables";
import ReservationForm from "./ReservationForm";
import SearchForm, { type SearchValues } from "./SearchForm";

type RestaurantProps = Pick<
  RestaurantDTO,
  "timezone" | "bookingWindowDays" | "maxPartySize" | "turnoverMinutes" | "slotIntervalMinutes" | "openingHours" | "closedDates" | "phone"
>;

/** Next N open days, computed with the same rules the server uses. */
function upcomingOpenDays(r: RestaurantProps, today: string, count: number, now: Date) {
  const days: string[] = [];
  for (let i = 0; i <= r.bookingWindowDays && days.length < count; i++) {
    const d = addDays(today, i);
    if (getDaySchedule(d, r, r.openingHours, r.closedDates, now).slots.length > 0) days.push(d);
  }
  return days;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-5 flex items-center gap-3 text-h4 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-full border border-gold bg-surface-raised font-ui text-sm font-semibold text-primary">{n}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

/**
 * The whole booking flow. All choices live in the URL (?date&partySize&
 * preference&time&table) so the page survives refreshes and the
 * login → back-to-booking round trip, and can be shared.
 */
export default function ReserveFlow({ restaurant }: { restaurant: RestaurantProps }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { create } = useReservations();
  const { t, href } = useI18n();

  const { today, suggested } = useMemo(() => {
    const now = new Date();
    const t = todayIn(restaurant.timezone, now);
    return { today: t, suggested: upcomingOpenDays(restaurant, t, 6, now) };
  }, [restaurant]);

  const values: SearchValues = {
    date: params.get("date") ?? suggested[0] ?? today,
    partySize: Math.min(Math.max(Number(params.get("partySize")) || 2, 1), restaurant.maxPartySize),
    preference: params.get("preference") ?? "",
  };
  const time = params.get("time") ?? undefined;
  const tableId = params.get("table") ?? undefined;

  const setParams = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Changing the search invalidates the chosen time and table.
  const onSearchChange = (patch: Partial<SearchValues>) =>
    setParams({ ...values, ...patch, time: undefined, table: undefined });

  const { availability, loading, error } = useAvailability({
    date: values.date,
    partySize: values.partySize,
    preference: values.preference || undefined,
    time,
  });

  const selectedTable = availability?.time === time ? availability?.tables?.find((t) => t.id === tableId) : undefined;
  const returnTo = `${pathname}?${params}`;

  return (
    <div className="space-y-6">
      <Step n={1} title={t.reserve.step1}>
        <SearchForm
          values={values}
          onChange={onSearchChange}
          minDate={today}
          maxDate={addDays(today, restaurant.bookingWindowDays)}
          maxPartySize={restaurant.maxPartySize}
          suggestedDates={suggested}
        />
        <p className="mt-4 text-body-sm text-muted">
          {fmt(t.reserve.bigGroups, {
            n: restaurant.maxPartySize,
            phone: restaurant.phone ? fmt(t.reserve.bigGroupsPhone, { phone: restaurant.phone }) : "",
          })}
        </p>
      </Step>

      <Step n={2} title={t.reserve.step2}>
        {error && <ErrorAlert>{error.message}</ErrorAlert>}
        {!availability && loading && <Skeleton className="h-28" />}
        {availability && !availability.open && <ErrorAlert tone="info">{availability.message}</ErrorAlert>}
        {availability?.open && (
          <>
            {availability.message && !time && <ErrorAlert tone="warning" className="mb-4">{availability.message}</ErrorAlert>}
            <SlotPicker slots={availability.slots} selected={time} onSelect={(t) => setParams({ time: t, table: undefined })} />
          </>
        )}
      </Step>

      {time && (
        <Step n={3} title={t.reserve.step3}>
          {loading && availability?.time !== time ? (
            <div className="flex items-center gap-2 font-ui text-sm text-muted"><Spinner className="size-4" /> {t.reserve.searchingTables}</div>
          ) : availability?.tables && availability.tables.length > 0 ? (
            <>
              <AvailableTables tables={availability.tables} selected={tableId} onSelect={(id) => setParams({ table: id })} />
              <p className="mt-3 font-ui text-caption text-muted">{t.reserve.liveHint}</p>
            </>
          ) : (
            <ErrorAlert tone="info">{availability?.message ?? t.reserve.noTablesAtTime}</ErrorAlert>
          )}
        </Step>
      )}

      {time && tableId && (
        <Step n={4} title={t.reserve.step4}>
          {tableId && availability?.time === time && !selectedTable && !loading && (
            <ErrorAlert tone="warning">{t.reserve.tableJustTaken}</ErrorAlert>
          )}
          {selectedTable &&
            (authLoading ? (
              <Skeleton className="h-40" />
            ) : user ? (
              <ReservationForm
                draft={{ date: values.date, time, partySize: values.partySize, table: selectedTable }}
                user={user}
                onSubmit={async (body) => {
                  const reservation = await create(body);
                  router.push(href(`/reserve/confirmation?id=${reservation.id}`));
                  return reservation;
                }}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-muted">{t.reserve.needAccount}</p>
                <div className="flex flex-wrap gap-2">
                  <LocaleLink href={`/login?next=${encodeURIComponent(returnTo)}`} className={buttonClasses("primary")}>
                    {t.nav.login}
                  </LocaleLink>
                  <LocaleLink href={`/register?next=${encodeURIComponent(returnTo)}`} className={buttonClasses("secondary")}>
                    {t.nav.register}
                  </LocaleLink>
                </div>
              </div>
            ))}
        </Step>
      )}
    </div>
  );
}
