"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { apiFetch } from "@/lib/apiClient";

/**
 * Signs out with a POST (a plain link could be triggered by any third-party
 * page). Then goes home and refreshes server components.
 */
export default function LogoutButton({ className, children }: { className?: string; children?: ReactNode }) {
  const router = useRouter();
  const { t, href } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={async () => {
        setPending(true);
        await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace(href("/"));
        router.refresh();
      }}
    >
      {children ?? t.nav.logout}
    </button>
  );
}
