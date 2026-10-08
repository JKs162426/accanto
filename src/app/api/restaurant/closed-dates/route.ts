import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { handle, parseBody, parseQuery, requireApiAdmin } from "@/lib/api";
import { RESTAURANT_CACHE_TAG } from "@/lib/constants";
import { closedDateSchema } from "@/lib/validation";
import { addClosedDate, removeClosedDate } from "@/services/restaurantService";

/** Admin: close the restaurant on a specific date (holiday, private event). */
export const POST = handle(async (request) => {
  await requireApiAdmin();
  const { date, reason } = await parseBody(request, closedDateSchema);
  const closed = await addClosedDate(date, reason);
  revalidateTag(RESTAURANT_CACHE_TAG, "max");
  return NextResponse.json({ closedDate: { id: closed.id, date, reason: closed.reason } }, { status: 201 });
});

/** DELETE /api/restaurant/closed-dates?id=… */
export const DELETE = handle(async (request) => {
  await requireApiAdmin();
  const { id } = parseQuery(request, z.object({ id: z.string().min(1) }));
  await removeClosedDate(id);
  revalidateTag(RESTAURANT_CACHE_TAG, "max");
  return NextResponse.json({ ok: true });
});
