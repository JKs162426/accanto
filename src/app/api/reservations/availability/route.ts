import { NextResponse } from "next/server";
import { handle, jsonError, parseQuery } from "@/lib/api";
import { AVAILABILITY_PER_MINUTE } from "@/lib/constants";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { availabilityQuerySchema } from "@/lib/validation";
import { getDictionary, requestLocale, translateError } from "@/i18n";
import { getAvailability } from "@/services/availabilityService";
import type { AvailabilityDTO } from "@/types";

/** Public: GET /api/reservations/availability?date=YYYY-MM-DD&time=HH:mm&partySize=2&preference=TERRACE */
export const GET = handle(async (request) => {
  const ip = clientIp(request);
  if (ip) {
    const limit = rateLimit(`availability:${ip}`, AVAILABILITY_PER_MINUTE, 60_000);
    if (!limit.ok) return jsonError(request, 429, "RATE_LIMITED", { seconds: limit.retryAfterSeconds });
  }
  const query = parseQuery(request, availabilityQuerySchema);
  const { notice, ...availability } = await getAvailability(query);
  const body: AvailabilityDTO = notice
    ? { ...availability, message: translateError(getDictionary(requestLocale(request)), notice.code, notice.params) }
    : availability;
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
});
