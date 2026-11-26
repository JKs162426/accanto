# Architecture

## Layers

```
Browser ──► proxy.ts ──► Page (Server Component) ──► services/* ──► Prisma ──► PostgreSQL
   │                         ▲
   └── fetch ──► app/api/*/route.ts ──┘   (Zod on input, handle() on output)
```

- **`services/`** holds all business logic and is the only layer that talks to the database. Each function receives the acting user and checks role or ownership itself. Security does not depend on the UI or the route.
- **`lib/scheduling.ts`** is the pure scheduling logic: slots, closures, overlaps and table choice. It has no dependencies. The server, the client (to suggest open days) and the tests all use it.
- **Reads:** pages are Server Components that call the services directly.
- **Writes:** client forms call the REST API, then `router.refresh()`. The REST API is also the contract for other consumers (mobile, integrations).
- **SWR** is used where data changes without user action: availability (polled every 30 s), table status and admin notifications.

## Critical points

### Double bookings

`reservationService` checks availability and inserts inside one transaction. The transaction first takes a **Postgres advisory lock per service day** (`pg_advisory_xact_lock(hashtext('booking:<restaurant>:<date>'))`). If two requests try to book the same table at once, the second waits for the first to commit, sees its booking and gets `409 TABLE_TAKEN`.

- The lock is per day, not per table, because automatic reassignment can touch any table that day.
- A change that moves a booking to another date locks both days, in order, to avoid deadlocks.
- `tests/integration/reservations.test.ts` fires two concurrent bookings and checks that only one succeeds.

**Alternative considered:** an `EXCLUDE USING gist (tableId WITH =, tstzrange(startsAt, endsAt) WITH &&)` constraint. It is stronger, but needs the `btree_gist` extension and does not work on the local `prisma dev` database.

### Concurrent changes to one booking

Cancelling or editing a booking starts by locking its row (`SELECT … FOR UPDATE`) inside the transaction and reading it again. All status checks run on that locked copy. If a cancel and an edit, or two cancels, arrive at once, the second waits for the first to commit and then sees the real state:

- A second cancel gets `409 NOT_CANCELLABLE`, so there is only one history entry and one set of cancellation emails.
- An edit that arrives after a cancel gets `409 NOT_EDITABLE` (`NOT_EDITABLE_CANCELLED` for admins) instead of changing a cancelled booking.
- An edit takes its day locks after the row lock, using the booking's current date.
- Row locks always come before day locks, and nothing takes them in the other order, so they cannot deadlock.
- `tests/integration/reservations.test.ts` races two cancels, and a cancel against an edit.

### Time zones

- The guest picks date and time in the **restaurant's local time** (`Restaurant.timezone`). They are stored as `date` (`@db.Date`) and `time` (`"HH:mm"`), which is what the UI shows.
- `startsAt` and `endsAt` are also stored in **UTC**. They are used for overlaps, reminders and live occupancy.
- The conversion (`zonedToUtc` / `utcToZoned` in `lib/helpers.ts`) uses `Intl` and is tested across daylight-saving changes.
- "Today" is always computed in the restaurant's zone, never the server's (Vercel runs in UTC).

### Scheduling rules

- **Slots:** a 12:00–15:00 shift with 2 h bookings and 30 min slots offers 12:00, 12:30 and 13:00. The last slot starts at `closing − duration`, so the table is free before closing.
- **Duration:** a booking blocks its table for `turnoverMinutes` (the brief's "minimum time between bookings"). Intervals are half-open, so 18:00–20:00 and a booking at 20:00 do not clash.
- **Availability:** only active, non-archived tables with enough seats that match the preference are offered. They are sorted from smallest to largest, so a couple does not take an 8-seat table when a 2-seat one is free.
- **Party too large for a preference:** availability returns `preferenceCapacity` (largest table per preference). When the party is larger, the UI explains it ("VIP: up to 2") instead of showing every slot as full.

### Emails (outbox)

Every change inserts `EmailLog` rows with status `PENDING` in the **same transaction**. If the change does not commit, no email is sent. Delivery happens in `after()`, once the response is sent, and in the cron.

- Each row is claimed with `UPDATE … WHERE attempts = n`, so two workers never send the same email.
- There are 3 attempts.
- Reminders are marked (`reminder24hSentAt` / `reminder2hSentAt`) before they are queued, which makes them idempotent.

Bull/Redis was ruled out. On a serverless deployment it adds infrastructure, and the database table already gives durability and an audit trail (visible in `EmailLog`).

On Vercel Hobby, crons run at most once a day. `vercel.json` has a daily fallback, and `.github/workflows/email-cron.yml` calls `GET /api/emails` every 15 minutes so the 2 h reminders go out on time.

### Authentication

- The session is an HS256 JWT signed with `jose`, in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), valid for 7 days.
- The JWT is only a pointer. The user is read from the database on every request (memoised per request with `React.cache`), so deleting a user or changing a role takes effect immediately.
- Passwords use bcrypt (cost 12). When the email does not exist, login compares against a dummy hash, so response time does not reveal which emails are registered.
- **Versioned sessions:** the token carries `User.sessionVersion`. A password change increments it, which signs out every other session. The current one gets a new token.
- **CSRF:** a `SameSite=Lax` cookie plus three checks in `proxy.ts` for methods that change data:
  1. `Sec-Fetch-Site` cannot be cross-site.
  2. `Origin`, if present, must be our own.
  3. A request with a body must be `application/json`, which a `<form>` on another site cannot send.
