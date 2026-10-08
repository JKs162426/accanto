import { NextResponse } from "next/server";
import { handle, parseBody, requireApiAdmin } from "@/lib/api";
import { tableSchema } from "@/lib/validation";
import { createTable, listTablesWithState } from "@/services/tableService";

/** Admin: all tables with their live state (free / occupied / reserved soon). */
export const GET = handle(async () => {
  await requireApiAdmin();
  return NextResponse.json({ tables: await listTablesWithState() });
});

export const POST = handle(async (request) => {
  await requireApiAdmin();
  const input = await parseBody(request, tableSchema);
  return NextResponse.json({ table: await createTable(input) }, { status: 201 });
});
