/**
 * Framework-free helpers shared by server and client code.
 *
 * Time handling convention:
 *  - A reservation's calendar date ("YYYY-MM-DD") and time ("HH:mm") are always
 *    expressed in the *restaurant's* timezone — that is what the guest picks.
 *  - Absolute instants (startsAt/endsAt, createdAt…) are stored in UTC.
 *  - `zonedToUtc` / `utcToZoned` convert between the two using Intl, so the
 *    result is correct across DST changes without a timezone library.
 */
import type { TableLocation, TableType } from "@/generated/prisma/enums";

// ─── Dates & time zones ────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function parseDate(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

/** Offset (ms) between `timeZone` wall-clock time and UTC at a given instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/** Restaurant-local date + time → UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = parseDate(date);
  const [hh, mm] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  // First guess uses the offset at the wall-clock instant; a second pass fixes
  // the hour around DST transitions where the offset differs.
  const firstOffset = tzOffsetMs(new Date(wallClockAsUtc), timeZone);
  let result = wallClockAsUtc - firstOffset;
  const secondOffset = tzOffsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = wallClockAsUtc - secondOffset;
  return new Date(result);
}

/** UTC instant → restaurant-local date ("YYYY-MM-DD") and time ("HH:mm"). */
export function utcToZoned(instant: Date, timeZone: string): { date: string; time: string } {
  const shifted = new Date(instant.getTime() + tzOffsetMs(instant, timeZone));
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" date. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date at UTC midnight, the representation Prisma uses for @db.Date. */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Prisma @db.Date value → "YYYY-MM-DD". */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date in the restaurant's timezone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return utcToZoned(now, timeZone).date;
}

// ─── Formatting (locale-aware) ─────────────────────────────────────────

/** Accepts our Locale ("it"/"en") or any BCP 47 tag. */
function intl(locale: string): string {
  return locale === "it" ? "it-IT" : locale === "en" ? "en-GB" : locale;
}

export function formatDate(date: string, locale: string, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat(intl(locale), {
    timeZone: "UTC",
    ...(style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "2-digit", month: "short", year: "numeric" }),
  }).format(toDbDate(date));
}

/** Short month name ("ott", "Oct") for a 1-based month. */
export function formatMonthShort(month: number, locale: string): string {
  return new Intl.DateTimeFormat(intl(locale), { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
}

export function formatDateTime(instant: Date | string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(intl(locale), {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}

export function formatMonthYear(instant: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(intl(locale), { month: "long", year: "numeric" }).format(new Date(instant));
}

export function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(intl(locale), { style: "currency", currency: "EUR" }).format(amount);
}

export function formatPercent(ratio: number, locale: string): string {
  return new Intl.NumberFormat(intl(locale), { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/** Human tags for a table: area, category and window, e.g. ["Interno", "VIP", "Finestra"]. */
export function tableTags(
  t: { enums: { location: Record<TableLocation, string>; tableType: Record<TableType, string>; window: string } },
  table: { location: TableLocation; type: TableType; isWindow: boolean },
): string[] {
  const tags: string[] = [t.enums.location[table.location]];
  if (table.type !== "STANDARD") tags.push(t.enums.tableType[table.type]);
  if (table.isWindow) tags.push(t.enums.window);
  return [...new Set(tags)];
}

// ─── Misc ──────────────────────────────────────────────────────────────

// No 0/O/1/I/L so codes can be read over the phone.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Unique-enough reservation code, e.g. "ACC-7KQ2MX" (31^6 ≈ 887M combinations). */
export function generateReservationCode(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `ACC-${body}`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Escape a value for a CSV cell (RFC 4180). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of user
  // text) — but leave plain phone numbers like "+34 600 000 000" untouched.
  if (typeof value === "string" && /^[=+\-@]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** `columns` are row keys; `headers` (same order) are the labels written to the first line. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[], headers: string[] = columns): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return lines.join("\r\n");
}
