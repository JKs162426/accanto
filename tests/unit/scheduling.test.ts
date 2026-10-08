import { describe, expect, it } from "vitest";
import {
  findAvailableTables,
  generateSlots,
  getDaySchedule,
  intervalsOverlap,
  reservationInterval,
  type OpeningHourLike,
  type SchedulingConfig,
  type TableLike,
} from "@/lib/scheduling";

const TZ = "Europe/Rome";
const config: SchedulingConfig = {
  timezone: TZ,
  turnoverMinutes: 120,
  slotIntervalMinutes: 30,
  bookingWindowDays: 60,
  maxPartySize: 8,
};
// Thursday → Sunday, lunch 12–15, dinner 18–23 (the seeded restaurant).
const hours: OpeningHourLike[] = [4, 5, 6, 0].flatMap((d) => [
  { dayOfWeek: d, shift: "LUNCH" as const, opensAt: "12:00", closesAt: "15:00" },
  { dayOfWeek: d, shift: "DINNER" as const, opensAt: "18:00", closesAt: "23:00" },
]);
// Tuesday 2026-10-06, 10:00 in Rome.
const NOW = new Date("2026-10-06T08:00:00Z");

describe("generateSlots", () => {
  it("lets guests finish before close: last slot = close − turnover", () => {
    const slots = generateSlots(hours, 4, 120, 30).map((s) => s.time);
    expect(slots).toEqual(["12:00", "12:30", "13:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"]);
  });

  it("has no slots on closed weekdays", () => {
    expect(generateSlots(hours, 1, 120, 30)).toEqual([]);
  });
});

describe("getDaySchedule", () => {
  it("rejects closed weekdays, closed dates, past dates and dates beyond the window", () => {
    expect(getDaySchedule("2026-10-06", config, hours, [], NOW).rejection).toBe("CLOSED_WEEKDAY");
    expect(getDaySchedule("2026-10-08", config, hours, [{ date: "2026-10-08", reason: "Evento" }], NOW)).toMatchObject({
      open: false,
      rejection: "CLOSED_DATE",
      closedReason: "Evento",
    });
    expect(getDaySchedule("2026-10-05", config, hours, [], NOW).rejection).toBe("IN_THE_PAST");
    expect(getDaySchedule("2026-12-31", config, hours, [], NOW).rejection).toBe("BEYOND_BOOKING_WINDOW");
    expect(getDaySchedule("2026-10-08", config, hours, [], NOW).open).toBe(true);
  });

  it("drops slots that already started today", () => {
    // Thursday 2026-10-08 at 19:10 Rome time.
    const now = new Date("2026-10-08T17:10:00Z");
    const times = getDaySchedule("2026-10-08", config, hours, [], now).slots.map((s) => s.time);
    expect(times[0]).toBe("19:30");
  });
});

describe("overlaps", () => {
  const at = (t: string) => reservationInterval("2026-10-08", t, config);

  it("blocks the table for the whole turnover", () => {
    const a = at("20:00");
    expect(intervalsOverlap(a.startsAt, a.endsAt, at("21:30").startsAt, at("21:30").endsAt)).toBe(true);
    expect(intervalsOverlap(a.startsAt, a.endsAt, at("18:30").startsAt, at("18:30").endsAt)).toBe(true);
  });

  it("allows back-to-back bookings (half-open intervals)", () => {
    const a = at("18:00");
    const b = at("20:00");
    expect(intervalsOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt)).toBe(false);
  });
});

describe("findAvailableTables", () => {
  const table = (id: string, number: number, capacity: number, extra: Partial<TableLike> = {}): TableLike => ({
    id, number, capacity, location: "INTERIOR", type: "STANDARD", isWindow: false, status: "ACTIVE", ...extra,
  });
  const tables = [
    table("t9", 9, 8, { location: "PRIVATE", type: "PRIVATE" }),
    table("t1", 1, 4),
    table("t5", 5, 4, { location: "TERRACE" }),
    table("t11", 11, 2, { type: "VIP", isWindow: true }),
    table("t2", 2, 4, { status: "OUT_OF_SERVICE" }),
    table("t3", 3, 4, { deletedAt: new Date() }),
  ];
  const slot = reservationInterval("2026-10-08", "20:00", config);

  it("returns fitting, active tables, smallest first", () => {
    const ids = findAvailableTables(tables, [], { ...slot, partySize: 2 }).map((t) => t.id);
    expect(ids).toEqual(["t11", "t1", "t5", "t9"]);
  });

  it("excludes tables that are too small or already booked", () => {
    const busy = [{ tableId: "t1", ...reservationInterval("2026-10-08", "19:00", config) }];
    const ids = findAvailableTables(tables, busy, { ...slot, partySize: 3 }).map((t) => t.id);
    expect(ids).toEqual(["t5", "t9"]);
  });

  it("filters by seating preference", () => {
    const pick = (preference: Parameters<typeof findAvailableTables>[2]["preference"]) =>
      findAvailableTables(tables, [], { ...slot, partySize: 2, preference }).map((t) => t.id);
    expect(pick("TERRACE")).toEqual(["t5"]);
    expect(pick("WINDOW")).toEqual(["t11"]);
    expect(pick("PRIVATE")).toEqual(["t9"]);
    expect(pick("VIP")).toEqual(["t11"]);
  });
});
