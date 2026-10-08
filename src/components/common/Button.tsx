import type Link from "next/link";
import LocaleLink from "./LocaleLink";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/helpers";

/**
 * primary   — terracotta CTA
 * secondary — Mediterranean-blue outline
 * ghost     — text only
 * danger    — destructive outline
 * inverse / inverse-ghost — for use on blue surfaces (header, sidebar)
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse" | "inverse-ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-ui font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent shadow-sm hover:bg-accent-strong",
  secondary: "border border-primary bg-surface-raised text-primary hover:bg-primary-soft",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "border border-danger/50 bg-surface-raised text-danger hover:bg-danger-soft",
  inverse: "border border-gold/70 text-cream hover:bg-white/10",
  "inverse-ghost": "text-cream/90 hover:bg-white/10 hover:text-cream",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-caption",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

/** Selectable chip / segmented-control item. Selected = solid Mediterranean blue. */
export function chipClasses(active: boolean, className?: string) {
  return cn(
    "rounded-md border px-3.5 py-1.5 font-ui text-sm transition-colors",
    active
      ? "border-primary bg-primary text-on-primary"
      : "border-line bg-surface-raised text-foreground hover:border-primary/60",
    className,
  );
}

/** Inline text link. */
export const linkClasses = "font-ui font-medium text-primary underline-offset-4 hover:underline";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}

/** Link styled as a button; app paths get the locale prefix automatically. */
interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <LocaleLink className={buttonClasses(variant, size, className)} {...rest} />;
}
