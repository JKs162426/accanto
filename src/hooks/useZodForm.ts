"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { useI18n } from "@/i18n/client";
import { translateFieldErrors } from "@/i18n/translate";

/**
 * Client-side validation with the shared Zod schemas. Returns parsed data, or
 * null after storing translated field errors for inline display.
 */
export function useZodForm() {
  const { t } = useI18n();
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined>>({});

  const validate = useCallback(
    <S extends z.ZodType>(schema: S, input: unknown): z.infer<S> | null => {
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        setClientErrors(translateFieldErrors(t, z.flattenError(parsed.error).fieldErrors as Record<string, string[]>));
        return null;
      }
      setClientErrors({});
      return parsed.data;
    },
    [t],
  );

  return { validate, clientErrors };
}
