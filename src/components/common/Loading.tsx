import { cn } from "@/lib/helpers";

export function Spinner({ className, label = "…" }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block size-5 animate-spin rounded-full border-2 border-primary border-r-transparent", className)}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-muted", className)} aria-hidden />;
}

/** Generic page-level fallback for Suspense boundaries. */
export default function Loading({ rows = 3, label = "…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
