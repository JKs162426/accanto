"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { apiFetch, swrFetcher } from "@/lib/apiClient";
import type { SessionUser } from "@/types";

/** Current user on the client (cached by SWR, shared across components). */
export function useAuth() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR<{ user: SessionUser | null }>("/api/auth/me", swrFetcher, {
    revalidateOnFocus: false,
  });

  async function login(email: string, password: string, adminOnly = false) {
    const res = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password, adminOnly },
    });
    await mutate({ user: res.user }, { revalidate: false });
    return res.user;
  }

  async function register(input: { name: string; email: string; phone?: string; password: string }) {
    const res = await apiFetch<{ user: SessionUser }>("/api/auth/register", { method: "POST", body: input });
    await mutate({ user: res.user }, { revalidate: false });
    return res.user;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    await mutate({ user: null }, { revalidate: false });
    router.refresh();
  }

  return { user: data?.user ?? null, loading: isLoading, login, register, logout };
}
