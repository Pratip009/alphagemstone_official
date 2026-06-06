'use client';
import { useCallback } from 'react';
import { useAuth } from './useAuth';

export function useApi() {
  const { token, logout } = useAuth();

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const activeToken = token || localStorage.getItem('auth_token');

      // When body is FormData, do NOT set Content-Type — the browser sets it
      // automatically with the correct multipart boundary. Setting it manually
      // breaks file uploads with a 400.
      const isFormData = options.body instanceof FormData;

      const headers: HeadersInit = {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      };

      const res = await fetch(url, { ...options, headers });

      if (res.status === 401) {
        if (activeToken) {
          logout();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error('Authentication required. Please log in.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    },
    [token, logout]
  );

  return { apiFetch };
}