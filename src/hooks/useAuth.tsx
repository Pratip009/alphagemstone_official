'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setAnalyticsUserId } from '@/lib/analytics';
import { runAuthRequest } from '@/lib/api-client-error';

interface UserAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  phone?: string;
  avatarUrl?: string;
  address?: UserAddress;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setUser(data.data);
      return true;
    }
    return false;
  }, []);

  const hasSessionHint = useCallback(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split('; ').some((c) => c.startsWith('has_session='));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (hasSessionHint()) {
          await fetchMe();
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe, hasSessionHint]);

  useEffect(() => {
    setAnalyticsUserId(user?.id ?? null);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await runAuthRequest<{ data: { user: User } }>('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setUser(data.data.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const data = await runAuthRequest<{ data: { user: User } }>('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    setUser(data.data.user);
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    const data = await runAuthRequest<{ data: { user: User } }>('/api/auth/verify-signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    setUser(data.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      await fetchMe();
    } catch {
      // ignore — caller can decide what to do if this silently no-ops
    }
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      verifyOtp,
      logout,
      updateUser,
      refreshUser,
      isAdmin: user?.role === 'admin',
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}