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
     * Attach the user ID to the JWT token on sign-in.
     * Runs in Node runtime (sign-in) and Edge runtime (session check).
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    /**
     * Expose the user ID on the session object.
     */
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
