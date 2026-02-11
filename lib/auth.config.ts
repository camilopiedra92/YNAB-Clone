/**
 * Auth.js v5 — Edge-compatible configuration.
 *
 * This file contains ONLY the auth config that can run in Edge runtime
 * (Next.js proxy/middleware). Zero Node.js dependencies — no bcrypt,
 * no drizzle, no DB calls.
 *
 * The full auth config (with Credentials provider + DB) extends this
 * in `auth.ts`. The proxy imports this directly for JWT verification.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  auth.config.ts  →  Edge runtime (proxy.ts)                 │
 * │  auth.ts          →  Node runtime (API routes, server)      │
 * └──────────────────────────────────────────────────────────────┘
 */
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/auth/login',
  },

  // Providers are added in auth.ts — empty here so Edge doesn't
  // pull in bcrypt/drizzle.
  providers: [],

  callbacks: {
    /**
     * Attach the user ID and name to the JWT token on sign-in.
     * Also handles client-side session updates (trigger === 'update')
     * for real-time name sync after profile edits.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      // Real-time profile name sync: client calls update({ name: 'New' })
      if (trigger === 'update' && session?.name) {
        token.name = session.name;
      }
      return token;
    },

    /**
     * Expose the user ID and name on the session object.
     */
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.name) {
        session.user.name = token.name as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