- **Logout** is always a POST from a button. The `/logout` page asks for confirmation, so an external link cannot sign anyone out.
- **Why not NextAuth:** the brief allowed "NextAuth.js or JWT with cookies". NextAuth v4 is not built for Next 16 or Cache Components, and v5 is still in beta. For email and password, a custom session is smaller and easier to audit.

### Next.js 16 and Cache Components

- `cacheComponents: true`: every read of cookies, URL parameters or uncached data sits inside a `<Suspense>`. Each page is a static shell (title, navigation) with dynamic content streamed in (`◐ Partial Prerender` in the build).
- Public restaurant data (`getCachedRestaurant`) uses `"use cache"` with `cacheTag("restaurant")`. Saving the settings invalidates it with `revalidateTag`.
- `middleware.ts` is now called `proxy.ts` (Next 16 convention).
- Client Components that use `usePathname()` in shared layouts (active menu link) have their own `<Suspense>`, because on `[id]` routes the URL is only known at request time.

### Security summary

- Zod validates on the client (instant feedback) and on the server (authoritative).
- Authorization happens in the service. Missing and foreign records return the same 404. `internalNotes` and `adminNotes` never reach clients.
- **Rate limits (in memory, best effort, per instance):**
  - Login and register: per account (10 per 15 min) and per IP (20 per 15 min, only when the platform reports the IP; there is never a shared "unknown" bucket).
  - Public availability: 120 per minute per IP.
  - Reservations: 10 per user per hour, checked in the database (global).
- **Client IP:** `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for`. When self-hosting, the reverse proxy must overwrite these headers.
- **Bodies:** at most 64 KB, rejected with 413 before they are fully read.
- **API responses** carry `Cache-Control: private, no-store`.
- **Public data:** the availability API returns tables without internal notes (`PublicTableDTO`).
- **Emails:** client bookings always notify the account email, so the form cannot be used to write to third parties. `EMAIL_RECIPIENT_ALLOWLIST` limits recipients on public demos.
- **Redirects:** the login `?next=` is resolved with `URL` and must be same-origin, which blocks `//evil` and `/\evil`.
- **Errors:** unexpected ones return a generic 500 and are only logged on the server. Pages turn service 404s into the "not found" page, and `[lang]/error.tsx` shows a localized error without details.
- **Cron:** the secret is compared in constant time (`timingSafeEqual`).
- **Reports and CSV:** the range is at most one year.
- **Escaping:** email templates escape every variable, and the CSV neutralises formula injection.
- **Headers:**
  - Static CSP, without a nonce, because nonces are incompatible with partial prerendering. It allows `'unsafe-inline'` only for scripts and styles. Everything else is limited to `'self'`, with `frame-ancestors 'none'`, `object-src 'none'` and `form-action 'self'`.
  - HSTS in production, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`.
- **Demo accounts** are shown in development or with `DEMO_MODE=true`.
- **Dependencies:** `overrides` in `package.json` force patched versions of `mysql2` and `deepmerge-ts` (used by the Prisma CLI). `braces` remains, in the ESLint plugin and only in development, with no fixed version published.

### Internationalization (IT / EN)

- **Routing:** a root segment `app/[lang]` with `generateStaticParams` (`it`, `en`), following the Next 16 i18n guide, so every page has one prerendered shell per language. `proxy.ts` redirects paths without a language and remembers the choice in the `NEXT_LOCALE` cookie. `/` goes to the last chosen language, or Italian.
- **Dictionaries:** `src/i18n/dictionaries/it.ts` is the source of truth. `en.ts` is typed against it, so a missing key is a TypeScript error. A test also checks that no key is empty.
- **Server Components** read the language with `next/root-params` (`getI18n()` in `src/i18n/server.ts`), without passing `lang` through props.
- **Client Components** use `useI18n()`. The root layout passes the dictionary once to `I18nProvider`.
- **`LocaleLink`** adds the language to internal paths. `localePath` is idempotent and never prefixes `/api`.
- **Errors and validation:** services throw `AppError(status, code, params)` with no text. `handle()` translates the code into the request language (`x-locale` → cookie → `it`). Zod messages are dictionary keys, so the same schema works on client and server, in both languages.
- **Stored data:** `Reservation.locale` keeps the booking language. Guest emails use it, including reminders and cancellations made from the panel in another language. Staff alerts use `ADMIN_EMAIL_LOCALE`. `Notification.data` stores structured data, and the bell builds the text in the viewer's language.
- **Email templates** in `emails/` only hold the layout. All copy comes from the dictionaries.
- **Formats:** dates, currency and percentages use `Intl` with `it-IT` / `en-GB`. The restaurant's time zone is `Europe/Rome`.
- **Bundle:** client components only import `i18n/config`, `format` and `translate`, which contain no dictionaries. The active dictionary arrives through the provider.

## Data model

```
Restaurant 1─* OpeningHour     (weekday × shift, "HH:mm")
           1─* ClosedDate
           1─* Table           (soft delete with deletedAt)
           1─* Reservation *─1 Table
User 1─* Reservation           (optional clientId: phone bookings without an account)
Reservation 1─* ReservationHistory   (action + JSON diff + actor)
User 1─* Notification          (admin bell)
EmailLog                       (outbox)
```

Compared with the brief:

- `openingHours[]` is a separate `OpeningHour` table (one row per weekday and shift), so the admin edits lunch and dinner separately.
- `Reservation` adds `startsAt`/`endsAt` (UTC), guest details, `internalNotes` and the reminder markers.
- `EmailLog` adds `status`, `attempts`, `template` and `payload` so it works as a queue.

## Pending / v2

- Payments and deposits for groups, a waiting list, reviews.
- End-to-end tests with Playwright (`tests/e2e/` is ready).
