/**
 * Pure scheduling rules: opening hours → bookable slots, and table conflict
 * detection. No database or framework imports, so this module is unit-tested
 * directly (tests/unit/scheduling.test.ts) and reused by the services.
 */
import type { ShiftName, TableLocation, TableStatus, TableType } from "@/generated/prisma/enums";
import type { SeatingPreference } from "./constants";
import { addDays, dayOfWeek, minutesToTime, timeToMinutes, todayIn, zonedToUtc } from "./helpers";

export interface OpeningHourLike {
  dayOfWeek: number;
  shift: ShiftName;
  opensAt: string;
  closesAt: string;
}

export interface SchedulingConfig {
  timezone: string;
  turnoverMinutes: number;
  slotIntervalMinutes: number;
  bookingWindowDays: number;
  maxPartySize: number;
}

export interface Slot {
  time: string;
  shift: ShiftName;
}

/**
 * Slots for one weekday. A table is held for `turnoverMinutes`, and the guest
 * must be able to finish before the shift closes, so the last slot starts at
 * `closesAt - turnover`. E.g. lunch 12:00–15:00 with 2h turnover and 30 min
 * interval → 12:00, 12:30, 13:00.
 */
export function generateSlots(
  hours: OpeningHourLike[],
  day: number,
  turnoverMinutes: number,
  slotIntervalMinutes: number,
): Slot[] {
  const slots: Slot[] = [];
  const shifts = hours
    .filter((h) => h.dayOfWeek === day)
    .sort((a, b) => timeToMinutes(a.opensAt) - timeToMinutes(b.opensAt));
  for (const h of shifts) {
    const last = timeToMinutes(h.closesAt) - turnoverMinutes;
    for (let m = timeToMinutes(h.opensAt); m <= last; m += slotIntervalMinutes) {
      slots.push({ time: minutesToTime(m), shift: h.shift });
    }
  }
  return slots;
}

export type DateRejection =
  | "CLOSED_WEEKDAY"
  | "CLOSED_DATE"
  | "IN_THE_PAST"
  | "BEYOND_BOOKING_WINDOW";

export interface DaySchedule {
  date: string;
  open: boolean;
  rejection?: DateRejection;
  closedReason?: string | null;
  slots: Slot[];
}

/**
 * Bookable slots for a date, taking closures, the booking window and — for
 * today — slots that already started into account.
 */
export function getDaySchedule(
  date: string,
  config: SchedulingConfig,
  hours: OpeningHourLike[],
  closedDates: Array<{ date: string; reason?: string | null }>,
  now: Date,
): DaySchedule {
  const today = todayIn(config.timezone, now);
  if (date < today) return { date, open: false, rejection: "IN_THE_PAST", slots: [] };
  if (date > addDays(today, config.bookingWindowDays)) {
    return { date, open: false, rejection: "BEYOND_BOOKING_WINDOW", slots: [] };
  }
  const closed = closedDates.find((c) => c.date === date);
  if (closed) {
    return { date, open: false, rejection: "CLOSED_DATE", closedReason: closed.reason, slots: [] };
  }
  let slots = generateSlots(
    hours,
    dayOfWeek(date),
    config.turnoverMinutes,
    config.slotIntervalMinutes,
  );
  if (slots.length === 0) return { date, open: false, rejection: "CLOSED_WEEKDAY", slots: [] };
  if (date === today) {
    slots = slots.filter((s) => zonedToUtc(date, s.time, config.timezone) > now);
  }
  return { date, open: true, slots };
}

export function reservationInterval(
  date: string,
  time: string,
  config: Pick<SchedulingConfig, "timezone" | "turnoverMinutes">,
): { startsAt: Date; endsAt: Date } {
  const startsAt = zonedToUtc(date, time, config.timezone);
  return { startsAt, endsAt: new Date(startsAt.getTime() + config.turnoverMinutes * 60_000) };
}

/** Half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap. */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface TableLike {
  id: string;
  number: number;
  capacity: number;
  location: TableLocation;
  type: TableType;
  isWindow: boolean;
  status: TableStatus;
  deletedAt?: Date | null;
}

export interface BusyInterval {
  tableId: string;
  startsAt: Date;
  endsAt: Date;
}

export function matchesPreference(table: TableLike, preference?: SeatingPreference | null): boolean {
  switch (preference) {
    case undefined:
    case null:
      return true;
    case "WINDOW":
      return table.isWindow;
    case "VIP":
      return table.type === "VIP";
    case "PRIVATE":
      return table.location === "PRIVATE" || table.type === "PRIVATE";
    default:
      return table.location === preference;
  }
}

/**
 * Tables that can seat `partySize` during [startsAt, endsAt) and match the
 * preference. Sorted smallest-fit first so a couple doesn't take an 8-top
 * when a 2-top is free.
 */
export function findAvailableTables<T extends TableLike>(
  tables: T[],
  busy: BusyInterval[],
  request: {
    startsAt: Date;
    endsAt: Date;
    partySize: number;
    preference?: SeatingPreference | null;
  },
): T[] {
  return tables
    .filter(
      (t) =>
        t.status === "ACTIVE" &&
        !t.deletedAt &&
        t.capacity >= request.partySize &&
        matchesPreference(t, request.preference) &&
        !busy.some(
          (b) =>
            b.tableId === t.id &&
            intervalsOverlap(b.startsAt, b.endsAt, request.startsAt, request.endsAt),
        ),
    )
    .sort((a, b) => a.capacity - b.capacity || a.number - b.number);
}
