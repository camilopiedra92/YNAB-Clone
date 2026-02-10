/**
 * useAuth — Lightweight hook exposing auth state from NextAuth session.
 *
 * Usage:
 *   const { userId, email, name, isLoading, isAuthenticated } = useAuth();
 */
import { useSession } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    session,
  };
}
