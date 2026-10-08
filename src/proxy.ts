import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifySession } from "@/lib/session";
import { LOCALE_COOKIE, defaultLocale, hasLocale, splitLocale } from "@/i18n/config";

/**
 * Runs before routing:
 *  - API: CSRF — state-changing requests must come from our own origin.
 *  - Pages: every page lives under /it or /en. Paths without a locale are
 *    redirected to the visitor's remembered language (cookie) or Italian.
 *    The language in the URL is remembered in a cookie for next time.
 *  - Redirects anonymous users away from private pages, and non-admins away
 *    from the admin dashboard.
 *
 * This is an optimisation, not the security boundary: every page, route
 * handler and service re-checks the session and role/ownership itself.
 */
const CLIENT_PAGES = ["/my-reservations", "/profile", "/reserve/confirmation"];

/**
 * CSRF defence for state-changing API calls, layered on top of the SameSite
 * session cookie:
 *  1. Sec-Fetch-Site (set by every modern browser) must not be cross-site.
 *  2. Origin, when present, must be our own origin.
 *  3. A body must be JSON. HTML forms can only send urlencoded, multipart or
 *     text/plain, and cross-site fetch() with application/json triggers a CORS
 *     preflight we never answer — so no third-party page can forge a call.
 */
function csrfCheck(request: NextRequest): NextResponse | null {
  const reject = (status: number, code: string, message: string) =>
    NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });

  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return reject(403, "BAD_ORIGIN", "Cross-site request rejected");

  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reject(403, "BAD_ORIGIN", "Cross-origin request rejected");

  const hasBody = Number(request.headers.get("content-length") ?? 0) > 0 || request.headers.has("transfer-encoding");
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (hasBody && type !== "application/json") return reject(415, "UNSUPPORTED_MEDIA_TYPE", "Only application/json is accepted");
  return null;
}
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const rejected = csrfCheck(request);
      if (rejected) return rejected;
    }
    return NextResponse.next();
  }

  const { locale, path } = splitLocale(pathname);
  if (!locale) {
    const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
    const target = hasLocale(remembered) ? remembered : defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const redirectTo = (to: string) => {
    const res = NextResponse.redirect(new URL(`/${locale}${to}`, request.url));
    res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    return res;
  };

  const needsSession = path.startsWith("/admin/dashboard") || CLIENT_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
  if (needsSession) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (path.startsWith("/admin/dashboard")) {
      if (!session) return redirectTo("/admin/login");
      if (session.role !== "ADMIN") return redirectTo("/admin/unauthorized");
    } else if (!session) {
      return redirectTo(`/login?next=${encodeURIComponent(`/${locale}${path}${search}`)}`);
    }
  }

  const res = NextResponse.next();
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
  return res;
}

export const config = {
  // Everything except Next internals and static files in /public.
  matcher: ["/((?!_next/|favicon.ico|logo.svg|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
