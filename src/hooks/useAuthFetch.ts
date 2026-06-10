"use client";
import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useAuthFetch() {
  const { token } = useAuth();

  const authFetch = useCallback(
    (url: string, options: RequestInit = {}) => {
      const isFormData = options.body instanceof FormData;
      return fetch(url, {
        ...options,
        headers: {
          // Don't set Content-Type for FormData — the browser sets it with the multipart boundary
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(options.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [token],
  );

  return authFetch;
}