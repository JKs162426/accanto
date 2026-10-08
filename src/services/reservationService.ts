import "server-only";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { PAGE_SIZE, RESERVATIONS_PER_HOUR_LIMIT } from "@/lib/constants";
import { defaultLocale, type Locale } from "@/i18n/config";
import { fromDbDate, generateReservationCode, toDbDate } from "@/lib/helpers";
import { intervalsOverlap, reservationInterval } from "@/lib/scheduling";
import type {
  AdminCreateReservationInput,
  AdminUpdateReservationInput,
  CreateReservationInput,
  UpdateReservationInput,
} from "@/lib/validation";
import type { Prisma, Reservation, Table } from "@/generated/prisma/client";
import type { ReservationStatus } from "@/generated/prisma/enums";
import type { Paginated, ReservationDTO, SessionUser } from "@/types";
import { assertBookableSlot, freeTablesFor, getBusyIntervals } from "./availabilityService";
import { enqueueReservationEmails, type ReservationChanges, type ReservationEmailEvent } from "./emailService";
import { getRestaurant, toSchedulingConfig, type RestaurantWithSchedule } from "./restaurantService";

type Tx = Prisma.TransactionClient;
type ReservationWithTable = Reservation & { table: Table };

export function toReservationDTO(r: ReservationWithTable, viewer?: Pick<SessionUser, "role">): ReservationDTO {
  return {
    id: r.id,
    code: r.code,
    date: fromDbDate(r.date),
    time: r.time,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    partySize: r.partySize,
    status: r.status,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    notes: r.notes,
    ...(viewer?.role === "ADMIN" ? { internalNotes: r.internalNotes } : {}),
    clientId: r.clientId,
    table: {
      id: r.table.id,
      number: r.table.number,
      capacity: r.table.capacity,
      location: r.table.location,
      type: r.table.type,
      isWindow: r.table.isWindow,
    },
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── Concurrency ───────────────────────────────────────────────────────

/**
 * Runs `fn` in a transaction holding a Postgres advisory lock per affected
 * service day. This is what prevents double bookings: two requests that both
 * see table 5 free at 21:00 can't interleave their "check → insert" — the
 * second waits for the first to commit, then sees its reservation and gets a
 * 409. Locking per day (not per table) also covers automatic table
 * reassignment. Locks are released automatically at commit/rollback, and are
 * taken in sorted order so two multi-day updates can't deadlock.
 */
async function withBookingLock<T>(restaurantId: string, dates: string[], fn: (tx: Tx) => Promise<T>): Promise<T> {
  const keys = [...new Set(dates)].sort().map((d) => `booking:${restaurantId}:${d}`);
  return db.$transaction(
    async (tx) => {
      for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}

async function uniqueCode(tx: Tx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateReservationCode();
    if (!(await tx.reservation.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not generate a unique reservation code");
}

async function assertTableFree(
  tx: Tx,
  restaurant: RestaurantWithSchedule,
  tableId: string,
  partySize: number,
  startsAt: Date,
  endsAt: Date,
  excludeReservationId?: string,
) {
  const table = await tx.table.findFirst({
    where: { id: tableId, restaurantId: restaurant.id, deletedAt: null },
  });
  if (!table) throw notFound("TABLE_NOT_FOUND");
  if (table.status !== "ACTIVE") {
    throw new AppError(409, "TABLE_OUT_OF_SERVICE");
  }
  if (table.capacity < partySize) {
    throw new AppError(422, "TABLE_TOO_SMALL", { number: table.number, capacity: table.capacity });
  }
  const busy = await getBusyIntervals(tx, restaurant.id, startsAt, endsAt, excludeReservationId);
  if (busy.some((b) => b.tableId === tableId && intervalsOverlap(b.startsAt, b.endsAt, startsAt, endsAt))) {
    throw new AppError(409, "TABLE_TAKEN");
  }
  return table;
}

async function notifyAdmins(
  tx: Tx,
  type: "NEW_RESERVATION" | "RESERVATION_MODIFIED" | "RESERVATION_CANCELLED",
  r: ReservationWithTable,
) {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  // Structured `data` lets the panel render the notification in the admin's
  // current language; subject/content are a plain-text fallback.
  const data = { code: r.code, guestName: r.guestName, date: fromDbDate(r.date), time: r.time, partySize: r.partySize, table: r.table.number };
  await tx.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type,
      subject: r.code,
      content: `${r.guestName} · ${data.date} ${r.time} · ${r.partySize} · #${r.table.number}`,
      data,
      href: `/admin/dashboard/reservations/${r.id}`,
    })),
  });
}

// ─── Create ────────────────────────────────────────────────────────────

export async function createReservation(
  input: CreateReservationInput | AdminCreateReservationInput,
  actor: SessionUser,
  locale: Locale = defaultLocale,
): Promise<ReservationWithTable> {
  const restaurant = await getRestaurant();
  const isAdmin = actor.role === "ADMIN";

  if (input.partySize > restaurant.maxPartySize && !isAdmin) {
    throw new AppError(422, "PARTY_TOO_LARGE", { max: restaurant.maxPartySize });
  }
  assertBookableSlot(restaurant, input.date, input.time);

  // Who the reservation belongs to: clients book for themselves; admins may
  // attach it to an existing client or leave it as a guest booking.
  let clientId: string | null = actor.id;
  if (isAdmin) {
    clientId = ("clientId" in input && input.clientId) || null;
    if (clientId && !(await db.user.findUnique({ where: { id: clientId }, select: { id: true } }))) {
      throw notFound("CLIENT_NOT_FOUND");
    }
    // Phone bookings for someone who already has an account show up in their history.
    if (!clientId) {
      const existing = await db.user.findFirst({
        where: { email: input.guestEmail, role: "CLIENT" },
        select: { id: true },
      });
      clientId = existing?.id ?? null;
    }
  } else {
    // Rate limit (enforced in the DB so it holds across serverless instances).
    const recent = await db.reservation.count({
      where: { clientId: actor.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= RESERVATIONS_PER_HOUR_LIMIT) {
      throw new AppError(429, "RESERVATIONS_RATE_LIMITED");
    }
  }

  // Clients can book under any name, but the confirmation always goes to the
  // account's own email — otherwise the booking form could be used to send
  // our emails to arbitrary addresses. Admins (phone bookings) set it freely.
  const guestEmail = isAdmin ? input.guestEmail : actor.email;

  const { startsAt, endsAt } = reservationInterval(input.date, input.time, toSchedulingConfig(restaurant));

  return withBookingLock(restaurant.id, [input.date], async (tx) => {
    await assertTableFree(tx, restaurant, input.tableId, input.partySize, startsAt, endsAt);
    const reservation = await tx.reservation.create({
      data: {
        code: await uniqueCode(tx),
        restaurantId: restaurant.id,
        clientId,
        tableId: input.tableId,
        date: toDbDate(input.date),
        time: input.time,
        startsAt,
        endsAt,
        partySize: input.partySize,
        locale,
        guestName: input.guestName,
        guestEmail,
        guestPhone: input.guestPhone ?? null,
        notes: input.notes ?? null,
        internalNotes: isAdmin && "internalNotes" in input ? (input.internalNotes ?? null) : null,
      },
      include: { table: true },
    });
    await tx.reservationHistory.create({
      data: {
        reservationId: reservation.id,
        actorId: actor.id,
        action: "CREATED",
        changes: { date: input.date, time: input.time, partySize: input.partySize, table: reservation.table.number },
      },
    });
    await enqueueReservationEmails(tx, reservation, restaurant, { kind: "created" });
    if (!isAdmin) await notifyAdmins(tx, "NEW_RESERVATION", reservation);
    return reservation;
  });
}

// ─── Read ──────────────────────────────────────────────────────────────

async function loadForActor(id: string, actor: SessionUser) {
  const reservation = await db.reservation.findUnique({ where: { id }, include: { table: true } });
  // Same 404 for "doesn't exist" and "not yours" so ids can't be probed.
  if (!reservation || (actor.role !== "ADMIN" && reservation.clientId !== actor.id)) {
    throw notFound("RESERVATION_NOT_FOUND");
  }
  return reservation;
}

export async function getReservation(id: string, actor: SessionUser) {
  return loadForActor(id, actor);
}

export async function getReservationHistory(id: string) {
  return db.reservationHistory.findMany({
    where: { reservationId: id },
    orderBy: { timestamp: "desc" },
    include: { actor: { select: { name: true, role: true } } },
  });
}

export interface ReservationFilters {
  q?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: ReservationStatus;
  scope?: "upcoming" | "past" | "all";
  page?: number;
  pageSize?: number;
  clientId?: string;
}

export async function listReservations(
  filters: ReservationFilters,
  actor: SessionUser,
): Promise<Paginated<ReservationWithTable>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const now = new Date();
  const where: Prisma.ReservationWhereInput = {};

  if (actor.role !== "ADMIN") where.clientId = actor.id;
  else if (filters.clientId) where.clientId = filters.clientId;

  if (filters.status) where.status = filters.status;
  if (filters.date) where.date = toDbDate(filters.date);
  else if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: toDbDate(filters.from) } : {}),
      ...(filters.to ? { lte: toDbDate(filters.to) } : {}),
    };
  }
  if (filters.scope === "upcoming") where.endsAt = { gt: now };
  if (filters.scope === "past") where.endsAt = { lte: now };
  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { guestName: { contains: q, mode: "insensitive" } },
      { guestEmail: { contains: q, mode: "insensitive" } },
      { guestPhone: { contains: q } },
    ];
  }

  const orderBy: Prisma.ReservationOrderByWithRelationInput =
    filters.scope === "past" ? { startsAt: "desc" } : { startsAt: "asc" };

  const [items, total] = await Promise.all([
    db.reservation.findMany({
      where,
      include: { table: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.reservation.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// ─── Update ────────────────────────────────────────────────────────────

function describeChanges(before: ReservationWithTable, after: ReservationWithTable): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const pairs: Array<[string, unknown, unknown]> = [
    ["date", fromDbDate(before.date), fromDbDate(after.date)],
    ["time", before.time, after.time],
    ["partySize", before.partySize, after.partySize],
    ["table", before.table.number, after.table.number],
    ["status", before.status, after.status],
    ["notes", before.notes, after.notes],
    ["internalNotes", before.internalNotes, after.internalNotes],
    ["guestName", before.guestName, after.guestName],
    ["guestPhone", before.guestPhone, after.guestPhone],
  ];
  for (const [field, from, to] of pairs) if (from !== to) changes[field] = { from, to };
  return changes;
}

/** Only these changes affect the guest's visit and trigger a "modified" email. */
const GUEST_VISIBLE_FIELDS = ["date", "time", "partySize", "table"] as const;

export async function updateReservation(
  id: string,
  input: UpdateReservationInput | AdminUpdateReservationInput,
  actor: SessionUser,
): Promise<ReservationWithTable> {
  const isAdmin = actor.role === "ADMIN";
  const before = await loadForActor(id, actor);
  const restaurant = await getRestaurant();

  if (!isAdmin) {
    if (before.status !== "CONFIRMED") {
      throw new AppError(409, "NOT_EDITABLE");
    }
    if (before.startsAt <= new Date()) {
      throw new AppError(409, "ALREADY_STARTED");
    }
  } else if (before.status === "CANCELLED") {
    throw new AppError(409, "NOT_EDITABLE_CANCELLED");
  }

  const date = input.date ?? fromDbDate(before.date);
  const time = input.time ?? before.time;
  const partySize = input.partySize ?? before.partySize;
  const requestedTable = "tableId" in input ? input.tableId : undefined;
  const slotChanged = date !== fromDbDate(before.date) || time !== before.time;
  const seatingChanged = slotChanged || partySize !== before.partySize || (requestedTable && requestedTable !== before.tableId);

  if (slotChanged) assertBookableSlot(restaurant, date, time);
  if (partySize > restaurant.maxPartySize && !isAdmin) {
    throw new AppError(422, "PARTY_TOO_LARGE", { max: restaurant.maxPartySize });
  }

  const { startsAt, endsAt } = reservationInterval(date, time, toSchedulingConfig(restaurant));

  const after = await withBookingLock(restaurant.id, [fromDbDate(before.date), date], async (tx) => {
    let tableId = requestedTable ?? before.tableId;
    if (seatingChanged) {
      try {
        await assertTableFree(tx, restaurant, tableId, partySize, startsAt, endsAt, id);
      } catch (error) {
        // A client can't pick tables when modifying: if their table no longer
        // works, move them to the best free table, preferring the same area.
        if (isAdmin || requestedTable || !(error instanceof AppError)) throw error;
        const { tables } = await freeTablesFor(tx, restaurant, date, time, partySize, { excludeReservationId: id });
        const replacement =
          tables.find((t) => t.location === before.table.location) ?? tables[0];
        if (!replacement) {
          throw new AppError(409, "NO_AVAILABILITY");
        }
        tableId = replacement.id;
      }
    }

    const data: Prisma.ReservationUncheckedUpdateInput = {
      date: toDbDate(date),
      time,
      startsAt,
      endsAt,
      partySize,
      tableId,
    };
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.guestPhone !== undefined) data.guestPhone = input.guestPhone;
    if (isAdmin) {
      const a = input as AdminUpdateReservationInput;
      if (a.internalNotes !== undefined) data.internalNotes = a.internalNotes;
      if (a.guestName !== undefined) data.guestName = a.guestName;
      if (a.status !== undefined) data.status = a.status;
    }

    const updated = await tx.reservation.update({ where: { id }, data, include: { table: true } });
    const changes = describeChanges(before, updated);
    if (Object.keys(changes).length === 0) return updated;

    const onlyStatus = Object.keys(changes).every((k) => k === "status");
    await tx.reservationHistory.create({
      data: {
        reservationId: id,
        actorId: actor.id,
        action: onlyStatus ? "STATUS_CHANGED" : "UPDATED",
        changes: changes as Prisma.InputJsonValue,
      },
    });
    const visible = Object.fromEntries(
      Object.entries(changes).filter(([k]) => (GUEST_VISIBLE_FIELDS as readonly string[]).includes(k)),
    ) as ReservationChanges;
    // Guests are emailed only about changes that affect their visit.
    if (Object.keys(visible).length > 0 && updated.status === "CONFIRMED") {
      const event: ReservationEmailEvent = { kind: "modified", changes: visible };
      await enqueueReservationEmails(tx, updated, restaurant, event);
      if (!isAdmin) await notifyAdmins(tx, "RESERVATION_MODIFIED", updated);
    }
    return updated;
  });
  return after;
}

// ─── Cancel ────────────────────────────────────────────────────────────

export async function cancelReservation(id: string, actor: SessionUser): Promise<ReservationWithTable> {
  const isAdmin = actor.role === "ADMIN";
  const before = await loadForActor(id, actor);
  if (before.status !== "CONFIRMED") {
    throw new AppError(409, "NOT_CANCELLABLE");
  }
  if (!isAdmin && before.startsAt <= new Date()) {
    throw new AppError(409, "ALREADY_STARTED");
  }
  const restaurant = await getRestaurant();
  return db.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: { table: true },
    });
    await tx.reservationHistory.create({
      data: { reservationId: id, actorId: actor.id, action: "CANCELLED", changes: { by: actor.role } },
    });
    await enqueueReservationEmails(tx, updated, restaurant, { kind: "cancelled", byAdmin: isAdmin });
    if (!isAdmin) await notifyAdmins(tx, "RESERVATION_CANCELLED", updated);
    return updated;
  });
}

// ─── Dashboard helpers ─────────────────────────────────────────────────

/** Reservations for one restaurant-local day, for the admin day view. */
export async function reservationsForDay(date: string) {
  return db.reservation.findMany({
    where: { date: toDbDate(date), status: { not: "CANCELLED" } },
    include: { table: true },
    orderBy: [{ time: "asc" }],
  });
}

/** Whether a client can still change/cancel (for UI affordances). */
export function isClientEditable(r: Pick<Reservation, "status" | "startsAt">, now = new Date()) {
  return r.status === "CONFIRMED" && r.startsAt > now;
}
