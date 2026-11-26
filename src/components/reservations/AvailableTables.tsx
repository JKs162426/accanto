"use client";

import { cn, tableTags } from "@/lib/helpers";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { SlotDTO, PublicTableDTO } from "@/types";

/** Time slots grouped by shift; full slots are disabled. */
export function SlotPicker({
  slots,
  selected,
  onSelect,
}: {
  slots: SlotDTO[];
  selected?: string;
  onSelect: (time: string) => void;
}) {
  const { t } = useI18n();
  const shifts = [...new Set(slots.map((s) => s.shift))];
  return (
    <div className="space-y-4">
      {shifts.map((shift) => (
        <div key={shift}>
          <p className="font-ui text-caption text-muted mb-2 font-medium tracking-wide uppercase">
            {t.enums.shift[shift]}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slots
              .filter((s) => s.shift === shift)
              .map((s) => {
                const full = s.free === 0;
                const few = s.free > 0 && s.free <= 2;
                const active = selected === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={full}
                    aria-pressed={active}
                    onClick={() => onSelect(s.time)}
                    className={cn(
                      "relative rounded-md border px-2 py-2.5 text-sm tabular-nums transition-colors",
                      active
                        ? "border-primary bg-primary text-on-primary"
                        : "border-line bg-surface-raised hover:border-primary/60",
                      full &&
                        "text-muted hover:border-line cursor-not-allowed border-dashed bg-transparent line-through opacity-60",
                    )}
                  >
                    {s.time}
                    {/* "Poco disponible" (brand: terracotta) when 1–2 tables are left. */}
                    {few && !active && (
                      <span
                        className="bg-terracotta absolute top-1 right-1 size-1.5 rounded-full"
                        aria-hidden
                      />
                    )}
                    <span className="sr-only">{` (${full ? t.reserve.full : fmt(few ? t.reserve.fewLeft : t.reserve.freeTables, { n: s.free })})`}</span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableGlyph({ capacity }: { capacity: number }) {
  // Simple top-down table with one dot per seat.
  const seats = Math.min(capacity, 8);
  return (
    <svg viewBox="0 0 48 48" className="size-12 shrink-0" aria-hidden>
      <rect
        x="14"
        y="14"
        width="20"
        height="20"
        rx={capacity <= 2 ? 10 : 4}
        fill="var(--beige-light)"
        stroke="var(--gold)"
      />
      {Array.from({ length: seats }, (_, i) => {
        const angle = (i / seats) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={24 + Math.cos(angle) * 19}
            cy={24 + Math.sin(angle) * 19}
            r="3.2"
            fill="var(--primary)"
          />
        );
      })}
    </svg>
  );
}

/** Free tables for the chosen slot. */
export default function AvailableTables({
  tables,
  selected,
  onSelect,
}: {
  tables: PublicTableDTO[];
  selected?: string;
  onSelect: (tableId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {tables.map((table) => {
        const active = selected === table.id;
        return (
          <li key={table.id}>
            <button
              type="button"
              onClick={() => onSelect(table.id)}
              aria-pressed={active}
              className={cn(
                "flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all",
                active
                  ? "border-primary bg-primary-soft border-2 p-[15px]"
                  : "border-line bg-surface-raised hover:border-primary/60 hover:shadow-hover",
              )}
            >
              <TableGlyph capacity={table.capacity} />
              <span className="min-w-0 flex-1">
                <span className="font-display text-h4 text-primary block leading-tight font-semibold">
                  {fmt(t.common.table, { n: table.number })}
                </span>
                <span className="text-body-sm text-muted block">
                  {fmt(t.reserve.upTo, { n: table.capacity })}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {tableTags(t, table).map((tag) => (
                    <span
                      key={tag}
                      className="bg-beige-light font-ui text-caption text-foreground rounded-md px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-primary bg-primary" : "border-subtle",
                )}
                aria-hidden
              >
                {active && <span className="bg-cream size-2 rounded-full" />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
