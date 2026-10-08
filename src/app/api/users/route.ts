import { NextResponse } from "next/server";
import { handle, parseQuery, requireApiAdmin } from "@/lib/api";
import { userListQuerySchema } from "@/lib/validation";
import { listClients } from "@/services/userService";

/** Admin: paginated client list with search (?q=&page=). */
export const GET = handle(async (request) => {
  await requireApiAdmin();
  const query = parseQuery(request, userListQuerySchema);
  return NextResponse.json(await listClients(query));
});
