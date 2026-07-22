'use client';
import { AuthProvider } from '@/hooks/useAuth';
import { WishlistProvider } from '@/hooks/useWishlist';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WishlistProvider>{children}</WishlistProvider>
    </AuthProvider>
  );
}