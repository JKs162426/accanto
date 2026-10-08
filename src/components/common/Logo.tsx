import { cn } from "@/lib/helpers";

/**
 * Accanto mark (a Mediterranean arch framing an "A") + wordmark.
 * `tone="light"` for blue surfaces (header, footer, sidebar), `"dark"` for cream.
 * The mark mirrors public/logo.svg.
 */
export default function Logo({
  className,
  withWordmark = true,
  tone = "dark",
}: {
  className?: string;
  withWordmark?: boolean;
  tone?: "light" | "dark";
}) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="size-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="12" fill={light ? "var(--primary-strong)" : "var(--primary)"} />
        <path d="M14 52V30a18 18 0 0 1 36 0v22" fill="none" stroke="var(--gold)" strokeWidth="2" />
        <path d="M23 45 32 21l9 24M26.5 37h11" fill="none" stroke="var(--cream)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-display text-2xl font-semibold tracking-[0.2em] uppercase", light ? "text-cream" : "text-primary")}>
            Accanto
          </span>
          <span className={cn("mt-0.5 font-ui text-[9px] tracking-[0.32em] uppercase", light ? "text-gold-light" : "text-accent-text")}>
            Cucina italiana
          </span>
        </span>
      )}
    </span>
  );
}
