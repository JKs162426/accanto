import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads env files itself. `.env.local` (Next.js convention)
// wins over `.env` so the CLI and the app point at the same database.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
