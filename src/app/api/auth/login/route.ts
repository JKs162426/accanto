import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, jsonError, parseBody } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { AUTH_ATTEMPTS_PER_ACCOUNT, AUTH_ATTEMPTS_PER_IP, AUTH_ATTEMPTS_WINDOW_MS } from "@/lib/constants";
import { authLimits } from "@/lib/rateLimit";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/services/userService";

const bodySchema = loginSchema.extend({
  /** Set by the /admin/login form: rejects non-admin accounts. */
  adminOnly: z.boolean().optional(),
});

export const POST = handle(async (request) => {
  const { email, password, adminOnly } = await parseBody(request, bodySchema);
  const limit = authLimits(request, "login", email, {
    perIp: AUTH_ATTEMPTS_PER_IP,
    perAccount: AUTH_ATTEMPTS_PER_ACCOUNT,
    windowMs: AUTH_ATTEMPTS_WINDOW_MS,
  });
  if (!limit.ok) {
    return jsonError(request, 429, "RATE_LIMITED", { seconds: limit.retryAfterSeconds });
  }
  const found = await authenticate(email, password);
  // One generic message for unknown email and wrong password.
  if (!found) return jsonError(request, 401, "INVALID_CREDENTIALS");
  const { sessionVersion, ...user } = found;
  if (adminOnly && user.role !== "ADMIN") {
    return jsonError(request, 403, "NOT_ADMIN");
  }
  await startSession(user, sessionVersion);
  return NextResponse.json({ user });
});
