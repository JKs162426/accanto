import "server-only";
import { db } from "@/lib/db";
import { deliverEmail, isRecipientAllowed, renderEmail } from "@/lib/email";
import { EMAIL_MAX_ATTEMPTS } from "@/lib/constants";
import { formatDate, fromDbDate } from "@/lib/helpers";
import { defaultLocale, fmt, getDictionary, hasLocale, localePath, plural, type Dictionary, type Locale } from "@/i18n";
import type { EmailTemplate } from "@/generated/prisma/enums";
import type { Prisma, Reservation, Table } from "@/generated/prisma/client";
import { getRestaurant, type RestaurantWithSchedule } from "./restaurantService";

/**
 * Email queue (transactional outbox).
 *
 * Business code never sends email inline. It inserts EmailLog rows with
 * status PENDING — inside the same DB transaction as the change that caused
 * them, so an email exists iff the change committed. Delivery happens:
 *   1. right after the HTTP response, via `after(processEmailQueue)` in the
 *      route handler (doesn't block the user), and
 *   2. on every run of the cron route (GET /api/emails), which also retries
 *      failures and enqueues the 24h / 2h reminders.
 *
 * Language: guest emails use the language the reservation was made in
 * (`Reservation.locale`); staff alerts use ADMIN_EMAIL_LOCALE (default "it").
 * Copy is rendered from the i18n dictionary at enqueue time and stored in the
 * row's payload, so the HTML templates only hold layout.
 */

type Tx = Prisma.TransactionClient;
type ReservationWithTable = Reservation & { table: Table };

/** { field: { from, to } } for the fields guests care about. */
export type ReservationChanges = Partial<Record<"date" | "time" | "partySize" | "table", { from: unknown; to: unknown }>>;

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

