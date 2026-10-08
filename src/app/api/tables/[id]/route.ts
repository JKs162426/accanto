import { NextResponse } from "next/server";
import { handle, parseBody, requireApiAdmin } from "@/lib/api";
import { tableUpdateSchema } from "@/lib/validation";
import { deleteTable, getTable, toTableDTO, updateTable } from "@/services/tableService";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_request, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  return NextResponse.json({ table: toTableDTO(await getTable(id)) });
});

/** Edit, including marking OUT_OF_SERVICE / ACTIVE. */
export const PATCH = handle<Ctx>(async (request, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  const input = await parseBody(request, tableUpdateSchema);
  return NextResponse.json({ table: await updateTable(id, input) });
});

export const DELETE = handle<Ctx>(async (_request, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  return NextResponse.json(await deleteTable(id));
});
