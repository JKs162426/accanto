/**
 * Expected, user-facing failure. Services throw it with a stable `code` (and
 * optional interpolation `params`); API routes translate the code into the
 * request's language (see i18n `errors` dictionary). Anything that is *not*
 * an AppError is treated as internal and its details never reach the client.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly params: Record<string, string | number> = {},
    /** e.g. { fieldErrors: { number: ["NUMBER_IN_USE"] } } — values are dictionary keys. */
    public readonly details?: { fieldErrors?: Record<string, string[]> },
  ) {
    super(code);
    this.name = "AppError";
  }
}

export const notFound = (code = "NOT_FOUND") => new AppError(404, code);
export const forbidden = () => new AppError(403, "FORBIDDEN");
export const unauthorized = () => new AppError(401, "UNAUTHORIZED");
