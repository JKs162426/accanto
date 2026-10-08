import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/helpers";

/** Beige card, sand border, soft blue-tinted shadow, 8px radius, 24px padding. */
export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6", className)} {...rest} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-h4 font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-body-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Stat tile: label (caption), value (Inter semibold), optional hint. */
export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="font-ui text-caption font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-ui text-3xl font-semibold text-primary tabular-nums">{value}</p>
      {hint && <p className="mt-1 font-ui text-caption text-muted">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-subtle/60 px-6 py-12 text-center">
      <p className="font-display text-h4 font-semibold text-primary">{title}</p>
      {children && <div className="mt-2 text-body-sm text-muted">{children}</div>}
    </div>
  );
}
