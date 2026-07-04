'use client';
import { useCallback } from 'react';
import { useAuth } from './useAuth';

// Auth is entirely cookie-based (httpOnly `auth_token`). There is no client-side
// token to attach — the browser sends the cookie automatically on same-origin
// requests, and `credentials: 'include'` makes that explicit.
export function useApi() {
  const { logout } = useAuth();

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      // When body is FormData, do NOT set Content-Type — the browser sets it
      // automatically with the correct multipart boundary. Setting it manually
      // breaks file uploads with a 400.
      const isFormData = options.body instanceof FormData;

      const headers: HeadersInit = {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      };

      const res = await fetch(url, { ...options, credentials: 'include', headers });

      if (res.status === 401) {
        await logout();
        throw new Error('Session expired. Please log in again.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    },
    [logout]
  );

  return { apiFetch };
}
