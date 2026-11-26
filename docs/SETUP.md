# Setup and environment

## 1. Dependencies

```bash
npm install   # postinstall runs `prisma generate`
```

The Prisma client is generated in `src/generated/prisma/`, which is not in git. Run `npx prisma generate` again whenever `prisma/schema.prisma` changes.

## 2. Database

### Option A: `prisma dev` (no Docker)

```bash
npm run db:start      # starts a local instance named "accanto-local" and prints its URL
```

The URL looks like `postgres://postgres:postgres@localhost:<port>/template1?sslmode=disable`. Put it in `.env.local`:

```env
DATABASE_URL="<the URL printed by db:start>"
DATABASE_POOL_MAX="1"   # prisma dev accepts one session at a time
```

`npm run db:stop` stops it. The data survives restarts.

### Option B: your own PostgreSQL

Any PostgreSQL 14 or later works (Homebrew, Docker, Neon…). Put its URL in `DATABASE_URL` and leave `DATABASE_POOL_MAX` empty.

### Migrations and test data

```bash
npx prisma migrate deploy   # applies the migrations in prisma/migrations/
npm run db:seed             # test data; DELETES reservations, tables, notifications and emails
```

To change the schema, edit `prisma/schema.prisma` and run `npm run db:migrate -- --name describe_the_change`. Migrations are committed in `prisma/migrations/`.

`npm run db:migrate` runs `prisma migrate dev`, which needs a shadow database. The `prisma dev` URL cannot provide one, so the command fails there with `P3005` and leaves the database half-migrated. Create new migrations against your own PostgreSQL (Option B). Use `migrate deploy` to apply them to `prisma dev`.

## 3. Secrets

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 16      # CRON_SECRET
```

## 4. Emails

| Environment | Configuration                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Development | Leave `RESEND_API_KEY` and `EMAIL_HOST` empty. Emails print in the `npm run dev` console (📧 …).           |
| Resend      | `RESEND_API_KEY` and an `EMAIL_FROM` on a verified domain.                                                 |
| SMTP/Gmail  | `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_USER` and a Google app password in `EMAIL_PASSWORD`. |

`.env.example` sets `EMAIL_HOST` to Gmail. Clear it in development, or the app tries to send through SMTP.

To run the reminders and the email queue locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/emails
```

You can also use the "Process now" button in **Admin → Settings**.

## 5. Tests

```bash
npm test
```

- `tests/unit/`: pure logic (slots, overlaps, time zones, validation, templates). No database needed.
- `tests/integration/`: runs against `DATABASE_URL` with the seed loaded. It checks that two simultaneous requests cannot book the same table, plus ownership, table reassignment and cancellation. It cleans up what it creates. Skip it with `SKIP_DB_TESTS=1 npm test`.

## 6. Deployment (Vercel)

1. **Project:** `vercel link --yes --project accanto` creates the project and connects the GitHub repo. From then on, every push to `main` deploys to production.
2. **Database (Neon, Frankfurt):**
   ```bash
   vercel integration add neon --plan free_v3 -m region=fra1 -m auth=false -e production --no-env-pull
   ```
   This creates `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct, for migrations). `--no-env-pull` stops the CLI from overwriting your `.env.local`. `vercel.json` pins the functions to `fra1`, next to the database.
3. **Variables:**
   - Secrets: `AUTH_SECRET` and `CRON_SECRET`, added with `--sensitive`.
   - Email: `EMAIL_FROM`, `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` and `EMAIL_RECIPIENT_ALLOWLIST`.
   - `APP_URL` is optional. On Vercel it defaults to the project's production domain.
4. **Migrate and seed (once, before the first build).** The build prerenders the home page and needs the restaurant data.
   ```bash
   vercel env pull /path/outside/the/repo/prod.env --environment=production
   # export DATABASE_URL and DATABASE_URL_UNPOOLED from that file, then:
   npx prisma migrate deploy
   NODE_ENV=production SEED_FORCE=1 SEED_ADMIN_PASSWORD=... SEED_CLIENT_PASSWORD=... npx tsx prisma/seed.ts
   ```
   In production the seed requires your own passwords (admin at least 12 characters, client at least 8). The development passwords are public because they are in the repo.
5. **Deploy:** `git push` to `main`. The build (`npm run vercel-build`) applies pending migrations before `next build`.
6. **Reminders every 15 min (optional):** Vercel Hobby only allows daily crons. Add the `APP_URL` and `CRON_SECRET` secrets on GitHub for the `.github/workflows/email-cron.yml` workflow.

## Common problems

- **`AUTH_SECRET is missing or shorter than 32 characters`:** generate one with `openssl`.
- **503 `NOT_CONFIGURED` ("The restaurant isn't set up yet"):** run `npm run db:seed`.
- **`P3005 The database schema is not empty` on `npm run db:migrate`:** see the note in [section 2](#migrations-and-test-data). On a new database, use `npx prisma migrate deploy`.
- **Transaction errors with `prisma dev`:** check that `DATABASE_POOL_MAX="1"`.
- **`PageProps` / `LayoutProps` types are missing:** run `npx next typegen`. `next dev` and `next build` also generate them.
