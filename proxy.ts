/**
 * Next.js 16 Proxy — Edge JWT-validated route protection.
 *
 * Uses the edge-compatible auth config (`auth.config.ts`) to create
 * a lightweight NextAuth instance that validates JWT signatures and
 * expiry — without importing bcrypt/drizzle.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  proxy.ts imports auth.config.ts (Edge-safe)                │
 * │  API routes import auth.ts (full Node.js config)            │
 * └──────────────────────────────────────────────────────────────┘
 *
 * In Next.js 16, middleware.ts was renamed to proxy.ts.
 * The exported function is called `proxy` (not `middleware`).
 */
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

/**
 * Proxy handler — wraps `auth()` to get the verified session.
 * If the JWT is missing, expired, or invalid → redirect to login.
 */
export const proxy = auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

/**
 * Matcher config — only run proxy on routes that need auth protection.
 * Excludes: auth pages, API routes, Next.js internals, static assets,
 * and swagger-ui documentation assets.
 */
export const config = {
  matcher: ['/((?!auth|api|_next|swagger-ui|favicon\\.ico|icons|.*\\.png$|.*\\.svg$).*)'],
};
