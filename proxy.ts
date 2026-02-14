/**
 * Next.js 16 Proxy — i18n locale header + Edge JWT auth.
 *
 * Composes two concerns into a single proxy handler:
 *  1. Locale detection — reads the NEXT_LOCALE cookie (set by user
 *     preference in ProfileModal) and sets the X-NEXT-INTL-LOCALE header
 *     so `next-intl` Server Components can read the locale. No URL
 *     rewrites — this app uses the "without i18n routing" pattern.
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
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { defaultLocale, isValidLocale } from '@/lib/i18n/config';

// ── Auth ────────────────────────────────────────────────────────
const { auth } = NextAuth(authConfig);

// Routes that skip auth but still receive i18n locale detection.
const PUBLIC_ROUTES = ['/auth/login', '/auth/register'];

/**
 * Resolve the user's locale from the NEXT_LOCALE cookie.
 * Falls back to the default locale if the cookie is missing or invalid.
 */
function resolveLocale(req: Parameters<Parameters<typeof auth>[0]>[0]): string {
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
  return cookieLocale && isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;
}

/**
 * Proxy handler — sets the i18n locale header on every request, then
 * checks the JWT session for protected routes.
 */
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const locale = resolveLocale(req);

  // Skip auth for public routes — still set locale header
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  if (isPublic) {
    return NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(req.headers), 'X-NEXT-INTL-LOCALE': locale }) },
    });
  }

  // Redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated — pass through with locale header
  return NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(req.headers), 'X-NEXT-INTL-LOCALE': locale }) },
  });
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
