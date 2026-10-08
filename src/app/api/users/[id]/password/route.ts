import { NextResponse } from "next/server";
import { handle, parseBody, requireApiUser } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { changePasswordSchema } from "@/lib/validation";
import { changePassword } from "@/services/userService";
import { startSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** Users can only change their own password: POST /api/users/me/password */
export const POST = handle<Ctx>(async (request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (id !== "me" && id !== user.id) throw forbidden();
  const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema);
  const sessionVersion = await changePassword(user.id, currentPassword, newPassword);
  // Other devices are now signed out; keep this one signed in with a fresh token.
  await startSession(user, sessionVersion);
  return NextResponse.json({ ok: true });
});
