import { describe, expect, it } from "vitest";
import { createReservationSchema, openingHourSchema, registerSchema } from "@/lib/validation";

describe("validation", () => {
  it("normalises emails and requires a strong-enough password", () => {
    const ok = registerSchema.safeParse({ name: "Ana", email: "  ANA@Example.com ", password: "secreto123" });
    expect(ok.success && ok.data.email).toBe("ana@example.com");
    expect(registerSchema.safeParse({ name: "Ana", email: "ana@x.com", password: "solo-letras" }).success).toBe(false);
  });

  it("rejects malformed reservation input", () => {
    const base = { date: "2026-10-08", time: "20:00", partySize: 2, tableId: "t1", guestName: "Ana", guestEmail: "a@b.co" };
    expect(createReservationSchema.safeParse(base).success).toBe(true);
    expect(createReservationSchema.safeParse({ ...base, time: "25:00" }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...base, partySize: 0 }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...base, date: "08/10/2026" }).success).toBe(false);
  });

  it("requires closing time after opening time", () => {
    expect(openingHourSchema.safeParse({ dayOfWeek: 4, shift: "LUNCH", opensAt: "15:00", closesAt: "12:00" }).success).toBe(false);
  });
});
