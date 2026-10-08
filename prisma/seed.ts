/**
 * Development fixtures. Run with `npm run db:seed`.
 *
 * WARNING: wipes tables, reservations, notifications and emails before
 * inserting. Refuses to run with NODE_ENV=production unless SEED_FORCE=1.
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ReservationStatus, type TableLocation, type TableType } from "../src/generated/prisma/client";
import { addDays, dayOfWeek, generateReservationCode, toDbDate, todayIn } from "../src/lib/helpers";
import { reservationInterval } from "../src/lib/scheduling";

config({ path: ".env.local" });
config();

if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
  console.error("Refusing to seed in production. Set SEED_FORCE=1 if you really mean it.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TIMEZONE = "Europe/Rome";
const TURNOVER = 120;
const OPEN_DAYS = [4, 5, 6, 0]; // Thursday → Sunday

async function main() {
  console.log("🌱 Seeding Accanto (Torino)…");

  // Children first (FK order).
  await db.reservationHistory.deleteMany();
  await db.reservation.deleteMany();
  await db.notification.deleteMany();
  await db.emailLog.deleteMany();
  await db.table.deleteMany();
  await db.openingHour.deleteMany();
  await db.closedDate.deleteMany();
  await db.restaurant.deleteMany();

  // ── Restaurant ──────────────────────────────────────────────────────
  const restaurant = await db.restaurant.create({
    data: {
      name: "Accanto",
      description:
        "Cucina di stagione, pasta fresca tirata ogni mattina e una carta dei vini piccola ma curata, con tanto Piemonte. Accanto: il tavolo di un amico, a due passi da Piazza Castello.",
      address: "Via Giuseppe Garibaldi 12, 10122 Torino",
      phone: "+39 011 000 0000",
      email: "ciao@accanto.local",
      timezone: TIMEZONE,
      turnoverMinutes: TURNOVER,
      slotIntervalMinutes: 30,
      bookingWindowDays: 60,
      maxPartySize: 8,
      avgSpendPerGuest: 45,
      openingHours: {
        create: OPEN_DAYS.flatMap((day) => [
          { dayOfWeek: day, shift: "LUNCH" as const, opensAt: "12:00", closesAt: "15:00" },
          { dayOfWeek: day, shift: "DINNER" as const, opensAt: "18:00", closesAt: "23:00" },
        ]),
      },
    },
  });

  // ── Tables ──────────────────────────────────────────────────────────
  const tableSpecs: Array<{ number: number; capacity: number; location: TableLocation; type: TableType; isWindow: boolean; notes?: string }> = [
    ...[1, 2, 3, 4].map((n) => ({ number: n, capacity: 4, location: "INTERIOR" as const, type: "STANDARD" as const, isWindow: false })),
    ...[5, 6, 7, 8].map((n) => ({ number: n, capacity: 4, location: "TERRACE" as const, type: "STANDARD" as const, isWindow: false })),
    ...[9, 10].map((n) => ({ number: n, capacity: 8, location: "PRIVATE" as const, type: "PRIVATE" as const, isWindow: false, notes: "Sala privata con porta scorrevole" })),
    ...[11, 12].map((n) => ({ number: n, capacity: 2, location: "INTERIOR" as const, type: "VIP" as const, isWindow: true, notes: "Accanto alla vetrata" })),
  ];
  const tables = new Map<number, string>();
  for (const spec of tableSpecs) {
    const t = await db.table.create({ data: { ...spec, restaurantId: restaurant.id } });
    tables.set(t.number, t.id);
  }

  // ── Users ───────────────────────────────────────────────────────────
  const user = async (email: string, password: string, name: string, phone: string, role: "ADMIN" | "CLIENT", extra = {}) =>
    db.user.upsert({
      where: { email },
      update: { name, phone, role, password: await bcrypt.hash(password, 12), ...extra },
      create: { email, name, phone, role, password: await bcrypt.hash(password, 12), ...extra },
    });

  const admin = await user("admin@accanto.local", "AdminPass123!", "Admin Accanto", "+39 333 000 0001", "ADMIN");
  const client1 = await user("client1@accanto.local", "ClientPass123!", "Giulia Romano", "+39 333 111 2222", "CLIENT", {
    adminNotes: "Preferisce il tavolo accanto alla finestra. Allergia alla frutta a guscio.",
    remind2h: true,
  });
  const client2 = await user("client2@accanto.local", "ClientPass123!", "Marco Bianchi", "+39 333 333 4444", "CLIENT", {
    adminNotes: "Prenota spesso per clienti di lavoro. Ama i rossi piemontesi.",
  });

  // ── Reservations ────────────────────────────────────────────────────
  // Anchor on real open days relative to today so fixtures always make sense.
  const today = todayIn(TIMEZONE);
  const openDays = (from: number, to: number) => {
    const days: string[] = [];
    for (let i = from; i <= to; i++) {
      const d = addDays(today, i);
      if (OPEN_DAYS.includes(dayOfWeek(d))) days.push(d);
    }
    return days;
  };
  const future = openDays(3, 28); // 2–4 weeks ahead
  const past = openDays(-14, -1);

  type Who = typeof client1 | null;
  type Spec = { day: string; time: string; party: number; table: number; who: Who; guest?: { name: string; email: string; phone?: string }; status?: ReservationStatus; notes?: string; locale?: "it" | "en" };

  const allSpecs: Spec[] = [
    // Upcoming
    { day: future[0], time: "13:00", party: 2, table: 11, who: client1, notes: "Anniversario 🎉" },
    { day: future[0], time: "21:00", party: 4, table: 5, who: client2 },
    { day: future[1], time: "12:30", party: 3, table: 1, who: client1 },
    { day: future[2], time: "20:00", party: 7, table: 9, who: client2, notes: "Compleanno, portiamo noi la torta" },
    { day: future[3], time: "19:00", party: 2, table: 12, who: null, guest: { name: "Chiara Ferri", email: "chiara.ferri@example.com", phone: "+39 347 222 3333" }, locale: "en" },
    { day: future[4], time: "20:30", party: 4, table: 6, who: client1, notes: "Un seggiolone per il bambino, per favore" },
    { day: future[5], time: "13:00", party: 4, table: 2, who: client2 },
    { day: future[6], time: "21:00", party: 2, table: 11, who: client1 },
    { day: future[1], time: "20:00", party: 4, table: 3, who: client2, status: "CANCELLED" },
    // Past
    { day: past[0], time: "20:00", party: 2, table: 11, who: client1, status: "ATTENDED" },
    { day: past[1], time: "13:00", party: 4, table: 5, who: client2, status: "ATTENDED" },
    { day: past[2], time: "21:00", party: 6, table: 10, who: client1, status: "ATTENDED", notes: "Cena aziendale" },
    { day: past[3], time: "19:30", party: 2, table: 12, who: client2, status: "NO_SHOW" },
    { day: past[4], time: "12:00", party: 3, table: 4, who: null, guest: { name: "Luca Moretti", email: "luca.moretti@example.com" }, status: "ATTENDED" },
    { day: past[5], time: "20:30", party: 4, table: 7, who: client1, status: "CANCELLED" },
    { day: past[6], time: "13:00", party: 2, table: 1, who: client2, status: "ATTENDED" },
  ];
  const specs = allSpecs.filter((s) => s.day); // guard if the calendar yields fewer open days

  for (const s of specs) {
    const { startsAt, endsAt } = reservationInterval(s.day, s.time, { timezone: TIMEZONE, turnoverMinutes: TURNOVER });
    const status = s.status ?? "CONFIRMED";
    const createdAt = new Date(startsAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    await db.reservation.create({
      data: {
        code: generateReservationCode(),
        restaurantId: restaurant.id,
        clientId: s.who?.id ?? null,
        tableId: tables.get(s.table)!,
        date: toDbDate(s.day),
        time: s.time,
        startsAt,
        endsAt,
        partySize: s.party,
        locale: s.locale ?? "it",
        status,
        guestName: s.who?.name ?? s.guest!.name,
        guestEmail: s.who?.email ?? s.guest!.email,
        guestPhone: s.who?.phone ?? s.guest?.phone ?? null,
        notes: s.notes ?? null,
        cancelledAt: status === "CANCELLED" ? createdAt : null,
        createdAt,
        history: {
          create: [
            { action: "CREATED", actorId: s.who?.id ?? admin.id, timestamp: createdAt, changes: { date: s.day, time: s.time, partySize: s.party } },
            ...(status !== "CONFIRMED"
              ? [{ action: status === "CANCELLED" ? ("CANCELLED" as const) : ("STATUS_CHANGED" as const), actorId: admin.id, changes: { status: { from: "CONFIRMED", to: status } } }]
              : []),
          ],
        },
      },
    });
  }

  await db.notification.createMany({
    data: [
      // subject "welcome" + no data → the panel renders the localized welcome text.
      { userId: admin.id, type: "NEW_RESERVATION", subject: "welcome", content: "Benvenuto nel pannello di Accanto", href: "/admin/dashboard/reservations" },
    ],
  });

  const counts = await db.reservation.groupBy({ by: ["status"], _count: { _all: true } });
  console.log(`✅ Restaurant, ${tables.size} tables, 3 users, ${specs.length} reservations`);
  console.table(counts.map((c) => ({ status: c.status, count: c._count._all })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
