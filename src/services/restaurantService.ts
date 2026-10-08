import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { RESTAURANT_CACHE_TAG } from "@/lib/constants";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { fromDbDate, toDbDate } from "@/lib/helpers";
import type { SchedulingConfig, OpeningHourLike } from "@/lib/scheduling";
import type { RestaurantSettingsInput } from "@/lib/validation";

/**
 * Accanto is a single-restaurant deployment: the first Restaurant row is "the"
 * restaurant. The schema keeps restaurantId on every entity so multi-venue
 * support is a data change, not a migration.
 */
export async function getRestaurant() {
  const restaurant = await db.restaurant.findFirst({
    include: {
      openingHours: { orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] },
      closedDates: { orderBy: { date: "asc" } },
    },
  });
  if (!restaurant) {
    throw new AppError(503, "NOT_CONFIGURED");
  }
  return restaurant;
}

export type RestaurantWithSchedule = Awaited<ReturnType<typeof getRestaurant>>;

export function toSchedulingConfig(r: RestaurantWithSchedule): SchedulingConfig {
  return {
    timezone: r.timezone,
    turnoverMinutes: r.turnoverMinutes,
    slotIntervalMinutes: r.slotIntervalMinutes,
    bookingWindowDays: r.bookingWindowDays,
    maxPartySize: r.maxPartySize,
  };
}

export function scheduleInputs(r: RestaurantWithSchedule): {
  hours: OpeningHourLike[];
  closedDates: Array<{ date: string; reason: string | null }>;
} {
  return {
    hours: r.openingHours,
    closedDates: r.closedDates.map((c) => ({ date: fromDbDate(c.date), reason: c.reason })),
  };
}

/** Public, serializable restaurant info (landing page, email footers, settings form). */
export function toRestaurantDTO(r: RestaurantWithSchedule) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    address: r.address,
    phone: r.phone,
    email: r.email,
    timezone: r.timezone,
    turnoverMinutes: r.turnoverMinutes,
    slotIntervalMinutes: r.slotIntervalMinutes,
    bookingWindowDays: r.bookingWindowDays,
    maxPartySize: r.maxPartySize,
    avgSpendPerGuest: Number(r.avgSpendPerGuest),
    openingHours: r.openingHours.map(({ dayOfWeek, shift, opensAt, closesAt }) => ({
      dayOfWeek,
      shift,
      opensAt,
      closesAt,
    })),
    closedDates: r.closedDates.map((c) => ({ id: c.id, date: fromDbDate(c.date), reason: c.reason })),
  };
}

export type RestaurantDTO = ReturnType<typeof toRestaurantDTO>;

export async function updateRestaurant(input: RestaurantSettingsInput) {
  const restaurant = await getRestaurant();
  const { openingHours, ...fields } = input;

  if (openingHours) {
    const keys = openingHours.map((h) => `${h.dayOfWeek}-${h.shift}`);
    if (new Set(keys).size !== keys.length) {
      throw new AppError(400, "DUPLICATE_SHIFT");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.restaurant.update({ where: { id: restaurant.id }, data: fields });
    if (openingHours) {
      // Replace the whole weekly schedule: simpler and atomic.
      await tx.openingHour.deleteMany({ where: { restaurantId: restaurant.id } });
      await tx.openingHour.createMany({
        data: openingHours.map((h) => ({ ...h, restaurantId: restaurant.id })),
      });
    }
  });
  return toRestaurantDTO(await getRestaurant());
}

export async function addClosedDate(date: string, reason?: string | null) {
  const restaurant = await getRestaurant();
  return db.closedDate.upsert({
    where: { restaurantId_date: { restaurantId: restaurant.id, date: toDbDate(date) } },
    create: { restaurantId: restaurant.id, date: toDbDate(date), reason: reason ?? null },
    update: { reason: reason ?? null },
  });
}

export async function removeClosedDate(id: string) {
  await db.closedDate.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "DATE_NOT_FOUND");
  });
}

/**
 * Cached public restaurant info for the landing page and the reserve page's
 * static shell. Invalidated with revalidateTag(RESTAURANT_CACHE_TAG) whenever
 * an admin saves settings or closed dates.
 */
export async function getCachedRestaurant(): Promise<RestaurantDTO> {
  "use cache";
  cacheTag(RESTAURANT_CACHE_TAG);
  cacheLife("hours");
  return toRestaurantDTO(await getRestaurant());
}
