import { NextResponse } from "next/server";
import { handle, parseQuery, requireApiAdmin } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { reportQuerySchema } from "@/lib/validation";
import { getReport } from "@/services/reportService";

/** Admin: GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const GET = handle(async (request) => {
  await requireApiAdmin();
  const { from, to } = parseQuery(request, reportQuerySchema);
  if (from > to) throw new AppError(400, "INVALID_RANGE");
  return NextResponse.json(await getReport(from, to));
});
