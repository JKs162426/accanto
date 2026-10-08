export const APP_NAME = "Accanto";

export const SESSION_COOKIE = "accanto_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Max reservations a single user may create per rolling hour. */
export const RESERVATIONS_PER_HOUR_LIMIT = 10;
/** Login/register attempts per window (best effort, in-memory). */
export const AUTH_ATTEMPTS_PER_IP = 20;
export const AUTH_ATTEMPTS_PER_ACCOUNT = 10;
export const AUTH_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;
/** Public availability lookups per IP per minute (the UI polls every 30 s). */
export const AVAILABILITY_PER_MINUTE = 120;

/** Emails are retried this many times before staying FAILED. */
export const EMAIL_MAX_ATTEMPTS = 3;

export const PAGE_SIZE = 20;

/**
 * Show the demo credentials on the login screens? Always in development; in
 * production only for a public portfolio demo (DEMO_MODE=true). Note: anyone
 * can then sign in as admin — pair it with EMAIL_RECIPIENT_ALLOWLIST.
 */
export const SHOW_DEMO_CREDENTIALS = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";

/** Cache tag for the public restaurant info rendered with "use cache". */
export const RESTAURANT_CACHE_TAG = "restaurant";

/**
 * Seating preferences a client can filter by on the search form.
 * Labels live in the dictionaries (`enums.preference`).
 */
export const SEATING_PREFERENCES = ["", "INTERIOR", "TERRACE", "WINDOW", "PRIVATE", "VIP"] as const;

export type SeatingPreference = Exclude<(typeof SEATING_PREFERENCES)[number], "">;
