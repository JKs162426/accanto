import "server-only";
import { db } from "@/lib/db";
import { addDays, dayOfWeek, fromDbDate, timeToMinutes, toCsv, toDbDate, todayIn } from "@/lib/helpers";
import { getDictionary, type Locale } from "@/i18n";
import { getRestaurant, scheduleInputs, type RestaurantWithSchedule } from "./restaurantService";

/** One point of a time series. */
export interface SeriesPoint {
  label: string;
  value: number;
}

async function reservationsBetween(restaurantId: string, from: string, to: string) {
  return db.reservation.findMany({
    where: { restaurantId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    select: {
      id: true,
      date: true,
      time: true,
      partySize: true,
      status: true,
      clientId: true,
      guestName: true,
      guestEmail: true,
    },
  });
}

/**
 * Bookable "table turns" between two dates: for every open day, each active
 * table can be turned floor(shift length / turnover) times per shift.
 * Occupancy = booked turns (confirmed + attended) / bookable turns.
 */
function capacityTurns(restaurant: RestaurantWithSchedule, activeTables: number, from: string, to: string) {
  const { hours, closedDates } = scheduleInputs(restaurant);
  const closed = new Set(closedDates.map((c) => c.date));
  let turns = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (closed.has(d)) continue;
    for (const h of hours.filter((x) => x.dayOfWeek === dayOfWeek(d))) {
      turns += Math.floor((timeToMinutes(h.closesAt) - timeToMinutes(h.opensAt)) / restaurant.turnoverMinutes);
    }
  }
  return turns * activeTables;
}

const isSeated = (s: string) => s === "CONFIRMED" || s === "ATTENDED";

function hourSeries(rows: Array<{ time: string; status: string }>): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    const hour = `${r.time.slice(0, 2)}:00`;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

function daySeries(rows: Array<{ date: Date; status: string }>, from: string, to: string): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    const d = fromDbDate(r.date);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const series: SeriesPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) series.push({ label: d, value: counts.get(d) ?? 0 });
  return series;
}

const CSV_KEYS = ["code", "date", "time", "party_size", "status", "table", "area", "guest_name", "guest_email", "guest_phone", "notes", "internal_notes", "created_at"];

// ─── Dashboard ─────────────────────────────────────────────────────────

export async function getDashboardSummary(now = new Date()) {
  const restaurant = await getRestaurant();
  const today = todayIn(restaurant.timezone, now);
  // ISO week: Monday → Sunday.
  const weekStart = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = addDays(`${addDays(monthStart, 32).slice(0, 8)}01`, -1);
  const upcomingEnd = addDays(today, 13);

  const rangeStart = monthStart < weekStart ? monthStart : weekStart;
  const rangeEndCandidates = [weekEnd, monthEnd, upcomingEnd].sort();
  const rows = await reservationsBetween(restaurant.id, rangeStart, rangeEndCandidates[2]);

  const count = (from: string, to: string) =>
    rows.filter((r) => isSeated(r.status) || r.status === "NO_SHOW")
      .filter((r) => {
        const d = fromDbDate(r.date);
        return d >= from && d <= to;
      }).length;

  const todayRows = rows.filter((r) => fromDbDate(r.date) === today && r.status !== "CANCELLED");

  const [activeTables, occupiedNow, unread] = await Promise.all([
    db.table.count({ where: { restaurantId: restaurant.id, deletedAt: null, status: "ACTIVE" } }),
    db.reservation.count({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["CONFIRMED", "ATTENDED"] },
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    }),
    db.notification.count({ where: { read: false, user: { role: "ADMIN" } } }),
  ]);

  return {
    today,
    counts: {
      today: todayRows.length,
      week: count(weekStart, weekEnd),
      month: count(monthStart, monthEnd),
      coversToday: todayRows.reduce((sum, r) => sum + r.partySize, 0),
    },
    occupancyNow: { occupied: occupiedNow, total: activeTables },
    todayByHour: hourSeries(todayRows),
    upcomingByDay: daySeries(rows, today, upcomingEnd),
    unreadNotifications: unread,
  };
}

// ─── Reports ───────────────────────────────────────────────────────────

export async function getReport(from: string, to: string) {
  const restaurant = await getRestaurant();
  const [rows, activeTables] = await Promise.all([
    reservationsBetween(restaurant.id, from, to),
    db.table.count({ where: { restaurantId: restaurant.id, deletedAt: null, status: "ACTIVE" } }),
  ]);

  const byStatus = { CONFIRMED: 0, ATTENDED: 0, NO_SHOW: 0, CANCELLED: 0 } as Record<string, number>;
  for (const r of rows) byStatus[r.status]++;

  const total = rows.length;
  const booked = byStatus.CONFIRMED + byStatus.ATTENDED;
  const turns = capacityTurns(restaurant, activeTables, from, to);
  const avgSpend = Number(restaurant.avgSpendPerGuest);
  const coversAttended = rows.filter((r) => r.status === "ATTENDED").reduce((s, r) => s + r.partySize, 0);
  const coversExpected = rows.filter((r) => isSeated(r.status)).reduce((s, r) => s + r.partySize, 0);
  // No-show rate only makes sense over reservations whose outcome is known.
  const resolved = byStatus.ATTENDED + byStatus.NO_SHOW;

  const frequent = new Map<string, { key: string; name: string; email: string; clientId: string | null; visits: number; reservations: number }>();
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    const key = r.clientId ?? r.guestEmail;
    const entry = frequent.get(key) ?? { key, name: r.guestName, email: r.guestEmail, clientId: r.clientId, visits: 0, reservations: 0 };
    entry.reservations++;
    if (r.status === "ATTENDED") entry.visits++;
    frequent.set(key, entry);
  }

  return {
    from,
    to,
    total,
    byStatus,
    occupancy: turns > 0 ? booked / turns : 0,
    bookedTurns: booked,
    availableTurns: turns,
    coversAttended,
    coversExpected,
    avgSpendPerGuest: avgSpend,
    revenueEstimated: coversAttended * avgSpend,
    revenueProjected: coversExpected * avgSpend,
    cancellationRate: total > 0 ? byStatus.CANCELLED / total : 0,
    noShowRate: resolved > 0 ? byStatus.NO_SHOW / resolved : 0,
    frequentClients: [...frequent.values()]
      .sort((a, b) => b.reservations - a.reservations || b.visits - a.visits)
      .slice(0, 10),
    byDay: daySeries(rows, from, to),
    byHour: hourSeries(rows),
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;

export async function exportReservationsCsv(from: string, to: string, locale: Locale): Promise<string> {
  const restaurant = await getRestaurant();
  const t = getDictionary(locale);
  const rows = await db.reservation.findMany({
    where: { restaurantId: restaurant.id, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    include: { table: true },
    orderBy: { startsAt: "asc" },
  });
  return toCsv(
    rows.map((r) => ({
      code: r.code,
      date: fromDbDate(r.date),
      time: r.time,
      party_size: r.partySize,
      status: t.enums.reservationStatus[r.status],
      table: r.table.number,
      area: t.enums.location[r.table.location],
      guest_name: r.guestName,
      guest_email: r.guestEmail,
      guest_phone: r.guestPhone,
      notes: r.notes,
      internal_notes: r.internalNotes,
      created_at: r.createdAt.toISOString(),
    })),
    CSV_KEYS,
    t.csv.headers,
  );
}
