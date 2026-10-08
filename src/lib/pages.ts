import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "./errors";

/**
 * For pages: a service's 404 (e.g. RESERVATION_NOT_FOUND, or "not yours")
 * renders the localized not-found page instead of crashing the route.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
