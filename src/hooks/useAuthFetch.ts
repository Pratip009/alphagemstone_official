"use client";
import { useCallback } from "react";

// Auth is entirely cookie-based (httpOnly `auth_token`, sent automatically by
// the browser on same-origin requests). There is no JWT in JS memory or
// localStorage to attach as a Bearer header — `credentials: 'include'` is
// enough, and doubles as a safety net if this is ever called cross-origin.
export function useAuthFetch() {
  const authFetch = useCallback((url: string, options: RequestInit = {}) => {
    const isFormData = options.body instanceof FormData;
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        // Don't set Content-Type for FormData — the browser sets it with the multipart boundary
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers ?? {}),
      },
    });
  }, []);

  return authFetch;
}
