"use client";

import { useCallback, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import { useI18n } from "@/i18n/client";

/**
 * Runs an async action and tracks loading / error / field errors, so forms
 * don't each re-implement the same state machine. API errors arrive already
 * translated (the client sends its locale).
 */
export function useAsync<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const run = useCallback(
    async (...args: Args): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      setFieldErrors({});
      try {
        return await fn(...args);
      } catch (e) {
        if (e instanceof ApiRequestError) {
          setError(e.message);
          setFieldErrors(e.fieldErrors);
        } else {
          setError(t.common.unexpectedError);
        }
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fn, t],
  );

  return { run, loading, error, fieldErrors, setError, setFieldErrors };
}
