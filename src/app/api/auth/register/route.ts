import { NextResponse } from "next/server";
import { handle, jsonError, parseBody } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { AUTH_ATTEMPTS_PER_ACCOUNT, AUTH_ATTEMPTS_PER_IP, AUTH_ATTEMPTS_WINDOW_MS } from "@/lib/constants";
import { authLimits } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validation";
import { registerUser } from "@/services/userService";

export const POST = handle(async (request) => {
  const input = await parseBody(request, registerSchema);
  const limit = authLimits(request, "register", input.email, {
    perIp: AUTH_ATTEMPTS_PER_IP,
    perAccount: AUTH_ATTEMPTS_PER_ACCOUNT,
    windowMs: AUTH_ATTEMPTS_WINDOW_MS,
  });
  if (!limit.ok) {
    return jsonError(request, 429, "RATE_LIMITED", { seconds: limit.retryAfterSeconds });
  }
  const { sessionVersion, ...user } = await registerUser(input);
  await startSession(user, sessionVersion);
  return NextResponse.json({ user }, { status: 201 });
});
