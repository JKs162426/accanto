"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ErrorAlert from "@/components/common/ErrorAlert";
import { useI18n } from "@/i18n/client";
import { apiFetch } from "@/lib/apiClient";
import type { TableDTO } from "@/types";
import { TableForm } from "./TableManager";

export default function TableEditor({ table }: { table: TableDTO }) {
  const router = useRouter();
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-3">
      {saved && <ErrorAlert tone="success">{t.admin.tables.form.saved}</ErrorAlert>}
      <TableForm
        initial={table}
        submitLabel={t.admin.tables.form.save}
        onSubmit={async (body) => {
          setSaved(false);
          await apiFetch(`/api/tables/${table.id}`, { method: "PATCH", body });
          setSaved(true);
          router.refresh();
        }}
      />
    </div>
  );
}
