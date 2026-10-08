import "server-only";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import type { Table } from "@/generated/prisma/client";
import type { PublicTableDTO, TableDTO } from "@/types";
import type { TableInput } from "@/lib/validation";
import { getRestaurant } from "./restaurantService";

export function toTableDTO(t: Table): TableDTO {
  return {
    id: t.id,
    number: t.number,
    capacity: t.capacity,
    location: t.location,
    type: t.type,
    isWindow: t.isWindow,
    status: t.status,
    notes: t.notes,
  };
}

/** Guest-facing table: internal notes stay private to staff. */
export function toPublicTableDTO(t: Table): PublicTableDTO {
  const { notes: _notes, ...rest } = toTableDTO(t);
  void _notes;
  return rest;
}

export type LiveTableState = "FREE" | "OCCUPIED" | "RESERVED_SOON" | "OUT_OF_SERVICE";

export interface TableWithLiveState extends TableDTO {
  liveState: LiveTableState;
  /** Reservation currently seated/booked at this table, if any. */
  current: { id: string; code: string; guestName: string; time: string; partySize: number } | null;
  /** Next confirmed reservation today. */
  next: { id: string; code: string; guestName: string; time: string; partySize: number } | null;
}

const SOON_MS = 60 * 60 * 1000;

/** All tables plus their real-time state (occupied now / booked within the hour). */
export async function listTablesWithState(now = new Date()): Promise<TableWithLiveState[]> {
  const restaurant = await getRestaurant();
  const endOfWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [tables, reservations] = await Promise.all([
    db.table.findMany({
      where: { restaurantId: restaurant.id, deletedAt: null },
      orderBy: { number: "asc" },
    }),
    db.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["CONFIRMED", "ATTENDED"] },
        endsAt: { gt: now },
        startsAt: { lt: endOfWindow },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, code: true, guestName: true, time: true, partySize: true, tableId: true, startsAt: true },
    }),
  ]);

  return tables.map((t) => {
    const own = reservations.filter((r) => r.tableId === t.id);
    const current = own.find((r) => r.startsAt <= now) ?? null;
    const next = own.find((r) => r.startsAt > now) ?? null;
    let liveState: LiveTableState = "FREE";
    if (t.status === "OUT_OF_SERVICE") liveState = "OUT_OF_SERVICE";
    else if (current) liveState = "OCCUPIED";
    else if (next && next.startsAt.getTime() - now.getTime() <= SOON_MS) liveState = "RESERVED_SOON";
    const pick = (r: (typeof own)[number] | null) =>
      r && { id: r.id, code: r.code, guestName: r.guestName, time: r.time, partySize: r.partySize };
    return { ...toTableDTO(t), liveState, current: pick(current), next: pick(next) };
  });
}

export async function listTables(): Promise<TableDTO[]> {
  const restaurant = await getRestaurant();
  const tables = await db.table.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null },
    orderBy: { number: "asc" },
  });
  return tables.map(toTableDTO);
}

export async function getTable(id: string) {
  const table = await db.table.findFirst({ where: { id, deletedAt: null } });
  if (!table) throw notFound("TABLE_NOT_FOUND");
  return table;
}

async function assertNumberFree(restaurantId: string, number: number, exceptId?: string) {
  const clash = await db.table.findFirst({
    where: { restaurantId, number, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash) {
    throw new AppError(409, "TABLE_NUMBER_TAKEN", { number }, { fieldErrors: { number: ["NUMBER_IN_USE"] } });
  }
}

export async function createTable(input: TableInput) {
  const restaurant = await getRestaurant();
  await assertNumberFree(restaurant.id, input.number);
  const table = await db.table.create({ data: { ...input, restaurantId: restaurant.id } });
  return toTableDTO(table);
}

export async function updateTable(id: string, input: Partial<TableInput>) {
  const table = await getTable(id);
  if (input.number !== undefined && input.number !== table.number) {
    await assertNumberFree(table.restaurantId, input.number, id);
  }
  if (input.capacity !== undefined && input.capacity < table.capacity) {
    const tooBig = await db.reservation.count({
      where: {
        tableId: id,
        status: "CONFIRMED",
        startsAt: { gt: new Date() },
        partySize: { gt: input.capacity },
      },
    });
    if (tooBig > 0) {
      throw new AppError(409, "CAPACITY_CONFLICT", { n: tooBig });
    }
  }
  return toTableDTO(await db.table.update({ where: { id }, data: input }));
}

/**
 * Tables with history are archived (soft delete) so past reservations and
 * reports keep their table reference. Tables with upcoming bookings can't be
 * removed at all — the admin has to move those reservations first.
 */
export async function deleteTable(id: string): Promise<{ archived: boolean }> {
  await getTable(id);
  const upcoming = await db.reservation.count({
    where: { tableId: id, status: "CONFIRMED", startsAt: { gt: new Date() } },
  });
  if (upcoming > 0) {
    throw new AppError(409, "TABLE_HAS_RESERVATIONS", { n: upcoming });
  }
  const any = await db.reservation.count({ where: { tableId: id } });
  if (any === 0) {
    await db.table.delete({ where: { id } });
    return { archived: false };
  }
  await db.table.update({ where: { id }, data: { deletedAt: new Date(), status: "OUT_OF_SERVICE" } });
  return { archived: true };
}
