"use client";

import useSWR from "swr";
import { swrFetcher } from "@/lib/apiClient";
import type { AvailabilityDTO } from "@/types";

export interface AvailabilityParams {
  date: string;
  time?: string;
  partySize: number;
  preference?: string;
  excludeReservationId?: string;
}

/**
 * Live availability. SWR caches each (date, time, party, preference) query,
 * dedupes requests and re-polls every 30 s so tables taken by someone else
 * disappear without a reload.
 */
export function useAvailability(params: AvailabilityParams | null) {
  const key = params?.date
    ? `/api/reservations/availability?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]),
      )}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<AvailabilityDTO>(key, swrFetcher, {
    refreshInterval: params?.time ? 30_000 : 0,
    keepPreviousData: true,
  });
  return { availability: data, error: error as Error | undefined, loading: isLoading, refresh: mutate };
}
