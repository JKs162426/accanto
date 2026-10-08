"use client";

import { useState } from "react";
import { cn } from "@/lib/helpers";
import { useI18n } from "@/i18n/client";

export interface ChartPoint {
  label: string;
  value: number;
}

/** Clean axis ticks: 0, step, 2·step… with step in {1, 2, 5}×10ⁿ and never below 1 (values are counts). */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = Math.max(1, max / 4);
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/**
 * Single-series column chart (one hue, no legend — the title names it).
 * Columns ≤ 24px with a rounded data end, hairline grid, hover/focus tooltip
 * on every column, the peak labelled, and a table view for screen readers
 * and exact values.
 */
export default function ReportsChart({
  title,
  description,
  data,
  formatLabel = (l) => l,
  formatTooltipLabel,
  unit,
  height = 200,
}: {
  title: string;
  description?: string;
  data: ChartPoint[];
  formatLabel?: (label: string) => string;
  formatTooltipLabel?: (label: string) => string;
  unit?: string;
  height?: number;
}) {
  const { t } = useI18n();
  const unitLabel = unit ?? t.admin.chart.unit;
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(0, ...data.map((d) => d.value));
  const axis = ticks(max);
  const top = axis[axis.length - 1];
  const peak = data.findIndex((d) => d.value === max && max > 0);
  // Thin out x labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const tooltipLabel = formatTooltipLabel ?? formatLabel;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <span>
          <span className="block font-display text-h4 leading-tight font-semibold text-primary">{title}</span>
          {description && <span className="block text-sm text-muted">{description}</span>}
        </span>
        <button type="button" onClick={() => setShowTable((s) => !s)} className="text-caption font-medium text-primary underline-offset-2 hover:underline">
          {showTable ? t.admin.chart.showChart : t.admin.chart.showTable}
        </button>
      </figcaption>

      {data.length === 0 || max === 0 ? (
        <p className="flex items-center justify-center rounded-md bg-surface-raised text-sm text-muted" style={{ height }}>
          {t.admin.chart.empty}
        </p>
      ) : showTable ? (
        <div className="max-h-72 overflow-y-auto rounded-md border border-line bg-surface-raised">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-beige-light text-left text-caption text-muted">
              <tr><th className="px-3 py-2 font-medium">{t.admin.chart.period}</th><th className="px-3 py-2 text-right font-medium">{t.admin.chart.value}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d) => (
                <tr key={d.label}>
                  <td className="px-3 py-1.5">{tooltipLabel(d.label)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2" aria-hidden={false}>
          {/* Y axis */}
          <div className="relative w-6 shrink-0 text-right text-[11px] text-muted tabular-nums" style={{ height }}>
            {axis.map((t) => (
              <span key={t} className="absolute right-0" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
                {t}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
              {/* Grid: hairline, solid, recessive */}
              {axis.map((t) => (
                <div key={t} className="absolute inset-x-0 h-px bg-grid" style={{ bottom: `${(t / top) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-0.5" role="list" aria-label={title}>
                {data.map((d, i) => {
                  const h = (d.value / top) * 100;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      role="listitem"
                      aria-label={`${tooltipLabel(d.label)}: ${d.value} ${unitLabel}`}
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                    >
                      <span
                        className={cn(
                          "block w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity",
                          active !== null && active !== i && "opacity-45",
                          "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
                        )}
                        style={{ height: `${h}%`, minHeight: d.value > 0 ? 2 : 0 }}
                      />
                      {i === peak && active === null && (
                        <span className="absolute text-[11px] font-medium text-foreground tabular-nums" style={{ bottom: `calc(${h}% + 4px)` }}>
                          {d.value}
                        </span>
                      )}
                      {active === i && (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute z-10 -translate-y-2 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-left text-caption whitespace-nowrap shadow-hover"
                          style={{ bottom: `${h}%` }}
                        >
                          <span className="block text-muted">{tooltipLabel(d.label)}</span>
                          <span className="font-semibold tabular-nums">{d.value}</span> {unitLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* X axis labels */}
            <div className="mt-1.5 flex gap-0.5 text-[11px] text-muted">
              {data.map((d, i) => (
                <span key={d.label} className="min-w-0 flex-1 truncate text-center">
                  {i % labelEvery === 0 ? formatLabel(d.label) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
