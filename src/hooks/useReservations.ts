"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import type { ReservationDTO } from "@/types";

type Body = Record<string, unknown>;

/**
 * Reservation mutations. Lists are rendered on the server, so after each
 * change we `router.refresh()` to re-render them with fresh data; callers can
 * layer `useOptimistic` on top for instant feedback.
 */
export function useReservations() {
  const router = useRouter();

  async function create(body: Body) {
    const { reservation } = await apiFetch<{ reservation: ReservationDTO }>("/api/reservations", {
      method: "POST",
      body,
    });
    return reservation;
  }

  async function update(id: string, body: Body) {
    const { reservation } = await apiFetch<{ reservation: ReservationDTO }>(`/api/reservations/${id}`, {
      method: "PATCH",
      body,
    });
    router.refresh();
    return reservation;
  }

  async function cancel(id: string) {
    const { reservation } = await apiFetch<{ reservation: ReservationDTO }>(`/api/reservations/${id}`, {
      method: "DELETE",
    });
    router.refresh();
    return reservation;
  }

  return { create, update, cancel };
}
