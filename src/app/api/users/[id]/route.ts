import { NextResponse } from "next/server";
import { handle, parseBody, requireApiUser } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { adminUserUpdateSchema, profileSchema } from "@/lib/validation";
import { adminUpdateUser, getClient, getProfile, updateProfile } from "@/services/userService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * `/api/users/me` is the caller's own profile. Any other id is admin-only and
 * returns the client record including admin notes.
 */
async function resolve(params: Ctx["params"]) {
  const user = await requireApiUser();
  const { id } = await params;
  const self = id === "me" || id === user.id;
  if (!self && user.role !== "ADMIN") throw forbidden();
  return { user, id: self ? user.id : id, self };
}

export const GET = handle<Ctx>(async (_request, { params }) => {
  const { id, self } = await resolve(params);
  return NextResponse.json({ user: self ? await getProfile(id) : await getClient(id) });
});

export const PATCH = handle<Ctx>(async (request, { params }) => {
  const { id, self } = await resolve(params);
  if (self) {
    const input = await parseBody(request, profileSchema);
    return NextResponse.json({ user: await updateProfile(id, input) });
  }
  const input = await parseBody(request, adminUserUpdateSchema);
  return NextResponse.json({ user: await adminUpdateUser(id, input) });
});
