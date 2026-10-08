import type { ReactNode } from "react";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getLang } from "@/i18n/server";

/**
 * Server-side gate for a subtree. Render it inside a <Suspense> boundary
 * (it reads cookies). Redirects to the localized login / unauthorized page.
 * The proxy does a fast pre-check; this is the authoritative one.
 */
export default async function ProtectedRoute({
  children,
  role = "CLIENT",
  next,
}: {
  children: ReactNode;
  role?: "CLIENT" | "ADMIN";
  next?: string;
}) {
  const lang = await getLang();
  if (role === "ADMIN") await requireAdmin(lang);
  else await requireUser(lang, next);
  return <>{children}</>;
}
