import type { ReactNode } from "react";
import { cn } from "@/lib/helpers";

type Tone = "error" | "success" | "info" | "warning";

const tones: Record<Tone, string> = {
  error: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  info: "border-info/20 bg-info-soft text-info",
  warning: "border-warning/30 bg-warning-soft text-warning",
};

export default function ErrorAlert({
  children,
  tone = "error",
  title,
  className,
}: {
  children?: ReactNode;
  tone?: Tone;
  title?: string;
  className?: string;
}) {
  if (!children && !title) return null;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 font-ui text-sm", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
    </div>
  );
}
