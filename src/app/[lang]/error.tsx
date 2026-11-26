"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/common/Button";
import { useI18n } from "@/i18n/client";

/**
 * Localized error boundary for every page under /[lang]. Shows a friendly
 * message (never the error details) and lets the user retry.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    // The digest links this view to the server log entry, without exposing details.
    console.error("[page error]", error.digest ?? "");
  }, [error]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="font-display text-accent-text text-6xl font-bold">!</p>
      <h1 className="text-h3">{t.errorPage.title}</h1>
      <p className="text-body-lg text-muted max-w-sm">{t.errorPage.text}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>{t.errorPage.retry}</Button>
        <ButtonLink href="/" variant="secondary">
          {t.errorPage.home}
        </ButtonLink>
      </div>
    </main>
  );
}
