import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  findAvailableTables,
  getDaySchedule,
  reservationInterval,
  type BusyInterval,
  type DaySchedule,
} from "@/lib/scheduling";
import type { SeatingPreference } from "@/lib/constants";
import type { AvailabilityDTO } from "@/types";
import type { Prisma } from "@/generated/prisma/client";
import { getRestaurant, scheduleInputs, toSchedulingConfig, type RestaurantWithSchedule } from "./restaurantService";
import { toPublicTableDTO } from "./tableService";

type Tx = Prisma.TransactionClient;

/** Statuses that keep a table blocked. Cancelled and no-show free it up. */
export const BLOCKING_STATUSES = ["CONFIRMED", "ATTENDED"] as const;

/** A user-facing notice as an i18n error code + params, translated at the API boundary. */
export interface Notice {
  code: string;
  params?: Record<string, string | number>;
}

function rejectionNotice(schedule: DaySchedule): Notice {
  if (schedule.rejection === "CLOSED_DATE" && schedule.closedReason) {
    return { code: "CLOSED_DATE_REASON", params: { reason: schedule.closedReason } };
  }
  return { code: schedule.rejection! };
}

export function scheduleFor(restaurant: RestaurantWithSchedule, date: string, now = new Date()) {
  const { hours, closedDates } = scheduleInputs(restaurant);
  return getDaySchedule(date, toSchedulingConfig(restaurant), hours, closedDates, now);
}

/**
 * Throws a 422 unless `date`+`time` is a bookable slot right now.
 * Shared by availability search and reservation create/update so the rules
 * can't drift apart.
 */
export function assertBookableSlot(restaurant: RestaurantWithSchedule, date: string, time: string) {
  const schedule = scheduleFor(restaurant, date);
  if (!schedule.open) {
    const notice = rejectionNotice(schedule);
    throw new AppError(422, notice.code, notice.params);
  }
  if (!schedule.slots.some((s) => s.time === time)) {
    throw new AppError(422, "INVALID_TIME");
  }
}

export async function getBusyIntervals(
  client: Tx | typeof db,
  restaurantId: string,
  startsAt: Date,
  endsAt: Date,
  excludeReservationId?: string,
): Promise<BusyInterval[]> {
  return client.reservation.findMany({
    where: {
      restaurantId,
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { tableId: true, startsAt: true, endsAt: true },
  });
}

/** Free tables for an interval, read inside the caller's transaction. */
export async function freeTablesFor(
  client: Tx | typeof db,
  restaurant: RestaurantWithSchedule,
  date: string,
  time: string,
  partySize: number,
  options: { preference?: SeatingPreference | null; excludeReservationId?: string } = {},
) {
  const interval = reservationInterval(date, time, toSchedulingConfig(restaurant));
  const [tables, busy] = await Promise.all([
    client.table.findMany({ where: { restaurantId: restaurant.id, deletedAt: null } }),
    getBusyIntervals(client, restaurant.id, interval.startsAt, interval.endsAt, options.excludeReservationId),
  ]);
  return {
    ...interval,
    tables: findAvailableTables(tables, busy, { ...interval, partySize, preference: options.preference }),
  };
}

export interface AvailabilityResult extends Omit<AvailabilityDTO, "message"> {
  notice?: Notice;
}

/**
 * Public availability query: which slots exist for a date (with free-table
 * counts) and — when a time is given — which tables are free at that time.
 */
export async function getAvailability(query: {
  date: string;
  time?: string;
  partySize: number;
  preference?: string | null;
  excludeReservationId?: string;
}): Promise<AvailabilityResult> {
  const restaurant = await getRestaurant();
  if (query.partySize > restaurant.maxPartySize) {
    return {
      date: query.date,
      open: false,
      slots: [],
      notice: {
        code: "PARTY_TOO_LARGE_CALL",
        params: { max: restaurant.maxPartySize, phone: restaurant.phone ? ` ${restaurant.phone}` : "" },
      },
    };
  }
  const schedule = scheduleFor(restaurant, query.date);
  if (!schedule.open) {
    return { date: query.date, open: false, slots: [], notice: rejectionNotice(schedule) };
  }
  if (schedule.slots.length === 0) {
    return { date: query.date, open: false, slots: [], notice: { code: "NO_SLOTS_LEFT_TODAY" } };
  }
  // One query for the whole service day, then count free tables per slot in memory.
  const config = toSchedulingConfig(restaurant);
  const preference = (query.preference as SeatingPreference | null) ?? null;
  const intervals = schedule.slots.map((s) => ({ ...s, ...reservationInterval(query.date, s.time, config) }));
  const [tables, busy] = await Promise.all([
    db.table.findMany({ where: { restaurantId: restaurant.id, deletedAt: null }, orderBy: { number: "asc" } }),
    getBusyIntervals(db, restaurant.id, intervals[0].startsAt, intervals[intervals.length - 1].endsAt, query.excludeReservationId),
  ]);
  const freeAt = (i: (typeof intervals)[number]) =>
    findAvailableTables(tables, busy, { startsAt: i.startsAt, endsAt: i.endsAt, partySize: query.partySize, preference });

  const result: AvailabilityResult = {
    date: query.date,
    open: true,
    slots: intervals.map((i) => ({ time: i.time, shift: i.shift, free: freeAt(i).length })),
  };
  if (query.time) {
    const slot = intervals.find((i) => i.time === query.time);
    result.time = query.time;
    if (!slot) return { ...result, tables: [], notice: { code: "INVALID_TIME" } };
    result.tables = freeAt(slot).map(toPublicTableDTO);
  }
  if (result.slots.every((s) => s.free === 0)) result.notice = { code: "NO_TABLES_DAY" };
  return result;
}
