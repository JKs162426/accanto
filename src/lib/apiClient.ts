/**
 * Browser-side fetch wrapper for our API routes. Sends the page language
 * (x-locale) so server messages come back translated, and throws
 * ApiRequestError with the message and per-field errors for inline display.
 */
import type { ApiErrorBody } from "@/types";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
  }
}

function pageLocale(): string {
  return typeof document !== "undefined" ? document.documentElement.lang || "it" : "it";
}

const NETWORK_ERROR: Record<string, string> = {
  it: "Nessuna connessione. Controlla la rete e riprova.",
  en: "No connection. Check your network and try again.",
};
const UNKNOWN_ERROR: Record<string, string> = {
  it: "Si è verificato un errore imprevisto. Riprova.",
  en: "Something went wrong. Please try again.",
};

export async function apiFetch<T>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const locale = pageLocale();
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "x-locale": locale,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiRequestError(0, "NETWORK", NETWORK_ERROR[locale] ?? NETWORK_ERROR.it);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? UNKNOWN_ERROR[locale] ?? UNKNOWN_ERROR.it,
      body?.error?.details?.fieldErrors ?? {},
    );
  }
  return data as T;
}

/** SWR fetcher. */
export const swrFetcher = <T,>(url: string) => apiFetch<T>(url);
