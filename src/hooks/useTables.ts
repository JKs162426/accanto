"use client";

import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/apiClient";
import type { TableDTO } from "@/types";
// Type-only import: erased at build time, so no server code reaches the client.
import type { TableWithLiveState as LiveTable } from "@/services/tableService";

export type { LiveTable };

/** Admin tables with live state, polled every 30 s, plus optimistic CRUD. */
export function useTables(initial?: LiveTable[]) {
  const { data, error, isLoading, mutate } = useSWR<{ tables: LiveTable[] }>("/api/tables", swrFetcher, {
    refreshInterval: 30_000,
    fallbackData: initial ? { tables: initial } : undefined,
  });

  async function create(body: Partial<TableDTO>) {
    await apiFetch("/api/tables", { method: "POST", body });
    await mutate();
  }

  async function update(id: string, body: Partial<TableDTO>) {
    // Optimistic: reflect the change immediately, roll back if the API fails.
    await mutate(
      async (current) => {
        await apiFetch(`/api/tables/${id}`, { method: "PATCH", body });
        return current;
      },
      {
        optimisticData: (current) => ({
          tables: (current?.tables ?? []).map((t) =>
            t.id === id
              ? { ...t, ...body, liveState: body.status === "OUT_OF_SERVICE" ? "OUT_OF_SERVICE" : t.liveState === "OUT_OF_SERVICE" ? "FREE" : t.liveState }
              : t,
          ),
        }),
        rollbackOnError: true,
        revalidate: true,
      },
    );
  }

  async function remove(id: string) {
    const res = await apiFetch<{ archived: boolean }>(`/api/tables/${id}`, { method: "DELETE" });
    await mutate();
    return res;
  }

  return { tables: data?.tables ?? [], error: error as Error | undefined, loading: isLoading, create, update, remove };
}
