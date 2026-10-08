import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { handle, jsonError, requireApiAdmin } from "@/lib/api";
import { processEmailQueue, scheduleReminders } from "@/services/emailService";

/**
 * Email worker. GET is the cron entry point (Vercel Cron or any external
 * scheduler) and must send `Authorization: Bearer $CRON_SECRET`. It:
 *   1. enqueues due 24h / 2h reminders,
 *   2. sends pending emails and retries failed ones.
 */
/** Constant-time comparison (hashing first makes the lengths equal). */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const GET = handle(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return jsonError(request, 401, "UNAUTHORIZED");
  }
  const reminders = await scheduleReminders();
  const delivery = await processEmailQueue(100);
  return NextResponse.json({ reminders, delivery });
});

/** Admin: run the worker manually (e.g. from the settings page). */
export const POST = handle(async () => {
  await requireApiAdmin();
  const reminders = await scheduleReminders();
  const delivery = await processEmailQueue(100);
  return NextResponse.json({ reminders, delivery });
});
