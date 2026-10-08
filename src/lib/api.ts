import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, forbidden, unauthorized } from "./errors";
import { getCurrentUser } from "./auth";
import { getDictionary, requestLocale, translateError, translateFieldErrors } from "@/i18n";
import type { SessionUser } from "@/types";

/** JSON error body: { error: { code, message, details? } } with message in the caller's language. */
export function jsonError(
  request: Request,
  status: number,
  code: string,
  params: Record<string, string | number> = {},
  details?: { fieldErrors?: Record<string, string[] | undefined> },
) {
  const t = getDictionary(requestLocale(request));
  const translated = details?.fieldErrors ? { fieldErrors: translateFieldErrors(t, details.fieldErrors) } : undefined;
  return NextResponse.json(
    { error: { code, message: translateError(t, code, params), ...(translated ? { details: translated } : {}) } },
    { status },
  );
}

/** Largest JSON body any endpoint accepts. Real payloads are < 5 KB. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Parse and validate a JSON body. Bodies over MAX_BODY_BYTES are rejected
 * before being buffered whole (413). Throws a 400 AppError with field errors
 * (dictionary keys) on invalid input.
 */
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE");
  let text = "";
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AppError(413, "PAYLOAD_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError(400, "INVALID_JSON");
  }
  return parseWith(schema, raw);
}

export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return parseWith(schema, params);
}

function parseWith<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const flat = z.flattenError(result.error);
    throw new AppError(400, "VALIDATION_ERROR", {}, {
      fieldErrors: { ...(flat.formErrors.length ? { _form: flat.formErrors } : {}), ...flat.fieldErrors } as Record<string, string[]>,
    });
  }
  return result.data;
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") throw forbidden();
  return user;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** API responses carry per-user data: never let browsers or CDNs store them. */
function noStore(response: Response): Response {
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Wraps a route handler: AppErrors become translated JSON errors with their
 * status; anything else is logged server-side and returned as a generic 500
 * so no database or stack details leak to the client. Every response is
 * marked `Cache-Control: private, no-store` unless the handler set its own.
 */
export function handle<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return noStore(await handler(request, context));
    } catch (error) {
      if (error instanceof AppError) {
        return noStore(jsonError(request, error.status, error.code, error.params, error.details));
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, error);
      return noStore(jsonError(request, 500, "INTERNAL_ERROR"));
    }
  };
}
