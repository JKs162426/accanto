import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const GET = handle(async () => {
  return NextResponse.json({ user: await getCurrentUser() });
});
