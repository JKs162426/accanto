import "server-only";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/generated/prisma/client";
import type { Paginated, SessionUser } from "@/types";
import type { RegisterInput } from "@/lib/validation";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
} as const satisfies Prisma.UserSelect;

export async function registerUser(input: RegisterInput): Promise<SessionUser & { sessionVersion: number }> {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new AppError(409, "EMAIL_TAKEN", {}, { fieldErrors: { email: ["EMAIL_TAKEN"] } });
  }
  try {
    return await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone ?? null,
        password: await hashPassword(input.password),
      },
      select: { ...publicUserSelect, sessionVersion: true },
    });
  } catch (error) {
    // Two simultaneous sign-ups with the same email: the unique index decides.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_TAKEN", {}, { fieldErrors: { email: ["EMAIL_TAKEN"] } });
    }
    throw error;
  }
}

// Compared against when the email doesn't exist, so a login attempt takes the
// same time either way and response timing doesn't reveal registered emails.
const DUMMY_HASH = "$2b$12$3ZN/aydkGTEnT46pXvja4O7tKzjjqfujJ5V1LpJvVVYUWJfcGr/gy";

export async function authenticate(
  email: string,
  password: string,
): Promise<(SessionUser & { sessionVersion: number }) | null> {
  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, sessionVersion: user.sessionVersion };
}

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, remind24h: true, remind2h: true, createdAt: true },
  });
  if (!user) throw notFound("USER_NOT_FOUND");
  return user;
}

export type Profile = Awaited<ReturnType<typeof getProfile>>;

export async function updateProfile(
  userId: string,
  input: { name?: string; phone?: string | null; remind24h?: boolean; remind2h?: boolean },
) {
  await db.user.update({ where: { id: userId }, data: input });
  return getProfile(userId);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("USER_NOT_FOUND");
  if (!(await verifyPassword(currentPassword, user.password))) {
    throw new AppError(400, "WRONG_PASSWORD", {}, { fieldErrors: { currentPassword: ["WRONG_PASSWORD"] } });
  }
  // Bumping sessionVersion signs out every other device holding an old token.
  const updated = await db.user.update({
    where: { id: userId },
    data: { password: await hashPassword(newPassword), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return updated.sessionVersion;
}

// ─── Admin: clients ────────────────────────────────────────────────────

export interface ClientSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  totalReservations: number;
  lastVisit: Date | null;
}

export async function listClients(params: { q?: string; page?: number }): Promise<Paginated<ClientSummary>> {
  const page = params.page ?? 1;
  const where: Prisma.UserWhereInput = { role: "CLIENT" };
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q } },
    ];
  }
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { reservations: true } },
        reservations: {
          where: { status: "ATTENDED" },
          orderBy: { startsAt: "desc" },
          take: 1,
          select: { startsAt: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.createdAt,
      totalReservations: u._count.reservations,
      lastVisit: u.reservations[0]?.startsAt ?? null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getClient(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: { ...publicUserSelect, adminNotes: true, createdAt: true, remind24h: true, remind2h: true },
  });
  if (!user) throw notFound("CLIENT_NOT_FOUND");
  const stats = await db.reservation.groupBy({
    by: ["status"],
    where: { clientId: id },
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(stats.map((s) => [s.status, s._count._all])) as Record<string, number>;
  return { ...user, stats: byStatus };
}

export async function adminUpdateUser(
  id: string,
  input: { adminNotes?: string | null; phone?: string | null; name?: string },
) {
  await db.user.update({ where: { id }, data: input }).catch(() => {
    throw notFound("CLIENT_NOT_FOUND");
  });
  return getClient(id);
}

/** Lookup used by the admin "new reservation" form to attach a client. */
export async function findClientByEmail(email: string) {
  return db.user.findUnique({ where: { email: email.toLowerCase() }, select: publicUserSelect });
}
