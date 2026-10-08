import { handle, parseQuery, requireApiAdmin } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { reportQuerySchema } from "@/lib/validation";
import { exportReservationsCsv } from "@/services/reportService";
import { requestLocale } from "@/i18n";

/** Admin: CSV download of all reservations in a date range. */
export const GET = handle(async (request) => {
  await requireApiAdmin();
  const { from, to } = parseQuery(request, reportQuerySchema);
  if (from > to) throw new AppError(400, "INVALID_RANGE");
  const locale = requestLocale(request);
  const csv = await exportReservationsCsv(from, to, locale);
  // BOM so Excel opens UTF-8 accents correctly.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accanto-${locale === "it" ? "prenotazioni" : "bookings"}-${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
