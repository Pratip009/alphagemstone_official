"use client";
import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns an `authFetch` function that automatically attaches
 * the Bearer token from AuthContext to every request.
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const res = await authFetch('/api/admin/stats');
 */
export function useAuthFetch() {
  const { token } = useAuth();

  const authFetch = useCallback(
    (url: string, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [token],
  );

  return authFetch;
}
