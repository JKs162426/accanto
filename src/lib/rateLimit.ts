import "server-only";

/**
 * Fixed-window, in-memory limiter for cheap abuse protection (login,
 * register, public availability). Best effort: on serverless each instance
 * keeps its own counters. Limits that must hold globally (reservations per
 * user) are enforced against the database instead — see reservationService.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Client IP as reported by the hosting platform, or null when unknown.
 *
 * On Vercel these headers are set by the edge and can't be forged by the
 * client. When self-hosting, put the app behind a proxy that overwrites
 * X-Forwarded-For / X-Real-IP — otherwise they are attacker-controlled, which
 * is why login is also limited per account (see `authLimits`).
 *
 * Returning null (instead of a shared "unknown" bucket) avoids one attacker
 * locking every visitor out when no IP header is present.
 */
export function clientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/**
 * Login/register limiter: per IP (when known) and per account. The per-account
 * bucket stops password guessing against one user even if the attacker
 * rotates IPs or spoofs headers.
 */
export function authLimits(
  request: Request,
  kind: "login" | "register",
  account: string | null,
  { perIp, perAccount, windowMs }: { perIp: number; perAccount: number; windowMs: number },
): { ok: boolean; retryAfterSeconds: number } {
  const checks: Array<{ ok: boolean; retryAfterSeconds: number }> = [];
  const ip = clientIp(request);
  if (ip) checks.push(rateLimit(`${kind}:ip:${ip}`, perIp, windowMs));
  if (account) checks.push(rateLimit(`${kind}:acct:${account.toLowerCase()}`, perAccount, windowMs));
  const blocked = checks.filter((c) => !c.ok);
  return blocked.length
    ? { ok: false, retryAfterSeconds: Math.max(...blocked.map((c) => c.retryAfterSeconds)) }
    : { ok: true, retryAfterSeconds: 0 };
}