function adminRecipients(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function adminLocale(): Locale {
  const value = process.env.ADMIN_EMAIL_LOCALE;
  return hasLocale(value) ? value : defaultLocale;
}

function guestLocale(r: Reservation): Locale {
  return hasLocale(r.locale) ? r.locale : defaultLocale;
}

/** Variables shared by every template, in one language. */
function baseVars(r: ReservationWithTable, restaurant: RestaurantWithSchedule, locale: Locale) {
  const t = getDictionary(locale);
  const base = appUrl();
  const manageUrl = `${base}${localePath(locale, `/my-reservations/${r.id}`)}`;
  return {
    lang: locale,
    tagline: t.email.tagline,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? "",
    restaurantPhone: restaurant.phone ?? "",
    restaurantEmail: restaurant.email ?? "",
    labelPhone: t.email.phone,
    labelCode: t.email.codeLabel,
    labelDate: t.email.date,
    labelTime: t.email.time,
    labelPeople: t.email.people,
    labelTable: t.email.table,
    labelNotes: t.email.notes,
    labelClient: t.email.client,
    labelChanges: t.email.changes,
    btnView: t.email.viewReservation,
    btnModify: t.email.modify,
    btnCancel: t.email.cancel,
    btnBookAgain: t.email.bookAgain,
    btnAdmin: t.email.openAdmin,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone ?? "",
    code: r.code,
    dateLabel: formatDate(fromDbDate(r.date), locale),
    time: r.time,
    partySize: plural(r.partySize, t.common.people),
    tableLabel: `${fmt(t.common.table, { n: r.table.number })} · ${t.enums.location[r.table.location]}`,
    notes: r.notes ?? "",
    manageUrl,
    modifyUrl: `${manageUrl}?action=edit`,
    cancelUrl: `${manageUrl}?action=cancel`,
    bookUrl: `${base}${localePath(locale, "/reserve")}`,
    adminUrl: `${base}${localePath(locale, `/admin/dashboard/reservations/${r.id}`)}`,
  };
}

function summarizeChanges(changes: ReservationChanges, t: Dictionary, locale: Locale): string {
  return (Object.entries(changes) as Array<[keyof ReservationChanges, { from: unknown; to: unknown }]>)
    .map(([field, v]) => {
      const show = (x: unknown) => (field === "date" ? formatDate(String(x), locale, "short") : String(x));
      return `${t.email.changeLabels[field]}: ${show(v.from)} → ${show(v.to)}`;
    })
    .join(" · ");
}

async function enqueue(
  tx: Tx,
  template: EmailTemplate,
  recipients: string[],
  subject: string,
  payload: Record<string, unknown>,
) {
  if (recipients.length === 0) return;
  await tx.emailLog.createMany({
    data: recipients.map((recipient) => ({
      recipient,
      subject,
      template,
      payload: payload as Prisma.InputJsonValue,
    })),
  });
}

export type ReservationEmailEvent =
  | { kind: "created" }
  | { kind: "modified"; changes: ReservationChanges }
  | { kind: "cancelled"; byAdmin: boolean };

/** Enqueue the guest email (guest's language) and the staff alert (admin language). */
export async function enqueueReservationEmails(
  tx: Tx,
  reservation: ReservationWithTable,
  restaurant: RestaurantWithSchedule,
  event: ReservationEmailEvent,
) {
  const gl = guestLocale(reservation);
  const al = adminLocale();
  const gt = getDictionary(gl);
  const at = getDictionary(al);
  const guest = baseVars(reservation, restaurant, gl);
  const staff = baseVars(reservation, restaurant, al);
  const vars = { code: reservation.code, name: reservation.guestName, restaurant: restaurant.name };
  const admins = adminRecipients();

  switch (event.kind) {
    case "created":
      await enqueue(tx, "RESERVATION_CONFIRMED", [reservation.guestEmail], fmt(gt.email.confirmed.subject, vars), {
        ...guest,
        title: gt.email.confirmed.title,
        preheader: fmt(gt.email.confirmed.preheader, vars),
        intro: fmt(gt.email.confirmed.intro, vars),
        outro: gt.email.confirmed.outro,
      });
      await enqueue(tx, "NEW_RESERVATION_ADMIN", admins, fmt(at.email.admin.newSubject, { date: staff.dateLabel, time: staff.time }), {
        ...staff,
        title: at.email.admin.newTitle,
        preheader: `${staff.guestName} · ${staff.dateLabel} ${staff.time}`,
        intro: at.email.admin.newIntro,
      });
      break;
    case "modified":
      await enqueue(tx, "RESERVATION_MODIFIED", [reservation.guestEmail], fmt(gt.email.modified.subject, vars), {
        ...guest,
        title: gt.email.modified.title,
        preheader: fmt(gt.email.modified.preheader, vars),
        intro: fmt(gt.email.modified.intro, vars),
        outro: gt.email.modified.outro,
        changesSummary: summarizeChanges(event.changes, gt, gl),
      });
      await enqueue(tx, "NEW_RESERVATION_ADMIN", admins, fmt(at.email.admin.modifiedSubject, vars), {
        ...staff,
        title: at.email.admin.modifiedTitle,
        preheader: fmt(at.email.admin.modifiedSubject, vars),
        intro: at.email.admin.modifiedIntro,
        changesSummary: summarizeChanges(event.changes, at, al),
      });
      break;
    case "cancelled":
      await enqueue(tx, "RESERVATION_CANCELLED", [reservation.guestEmail], fmt(gt.email.cancelled.subject, vars), {
        ...guest,
        title: gt.email.cancelled.title,
        preheader: fmt(gt.email.cancelled.preheader, vars),
        intro: fmt(event.byAdmin ? gt.email.cancelled.byAdmin : gt.email.cancelled.byClient, vars),
        outro: fmt(gt.email.cancelled.outro, vars),
      });
      await enqueue(tx, "NEW_RESERVATION_ADMIN", admins, fmt(at.email.admin.cancelledSubject, vars), {
        ...staff,
        title: at.email.admin.cancelledTitle,
        preheader: fmt(at.email.admin.cancelledSubject, vars),
        intro: event.byAdmin ? at.email.admin.cancelledByAdmin : at.email.admin.cancelledByClient,
      });
      break;
  }
}

/**
 * Send pending emails. Each row is claimed with a conditional update on
 * `attempts`, so concurrent workers (after() + cron) never send twice.
 */
export async function processEmailQueue(limit = 25): Promise<{ sent: number; failed: number }> {
  const batch = await db.emailLog.findMany({
    where: {
      OR: [{ status: "PENDING" }, { status: "FAILED", attempts: { lt: EMAIL_MAX_ATTEMPTS } }],
    },
    orderBy: { timestamp: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const email of batch) {
    const claimed = await db.emailLog.updateMany({
      where: { id: email.id, attempts: email.attempts, status: { not: "SENT" } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    if (!isRecipientAllowed(email.recipient)) {
      await db.emailLog.update({
        where: { id: email.id },
        data: { status: "FAILED", attempts: EMAIL_MAX_ATTEMPTS, error: "Blocked by EMAIL_RECIPIENT_ALLOWLIST" },
      });
      failed++;
      continue;
    }
    try {
      const html = await renderEmail(email.template, email.payload as Record<string, unknown>);
      await deliverEmail({ to: email.recipient, subject: email.subject, html });
      await db.emailLog.update({
        where: { id: email.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      });
      sent++;
    } catch (error) {
      // Store a short message only — never credentials or full stacks.
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      await db.emailLog.update({ where: { id: email.id }, data: { status: "FAILED", error: message } });
      console.error(`[email] failed to send ${email.id}: ${message}`);
      failed++;
    }
  }
  return { sent, failed };
}

const HOUR = 60 * 60 * 1000;

/**
 * Enqueue 24h (default on) and 2h (opt-in) reminders for upcoming confirmed
 * reservations, in each reservation's language. Reservations booked inside
 * the window don't get that reminder — the confirmation email was just sent.
 * Idempotent via reminder24hSentAt / reminder2hSentAt.
 */
export async function scheduleReminders(now = new Date()): Promise<{ reminders24h: number; reminders2h: number }> {
  const restaurant = await getRestaurant();
  const counts = { reminders24h: 0, reminders2h: 0 };

  for (const kind of ["24h", "2h"] as const) {
    const hours = kind === "24h" ? 24 : 2;
    const sentField = kind === "24h" ? "reminder24hSentAt" : "reminder2hSentAt";
    const candidates = await db.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        status: "CONFIRMED",
        startsAt: { gt: now, lte: new Date(now.getTime() + hours * HOUR) },
        [sentField]: null,
      },
      include: { table: true, client: { select: { remind24h: true, remind2h: true } } },
    });

    for (const r of candidates) {
      const bookedInsideWindow = r.createdAt.getTime() > r.startsAt.getTime() - hours * HOUR;
      // Guests without an account get the 24h reminder but not the opt-in 2h one.
      const wants = kind === "24h" ? (r.client?.remind24h ?? true) : (r.client?.remind2h ?? false);
      await db.$transaction(async (tx) => {
        // Mark first (conditionally) so two cron runs can't both enqueue.
        const marked = await tx.reservation.updateMany({
          where: { id: r.id, [sentField]: null },
          data: { [sentField]: now },
        });
        if (marked.count === 0 || bookedInsideWindow || !wants) return;
        const locale = guestLocale(r);
        const t = getDictionary(locale);
        const copy = kind === "24h" ? t.email.reminder24h : t.email.reminder2h;
        const vars = { code: r.code, name: r.guestName, restaurant: restaurant.name };
        await enqueue(
          tx,
          kind === "24h" ? "RESERVATION_REMINDER_24H" : "RESERVATION_REMINDER_2H",
          [r.guestEmail],
          fmt(copy.subject, vars),
          {
            ...baseVars(r, restaurant, locale),
            title: copy.title,
            preheader: fmt(copy.subject, vars),
            intro: fmt(copy.intro, vars),
            outro: t.email.reminderOutro,
          },
        );
        counts[kind === "24h" ? "reminders24h" : "reminders2h"]++;
      });
    }
  }
  return counts;
}
