"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import LocaleLink from "@/components/common/LocaleLink";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { apiFetch, swrFetcher } from "@/lib/apiClient";
import { cn, formatDate } from "@/lib/helpers";

type NotificationType = keyof Dictionary["admin"]["notifications"]["types"];

interface NotificationItem {
  id: string;
  type: NotificationType;
  subject: string;
  content: string;
  /** Structured payload; rendered in the viewer's language when present. */
  data: { code: string; guestName: string; date: string; time: string; partySize: number; table: number } | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

type Labels = Dictionary["admin"]["notifications"];

/** Relative time ("5 min fa" / "5 min ago"). Only rendered client-side after the SWR fetch. */
function timeAgo(iso: string, n: Labels) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return n.now;
  if (minutes < 60) return fmt(n.minutes, { n: minutes });
  const hours = Math.round(minutes / 60);
  return hours < 24 ? fmt(n.hours, { n: hours }) : fmt(n.days, { n: Math.round(hours / 24) });
}

/** New-reservation alerts for admins, polled every 20 s. */
export default function NotificationBell() {
  const { t, lang } = useI18n();
  const n = t.admin.notifications;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, mutate } = useSWR<{ items: NotificationItem[]; unread: number }>("/api/notifications", swrFetcher, {
    refreshInterval: 20_000,
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function markAllRead() {
    // Optimistic: clear the badge immediately.
    await mutate(
      async (current) => {
        await apiFetch("/api/notifications", { method: "PATCH", body: {} });
        return current && { unread: 0, items: current.items.map((x) => ({ ...x, read: true })) };
      },
      { optimisticData: (c) => ({ unread: 0, items: (c?.items ?? []).map((x) => ({ ...x, read: true })) }), rollbackOnError: true },
    );
  }

  function render(item: NotificationItem): { title: string; body: string } {
    const typeLabel = n.types[item.type] ?? item.type;
    if (!item.data) return { title: item.subject === "welcome" ? n.welcome : `${typeLabel} · ${item.subject}`, body: item.subject === "welcome" ? n.welcomeText : item.content };
    const d = item.data;
    return {
      title: `${typeLabel} · ${d.code}`,
      body: `${d.guestName} · ${formatDate(d.date, lang, "short")} ${d.time} · ${fmt(t.common.peopleShort, { n: d.partySize })} · ${fmt(t.common.table, { n: d.table })}`,
    };
  }

  const unread = data?.unread ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md border border-line bg-surface-raised p-2 text-primary hover:bg-primary-soft"
        aria-label={unread ? fmt(n.unread, { n: unread }) : n.label}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-on-accent ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface-raised shadow-modal">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-medium text-primary">{n.label}</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-caption font-medium text-primary hover:underline">
                {n.markAll}
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {(data?.items ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{n.empty}</li>}
            {data?.items.map((item) => {
              const { title, body } = render(item);
              return (
                <li key={item.id}>
                  <LocaleLink
                    href={item.href ?? "#"}
                    onClick={() => setOpen(false)}
                    className={cn("block px-4 py-3 text-sm hover:bg-surface-muted", !item.read && "bg-primary-soft/60")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{title}</span>
                      <span className="shrink-0 text-caption text-muted">{timeAgo(item.createdAt, n)}</span>
                    </span>
                    <span className="mt-0.5 block text-muted">{body}</span>
                  </LocaleLink>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
