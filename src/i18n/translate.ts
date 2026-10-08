/** Dictionary-agnostic translation helpers (safe for client bundles — no dictionaries imported). */
import type { Dictionary } from "./dictionaries/it";
import { fmt } from "./format";

/** Translate an API error code (AppError.code) with its params. */
export function translateError(t: Dictionary, code: string, params: Record<string, string | number> = {}): string {
  const message = (t.errors as Record<string, string>)[code];
  return message ? fmt(message, params) : t.errors.INTERNAL_ERROR;
}

/**
 * Validation messages are dictionary keys (e.g. "invalidEmail"), so the same
 * Zod schemas work for both languages. Unknown messages (Zod defaults) fall
 * back to a generic "invalid value".
 */
export function translateValidation(t: Dictionary, key: string): string {
  return (t.validation as Record<string, string>)[key] ?? (t.errors as Record<string, string>)[key] ?? t.validation.invalid;
}

export function translateFieldErrors(
  t: Dictionary,
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string[] | undefined> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.map((m) => translateValidation(t, m))]),
  );
}
