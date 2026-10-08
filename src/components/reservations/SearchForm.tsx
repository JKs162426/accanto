"use client";

import { SEATING_PREFERENCES } from "@/lib/constants";
import { chipClasses } from "@/components/common/Button";
import { formatDate } from "@/lib/helpers";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

export interface SearchValues {
  date: string;
  partySize: number;
  preference: string;
}

/**
 * Date / party size / seating preference. Quick-pick chips show the next open
 * days so guests don't land on a closed Monday.
 */
export default function SearchForm({
  values,
  onChange,
  minDate,
  maxDate,
  maxPartySize,
  suggestedDates,
  preferenceCapacity,
}: {
  values: SearchValues;
  onChange: (patch: Partial<SearchValues>) => void;
  minDate: string;
  maxDate: string;
  maxPartySize: number;
  suggestedDates: string[];
  /** Largest party each preference can seat; flags options the group won't fit. */
  preferenceCapacity?: Record<string, number>;
}) {
  const { t, lang } = useI18n();
  const chip = (active: boolean, className?: string) => chipClasses(active, className);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t.reserve.date}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {suggestedDates.map((d) => (
            <button key={d} type="button" className={chip(values.date === d)} onClick={() => onChange({ date: d })}>
              {formatDate(d, lang, "short").replace(/ \d{4}$/, "")}
              <span className="sr-only"> ({formatDate(d, lang)})</span>
            </button>
          ))}
          <label className="sr-only" htmlFor="date">{t.reserve.otherDate}</label>
          <input
            id="date"
            type="date"
            value={values.date}
            min={minDate}
            max={maxDate}
            onChange={(e) => e.target.value && onChange({ date: e.target.value })}
            className="rounded-md border border-line bg-surface-raised px-3.5 py-1.5 font-ui text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
        {values.date && <p className="mt-2 text-body-sm text-muted first-letter:uppercase">{formatDate(values.date, lang)}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t.reserve.people}</legend>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="size-10 rounded-md border border-primary bg-surface-raised font-ui text-lg text-primary hover:bg-primary-soft disabled:opacity-40"
              onClick={() => onChange({ partySize: values.partySize - 1 })}
              disabled={values.partySize <= 1}
              aria-label={t.reserve.oneLess}
            >
              −
            </button>
            <output className="w-10 text-center text-2xl font-semibold text-primary tabular-nums" aria-live="polite">
              {values.partySize}
            </output>
            <button
              type="button"
              className="size-10 rounded-md border border-primary bg-surface-raised font-ui text-lg text-primary hover:bg-primary-soft disabled:opacity-40"
              onClick={() => onChange({ partySize: values.partySize + 1 })}
              disabled={values.partySize >= maxPartySize}
              aria-label={t.reserve.oneMore}
            >
              +
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t.reserve.preference}</legend>
          <div className="flex flex-wrap gap-2">
            {SEATING_PREFERENCES.map((p) => {
              const max = preferenceCapacity?.[p];
              const tooSmall = p !== "" && !!max && values.partySize > max;
              return (
                <button
                  key={p}
                  type="button"
                  className={chip(values.preference === p, tooSmall ? "border-dashed opacity-60" : undefined)}
                  aria-pressed={values.preference === p}
                  title={tooSmall ? fmt(t.reserve.maxGuests, { n: max }) : undefined}
                  onClick={() => onChange({ preference: p })}
                >
                  {t.enums.preference[p]}
                  {tooSmall && <span className="ml-1 text-caption">· {fmt(t.reserve.maxGuests, { n: max })}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
