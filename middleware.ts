/**
 * Next.js Middleware — Sentry API Route Instrumentation.
 *
 * Enriches ALL /api/* requests with Sentry scope context:
 * - `api.route` tag (normalized path pattern)
 * - `http.method` tag
 * - Request URL context
 *
 * Error capture is handled by `onRequestError` in `instrumentation.ts`.
 * This middleware ONLY adds context for searchability/filtering in Sentry.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only instrument API routes
  if (pathname.startsWith('/api/')) {
    // Normalize dynamic segments for grouping:
    //   /api/budgets/42/transactions → /api/budgets/:id/transactions
    const normalizedRoute = pathname
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[0-9a-f]{8,}/g, '/:id'); // UUIDs

    Sentry.setTag('api.route', normalizedRoute);
    Sentry.setTag('http.method', request.method);
    Sentry.setContext('request', {
      url: pathname,
      method: request.method,
      query: Object.fromEntries(request.nextUrl.searchParams.entries()),
    });
  }

  return NextResponse.next();
}

export const config = {
  // Match all API routes — exclude health (high frequency, low value)
  matcher: ['/api/((?!health).*)'],
};
