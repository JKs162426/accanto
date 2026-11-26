/**
 * Runs against the database in DATABASE_URL (seeded). Skipped when unset.
 *   npm run db:start && npm run db:seed && npm test
 * Creates reservations on a future open day and deletes them afterwards.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });
const enabled = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe.skipIf(!enabled)("reservations (database)", async () => {
  const { db } = await import("@/lib/db");
  const { createReservation, cancelReservation, updateReservation } =
    await import("@/services/reservationService");
  const { getAvailability } = await import("@/services/availabilityService");
  const { addDays, dayOfWeek, todayIn } = await import("@/lib/helpers");
  const { AppError } = await import("@/lib/errors");

  const created: string[] = [];
  const startedAt = new Date();
  let date = "";
  let client: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: "CLIENT" | "ADMIN";
  };
  let other: typeof client;
  let tableId = "";

  beforeAll(async () => {
    const restaurant = await db.restaurant.findFirstOrThrow();
    // An open day ~5 weeks out with no seeded bookings.
    date = addDays(todayIn(restaurant.timezone), 35);
    while (![4, 5, 6, 0].includes(dayOfWeek(date))) date = addDays(date, 1);
    const pick = (email: string) =>
      db.user.findUniqueOrThrow({
        where: { email },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });
    client = await pick("client1@accanto.local");
    other = await pick("client2@accanto.local");
    tableId = (await db.table.findFirstOrThrow({ where: { number: 1, deletedAt: null } })).id;
  });

  afterAll(async () => {
    await db.emailLog.deleteMany({ where: { timestamp: { gt: startedAt } } });
    await db.notification.deleteMany({ where: { createdAt: { gt: startedAt } } });
    await db.reservation.deleteMany({ where: { id: { in: created } } });
    await db.$disconnect();
  });

  const input = (time: string) => ({
    date,
    time,
    partySize: 2,
    tableId,
    guestName: "Test",
    guestEmail: "test@example.com",
    guestPhone: null,
    notes: null,
  });

  it("never double-books a table when two requests race", async () => {
    const results = await Promise.allSettled([
      createReservation(input("20:00"), client),
      createReservation(input("20:00"), other),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    ok.forEach((r) => created.push((r as PromiseFulfilledResult<{ id: string }>).value.id));
    expect(ok).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(AppError);
    expect((failed[0].reason as InstanceType<typeof AppError>).status).toBe(409);
  });

  it("rejects an overlapping slot on the same table but allows back-to-back", async () => {
    await expect(createReservation(input("21:00"), other)).rejects.toMatchObject({
      code: "TABLE_TAKEN",
    });
    const next = await createReservation({ ...input("18:00") }, other);
    created.push(next.id);
    expect(next.tableId).toBe(tableId);
  });

  it("hides a booked table from availability and enqueues confirmation emails", async () => {
    const availability = await getAvailability({ date, time: "20:00", partySize: 2 });
    expect(availability.tables?.some((t) => t.id === tableId)).toBe(false);
    // Client bookings email the account holder, whatever the form said.
    const emails = await db.emailLog.count({
      where: {
        template: "RESERVATION_CONFIRMED",
        recipient: { in: [client.email, other.email] },
        timestamp: { gt: new Date(Date.now() - 60_000) },
      },
    });
    expect(emails).toBeGreaterThan(0);
  });

  it("only lets the owner modify, and moves to a free table when needed", async () => {
    const mine = await db.reservation.findFirstOrThrow({
      where: { id: { in: created }, clientId: client.id },
    });
    await expect(updateReservation(mine.id, { partySize: 3 }, other)).rejects.toMatchObject({
      status: 404,
    });
    // 18:00 on table 1 is taken by `other`; moving there must pick another table.
    const moved = await updateReservation(mine.id, { time: "18:00" }, client);
    expect(moved.tableId).not.toBe(tableId);
    const history = await db.reservationHistory.count({
      where: { reservationId: mine.id, action: "UPDATED" },
    });
    expect(history).toBe(1);
  });

  it("sends client confirmations only to the account email (no emailing third parties)", async () => {
    const r = await createReservation(
      { ...input("13:00"), guestEmail: "victim@example.com" },
      client,
    );
    created.push(r.id);
    expect(r.guestEmail).toBe(client.email);
    const toVictim = await db.emailLog.count({
      where: { recipient: "victim@example.com", timestamp: { gt: new Date(Date.now() - 60_000) } },
    });
    expect(toVictim).toBe(0);
  });

  it("public availability never exposes internal table notes", async () => {
    const availability = await getAvailability({ date, time: "21:00", partySize: 2 });
    expect(availability.tables?.length).toBeGreaterThan(0);
    for (const t of availability.tables ?? []) expect(t).not.toHaveProperty("notes");
  });

  it("explains that a party is too large for the preference instead of reporting it full", async () => {
    const vip = await getAvailability({ date, partySize: 4, preference: "VIP" });
    expect(vip.open).toBe(true);
    expect(vip.slots).toEqual([]);
    expect(vip.notice?.code).toBe("PREFERENCE_TOO_SMALL");
    expect(vip.preferenceCapacity?.VIP).toBe(2);
    const couple = await getAvailability({ date, partySize: 2, preference: "VIP" });
    expect(couple.notice).toBeUndefined();
    expect(couple.slots.some((s) => s.free > 0)).toBe(true);
  });

  describe("concurrent changes to the same booking", () => {
    // Table 2 at 20:00 is unused by the tests above. Each round books it,
    // races two operations, checks the result, then deletes the booking so
    // the next round starts clean and the rounds don't count towards the
    // client's hourly booking limit.
    const ROUNDS = 5;
    const book = async () => {
      const table2 = (await db.table.findFirstOrThrow({ where: { number: 2, deletedAt: null } }))
        .id;
      const r = await createReservation({ ...input("20:00"), tableId: table2 }, client);
      created.push(r.id);
      return r;
    };
    const history = (reservationId: string) =>
      db.reservationHistory.findMany({ where: { reservationId }, orderBy: { timestamp: "asc" } });

    it("cancels only once when two cancellations race", async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const r = await book();
        const results = await Promise.allSettled([
          cancelReservation(r.id, client),
          cancelReservation(r.id, client),
        ]);
        const failed = results.filter((x): x is PromiseRejectedResult => x.status === "rejected");
        expect(failed).toHaveLength(1);
        expect(failed[0].reason).toMatchObject({ code: "NOT_CANCELLABLE" });
        const cancelled = (await history(r.id)).filter((h) => h.action === "CANCELLED");
        expect(cancelled).toHaveLength(1);
        await db.reservation.delete({ where: { id: r.id } });
      }
    });

    it("never edits a booking after a racing cancellation", async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const r = await book();
        const [cancel, update] = await Promise.allSettled([
          cancelReservation(r.id, client),
          updateReservation(r.id, { partySize: 3 }, client),
        ]);
        expect(cancel.status).toBe("fulfilled");
        const final = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
        expect(final.status).toBe("CANCELLED");
        const actions = (await history(r.id)).map((h) => h.action);
        // Either the edit ran first (CREATED, UPDATED, CANCELLED) or it was
        // rejected because the booking was already cancelled.
        if (update.status === "fulfilled") {
          expect(actions).toEqual(["CREATED", "UPDATED", "CANCELLED"]);
          expect(final.partySize).toBe(3);
        } else {
          expect(update.reason).toMatchObject({ code: "NOT_EDITABLE" });
          expect(actions).toEqual(["CREATED", "CANCELLED"]);
          expect(final.partySize).toBe(2);
        }
        await db.reservation.delete({ where: { id: r.id } });
      }
    });
  });

  it("cancelling frees the table", async () => {
    const theirs = await db.reservation.findFirstOrThrow({
      where: { id: { in: created }, clientId: other.id },
    });
    await cancelReservation(theirs.id, other);
    const again = await createReservation(input("18:00"), client);
    created.push(again.id);
    expect(again.tableId).toBe(tableId);
  });
});
