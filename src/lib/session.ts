/**
 * Session token signing/verification. Kept free of `next/headers` and the
 * database so it can run in the Proxy (src/proxy.ts) as well as on the server.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";
import { SESSION_TTL_SECONDS } from "./constants";

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  name: string;
  /** User.sessionVersion at sign-in; a password change bumps it and voids older tokens. */
  v: number;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, v: payload.v })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Returns null for missing, tampered or expired tokens — never throws. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || (payload.role !== "ADMIN" && payload.role !== "CLIENT")) return null;
    return { sub: payload.sub, role: payload.role, name: String(payload.name ?? ""), v: Number(payload.v ?? 0) };
  } catch {
    return null;
  }
}
