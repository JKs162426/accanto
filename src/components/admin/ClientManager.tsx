"use client";

import LocaleLink from "@/components/common/LocaleLink";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/Card";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Textarea } from "@/components/common/Field";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/apiClient";
import { useI18n } from "@/i18n/client";


export interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  totalReservations: number;
  lastVisit: string | null;
  createdAt: string;
}

const shortDate = (iso: string | null, locale: string) =>
  iso ? new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

/** Searchable client list (search lives in ?q= so it paginates server-side). */
export default function ClientManager({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { t, lang } = useI18n();
  const c = t.admin.clients;

  return (
    <div className="space-y-4">
      <form
        role="search"
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
          router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
        }}
      >
        <label htmlFor="client-q" className="sr-only">{c.searchLabel}</label>
        <input id="client-q" name="q" defaultValue={sp.get("q") ?? ""} placeholder={c.searchPlaceholder} className="min-w-0 flex-1 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none" />
        <Button type="submit" variant="secondary">{t.common.search}</Button>
      </form>
      {clients.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line bg-beige-light text-left text-caption tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">{c.colClient}</th>
                <th className="px-4 py-3 font-medium">{c.colPhone}</th>
                <th className="px-4 py-3 text-right font-medium">{c.colReservations}</th>
                <th className="px-4 py-3 font-medium">{c.colLastVisit}</th>
                <th className="px-4 py-3 font-medium">{c.colSince}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.map((client) => (
                <tr key={client.id} className="bg-surface-raised hover:bg-primary-soft/50">
                  <td className="px-4 py-3">
                    <LocaleLink href={`/admin/dashboard/clients/${client.id}`} className="font-medium text-primary hover:underline">{client.name}</LocaleLink>
                    <span className="block text-caption text-muted">{client.email}</span>
                  </td>
                  <td className="px-4 py-3">{client.phone ?? t.common.none}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{client.totalReservations}</td>
                  <td className="px-4 py-3">{shortDate(client.lastVisit, lang)}</td>
                  <td className="px-4 py-3">{shortDate(client.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Admin-only notes on a client (allergies, VIP, preferences). */
export function ClientNotes({ clientId, initial }: { clientId: string; initial: string | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const c = t.admin.clients;
  const [saved, setSaved] = useState(false);
  const save = useAsync(async (adminNotes: string) => {
    await apiFetch(`/api/users/${clientId}`, { method: "PATCH", body: { adminNotes: adminNotes || null } });
    setSaved(true);
    router.refresh();
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        void save.run(String(new FormData(e.currentTarget).get("adminNotes") ?? ""));
      }}
    >
      {saved && <ErrorAlert tone="success">{c.notesSaved}</ErrorAlert>}
      <ErrorAlert>{save.error}</ErrorAlert>
      <Textarea label={c.notesLabel} name="adminNotes" rows={4} defaultValue={initial ?? ""} maxLength={2000} placeholder={c.notesPlaceholder} />
      <Button type="submit" size="sm" variant="secondary" loading={save.loading}>{t.common.save}</Button>
    </form>
  );
}
