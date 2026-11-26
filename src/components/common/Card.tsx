import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/helpers";

/** Beige card, sand border, soft blue-tinted shadow, 8px radius, 24px padding. */
export function Card({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("border-line bg-surface shadow-card rounded-lg border p-5 sm:p-6", className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-h4 font-semibold">{title}</h2>
        {description && <p className="text-body-sm text-muted mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Stat tile: label (caption), value (Inter semibold), optional hint. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="font-ui text-caption text-muted font-medium tracking-wide uppercase">{label}</p>
      <p className="font-ui text-primary mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="font-ui text-caption text-muted mt-1">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-subtle/60 rounded-lg border border-dashed px-6 py-12 text-center">
      <p className="font-display text-h4 text-primary font-semibold">{title}</p>
      {children && <div className="text-body-sm text-muted mt-2">{children}</div>}
    </div>
  );
}
