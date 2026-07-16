'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  // Merges a partial user update (e.g. the response from PATCH /api/account)
  // into the in-memory auth state, so anything reading `user` — like the
  // navbar avatar/name — updates instantly without a round trip to /me.
  updateUser: (partial: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The JWT lives only in the httpOnly `auth_token` cookie set by the server —
  // it's never readable from JS. On mount we ask the server who we are
  // (the cookie is sent automatically); no token is ever kept client-side.
  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setUser(data.data);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchMe();
      } catch {
        // Not logged in / network error — treat as logged out.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include', // ensure the Set-Cookie response is honored
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    // The server already set the httpOnly cookie via Set-Cookie; we just
    // hydrate the in-memory user state from the response body.
    setUser(data.data.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Signup failed');
    setUser(data.data.user);
  }, []);

  // Verifies the OTP after signup and hydrates the auth state immediately.
  // This is the correct entry point after OTP-based account creation —
  // calling setUser() here updates React state in the same tick as navigation.
  const verifyOtp = useCallback(async (email: string, otp: string) => {
    const res = await fetch('/api/auth/verify-signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Verification failed');
    setUser(data.data.user);
  }, []);

  const logout = useCallback(async () => {
    // An httpOnly cookie can only be cleared by the server, so logout has to
    // be a real request rather than a client-side `document.cookie` hack.
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