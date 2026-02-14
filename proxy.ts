/**
 * Next.js 16 Proxy — i18n locale detection + Edge JWT auth.
 *
 * Composes two concerns into a single proxy handler:
 *  1. Locale detection — `next-intl` sets the NEXT_LOCALE cookie from
 *     Accept-Language on first visit, respects the cookie on subsequent visits.
 *  2. Auth protection — NextAuth validates the JWT; unauthenticated users
 *     are redirected to /auth/login.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  proxy.ts imports auth.config.ts (Edge-safe)                │
 * │  API routes import auth.ts (full Node.js config)            │
 * └──────────────────────────────────────────────────────────────┘
 *
 * In Next.js 16, middleware.ts was replaced by proxy.ts.
 * The exported function is called `proxy` (not `middleware`).
 */
import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { locales, defaultLocale } from '@/lib/i18n/config';

// ── i18n middleware ─────────────────────────────────────────────
// Sets/reads the NEXT_LOCALE cookie. No URL prefixes (/en/, /es/).
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
  localePrefix: 'never',
});

// ── Auth ────────────────────────────────────────────────────────
const { auth } = NextAuth(authConfig);

// Routes that skip auth but still receive i18n locale detection.
const PUBLIC_ROUTES = ['/auth/login', '/auth/register'];

/**
 * Proxy handler — runs i18n detection on every request, then
 * checks the JWT session for protected routes.
 */
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  // Always run i18n (sets NEXT_LOCALE cookie on every request)
  const intlResponse = intlMiddleware(req);

  // Skip auth for public routes
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  if (isPublic) return intlResponse;

  // Redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
});

/**
 * Matcher — only run proxy on routes that need processing.
 * Excludes: API routes, Next.js internals, static assets,
 * swagger-ui docs, Sentry tunnel, favicons, and images.
 */
export const config = {
  matcher: [
    '/((?!api|_next|monitoring|swagger-ui|favicon\\.ico|icons|.*\\.png$|.*\\.svg$).*)',
  ],
};
