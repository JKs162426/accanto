import { describe, expect, it } from "vitest";
import {
  addDays,
  csvCell,
  dayOfWeek,
  generateReservationCode,
  todayIn,
  utcToZoned,
  zonedToUtc,
} from "@/lib/helpers";

describe("time zones", () => {
  it("converts Rome wall-clock time to UTC in winter (UTC+1) and summer (UTC+2)", () => {
    expect(zonedToUtc("2026-01-15", "21:00", "Europe/Rome").toISOString()).toBe("2026-01-15T20:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "21:00", "Europe/Rome").toISOString()).toBe("2026-07-15T19:00:00.000Z");
  });

  it("handles the DST switch day (last Sunday of March)", () => {
    // 2026-03-29: clocks jump 02:00 → 03:00. Dinner is after the change: UTC+2.
    expect(zonedToUtc("2026-03-29", "20:00", "Europe/Rome").toISOString()).toBe("2026-03-29T18:00:00.000Z");
    // Lunch the day before is still UTC+1.
    expect(zonedToUtc("2026-03-28", "13:00", "Europe/Rome").toISOString()).toBe("2026-03-28T12:00:00.000Z");
  });

  it("round-trips UTC → local", () => {
    const instant = zonedToUtc("2026-10-25", "19:30", "Europe/Rome");
    expect(utcToZoned(instant, "Europe/Rome")).toEqual({ date: "2026-10-25", time: "19:30" });
  });

  it("computes 'today' in the restaurant zone, not the server's", () => {
    // 23:30 UTC on Oct 6 is already Oct 7 in Rome.
    expect(todayIn("Europe/Rome", new Date("2026-10-06T23:30:00Z"))).toBe("2026-10-07");
    expect(todayIn("America/New_York", new Date("2026-10-06T23:30:00Z"))).toBe("2026-10-06");
  });
});

describe("calendar helpers", () => {
  it("dayOfWeek / addDays", () => {
    expect(dayOfWeek("2026-10-08")).toBe(4); // Thursday
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("reservation codes", () => {
  it("uses the ACC- prefix and an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) expect(generateReservationCode()).toMatch(/^ACC-[2-9A-HJKMNP-Z]{6}$/);
  });
});

describe("csv", () => {
  it("quotes separators and neutralises formula injection", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("+34 600 111 222")).toBe("+34 600 111 222");
    expect(csvCell("-2+3+cmd|calc")).toBe("'-2+3+cmd|calc");
    expect(csvCell(null)).toBe("");
  });
});
