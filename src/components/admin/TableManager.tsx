"use client";

import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { Badge } from "@/components/common/Badge";
import { Button, chipClasses } from "@/components/common/Button";
import { EmptyState } from "@/components/common/Card";
import ErrorAlert from "@/components/common/ErrorAlert";
import { Checkbox, Input, Select, Textarea } from "@/components/common/Field";
import LocaleLink from "@/components/common/LocaleLink";
import Modal from "@/components/common/Modal";
import { useAsync } from "@/hooks/useAsync";
import { useTables, type LiveTable } from "@/hooks/useTables";
import { useZodForm } from "@/hooks/useZodForm";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn, tableTags } from "@/lib/helpers";
import { tableSchema } from "@/lib/validation";
import type { TableDTO } from "@/types";

const STATE_TONE: Record<LiveTable["liveState"], "success" | "danger" | "warning" | "neutral"> = {
  FREE: "success",
  OCCUPIED: "danger",
  RESERVED_SOON: "warning",
  OUT_OF_SERVICE: "neutral",
};

export function LiveStateBadge({ state, compact }: { state: LiveTable["liveState"]; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Badge tone={STATE_TONE[state]} className={compact ? "px-1.5 text-[10px]" : undefined}>
      <span className="mr-1 inline-block size-1.5 rounded-full bg-current" aria-hidden />
      {(compact ? t.admin.tables.statesCompact : t.admin.tables.states)[state]}
    </Badge>
  );
}

/** Create / edit form, shared by the modal here and the table detail page. */
export function TableForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: Partial<TableDTO>;
  onSubmit: (body: z.infer<typeof tableSchema>) => Promise<void>;
  submitLabel: string;
}) {
  const { t } = useI18n();
  const f = t.admin.tables.form;
  const { validate, clientErrors } = useZodForm();
  const { run, loading, error, fieldErrors } = useAsync(onSubmit);

  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = validate(tableSchema, {
      ...Object.fromEntries(fd),
      isWindow: fd.get("isWindow") === "on",
      status: fd.get("outOfService") === "on" ? "OUT_OF_SERVICE" : "ACTIVE",
      notes: fd.get("notes") || null,
    });
    if (data) void run(data);
  }
  const errors = { ...fieldErrors, ...clientErrors };

  return (
    <form onSubmit={handle} noValidate className="space-y-4">
      <ErrorAlert>{error}</ErrorAlert>
      <div className="grid grid-cols-2 gap-4">
        <Input label={f.number} name="number" type="number" min={1} defaultValue={initial?.number} required error={errors.number} />
        <Input label={f.capacity} name="capacity" type="number" min={1} max={30} defaultValue={initial?.capacity ?? 4} required error={errors.capacity} />
        <Select label={f.location} name="location" defaultValue={initial?.location ?? "INTERIOR"} error={errors.location}>
          {Object.entries(t.enums.location).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select label={f.type} name="type" defaultValue={initial?.type ?? "STANDARD"} error={errors.type}>
          {Object.entries(t.enums.tableType).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <Checkbox name="isWindow" defaultChecked={initial?.isWindow} label={f.window} />
      <Checkbox name="outOfService" defaultChecked={initial?.status === "OUT_OF_SERVICE"} label={f.outOfService} description={f.outOfServiceHint} />
      <Textarea label={f.notes} name="notes" defaultValue={initial?.notes ?? ""} maxLength={300} error={errors.notes} />
      <Button type="submit" loading={loading}>{submitLabel}</Button>
    </form>
  );
}

export default function TableManager({ initialTables }: { initialTables: LiveTable[] }) {
  const { t } = useI18n();
  const tm = t.admin.tables;
  const { tables, create, update, remove } = useTables(initialTables);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; table: LiveTable } | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const toggle = useAsync(async (table: LiveTable) =>
    update(table.id, { status: table.status === "ACTIVE" ? "OUT_OF_SERVICE" : "ACTIVE" }),
  );
  const del = useAsync(async (table: LiveTable) => {
    const res = await remove(table.id);
    setModal(null);
    setMessage({ tone: "success", text: fmt(res.archived ? tm.archived : tm.deleted, { n: table.number }) });
  });

  const visible = filter ? tables.filter((x) => x.location === filter) : tables;
  const totalSeats = tables.filter((x) => x.status === "ACTIVE").reduce((sum, x) => sum + x.capacity, 0);
  const filters: Array<[string, string]> = [["", t.common.all], ...Object.entries(t.enums.location)];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={tm.filter}>
          {filters.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={chipClasses(filter === v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{fmt(tm.summary, { tables: tables.length, seats: totalSeats })}</span>
          <Button onClick={() => setModal({ mode: "create" })}>{tm.newTable}</Button>
        </div>
      </div>

      {message && <ErrorAlert tone={message.tone}>{message.text}</ErrorAlert>}
      <ErrorAlert>{toggle.error ?? del.error}</ErrorAlert>

      {visible.length === 0 ? (
        <EmptyState title={tm.empty} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((table) => (
            <li
              key={table.id}
              className={cn(
                "rounded-lg border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-hover",
                table.status === "OUT_OF_SERVICE" && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <LocaleLink href={`/admin/dashboard/tables/${table.id}`} className="font-display text-h4 font-semibold text-primary hover:underline">
                    {fmt(t.common.table, { n: table.number })}
                  </LocaleLink>
                  <p className="text-sm text-muted">
                    {fmt(tm.seats, { n: table.capacity })} · {tableTags(t, table).join(" · ")}
                  </p>
                </div>
                <LiveStateBadge state={table.liveState} />
              </div>
              <div className="mt-3 min-h-10 text-sm">
                {table.current && (
                  <p>
                    <span className="text-muted">{tm.now}</span> {table.current.guestName} ({table.current.partySize}){" "}
                    {fmt(tm.since, { time: table.current.time })}
                  </p>
                )}
                {table.next && (
                  <p>
                    <span className="text-muted">{tm.nextLabel}</span> {table.next.time} · {table.next.guestName} ({table.next.partySize})
                  </p>
                )}
                {!table.current && !table.next && <p className="text-muted">{tm.nothingSoon}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant="secondary" onClick={() => setModal({ mode: "edit", table })}>{t.common.edit}</Button>
                <Button size="sm" variant="ghost" onClick={() => void toggle.run(table)}>
                  {table.status === "ACTIVE" ? tm.outOfService : tm.reactivate}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? fmt(tm.editTitle, { n: modal.table.number }) : tm.newTable}
      >
        {modal?.mode === "create" && (
          <TableForm
            submitLabel={tm.form.create}
            initial={{ number: Math.max(0, ...tables.map((x) => x.number)) + 1 }}
            onSubmit={async (body) => {
              await create(body);
              setModal(null);
              setMessage({ tone: "success", text: fmt(tm.created, { n: body.number }) });
            }}
          />
        )}
        {modal?.mode === "edit" && (
          <>
            <TableForm
              submitLabel={tm.form.save}
              initial={modal.table}
              onSubmit={async (body) => {
                await update(modal.table.id, body);
                setModal(null);
              }}
            />
            <div className="mt-6 border-t border-line pt-4">
              <Button variant="danger" size="sm" loading={del.loading} onClick={() => void del.run(modal.table)}>
                {tm.deleteTable}
              </Button>
              <p className="mt-2 text-caption text-muted">{tm.deleteHint}</p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
