import LocaleLink from "./LocaleLink";
import { cn } from "@/lib/helpers";
import { fmt } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries/it";

/** Server-friendly pagination: builds links that keep the current filters. */
export default function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  t,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  t: Dictionary;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp}`;
  };
  const link = "inline-flex h-9 items-center rounded-md border border-primary bg-surface-raised px-4 font-ui text-sm text-primary hover:bg-primary-soft";
  return (
    <nav className="mt-6 flex items-center justify-between gap-2" aria-label={t.pagination.label}>
      <p className="font-ui text-sm text-muted">
        {fmt(t.pagination.summary, { page, pages, total })}
      </p>
      <div className="flex gap-2">
        <LocaleLink href={href(page - 1)} className={cn(link, page <= 1 && "pointer-events-none opacity-40")} aria-disabled={page <= 1}>
          {t.pagination.prev}
        </LocaleLink>
        <LocaleLink href={href(page + 1)} className={cn(link, page >= pages && "pointer-events-none opacity-40")} aria-disabled={page >= pages}>
          {t.pagination.next}
        </LocaleLink>
      </div>
    </nav>
  );
}
