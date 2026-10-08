import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// One PrismaClient (and therefore one connection pool) per server process.
// In development, hot reloads re-evaluate this module, so the instance is
// parked on globalThis to avoid leaking a pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // `prisma dev` (local PGlite) serves a single session: set DATABASE_POOL_MAX=1
    // there. On Vercel keep it small — each serverless instance has its own pool.
    max: Number(process.env.DATABASE_POOL_MAX) || (process.env.NODE_ENV === "production" ? 5 : 10),
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
