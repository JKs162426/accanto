import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "./constants";
import { signSession, verifySession } from "./session";
import type { SessionUser } from "@/types";
import { localePath, type Locale } from "@/i18n/config";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Issue the session cookie. `sessionVersion` must be the user's current DB value. */
export async function startSession(user: SessionUser, sessionVersion: number): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name, v: sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax: the cookie is not sent on cross-site POST/PATCH/DELETE, which
    // together with the Origin check in the proxy protects against CSRF.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Current user, or null. The JWT is only a pointer: the user is re-read from
 * the database so deleted users and role changes take effect immediately, and
 * tokens issued before the last password change (older sessionVersion) are
 * rejected. Memoised per request with React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // The session check reads the clock (JWT expiry), so it is request-time
  // only; this keeps it out of any prerender (Cache Components).
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, phone: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.v) return null;
  const { sessionVersion: _v, ...rest } = user;
  void _v;
  return rest;
});

/** For pages: redirect to the localized login when there is no session. */
export async function requireUser(lang: Locale, next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const login = localePath(lang, "/login");
    redirect(next ? `${login}?next=${encodeURIComponent(localePath(lang, next))}` : login);
  }
  return user;
}

/** For admin pages. */
export async function requireAdmin(lang: Locale): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(localePath(lang, "/admin/login"));
  if (user.role !== "ADMIN") redirect(localePath(lang, "/admin/unauthorized"));
  return user;
}
