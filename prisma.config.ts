import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads env files itself. `.env.local` (Next.js convention)
// wins over `.env` so the CLI and the app point at the same database.
// Variables already set in the environment (e.g. on Vercel) are never overridden.
config({ path: ".env.local" });
config();

// The CLI (migrate, seed, studio) needs a direct connection: migrations take
// advisory locks that don't work through a transaction-mode pooler. Hosted
// Postgres (Neon via Vercel, Supabase…) exposes it separately; the app itself
// keeps using the pooled DATABASE_URL.
const cliUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: cliUrl,
  },
});
