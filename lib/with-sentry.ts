/**
 * Sentry API Route Wrapper — Enriches errors with request context.
 *
 * Wraps API route handlers in a Sentry scope that includes:
 * - Route path and HTTP method tags
 * - Request parameters and query context
 * - User ID (from auth)
 * - Automatic error capture with full context
 *
 * Usage:
 * ```ts
 * import { withSentry } from '@/lib/with-sentry';
 * 
 * export const GET = withSentry(
 *   '/api/budgets/:budgetId/transactions',
 *   async (req, context) => {
 *     // ... handler logic
 *   }
 * );
 * ```
 */
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { logger } from './logger';

type RouteHandler = (
  request: Request,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<NextResponse | Response>;

/**
 * Wrap an API route handler with Sentry context enrichment.
 * 
 * @param routeName - Human-readable route identifier (e.g., '/api/budgets/:id')
 * @param handler - The actual route handler function
 */
export function withSentry(routeName: string, handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: { params?: Promise<Record<string, string>> }) => {
    return Sentry.withScope(async (scope) => {
      // ── Enrich scope with request context ────────────
      const url = new URL(request.url);
      scope.setTag('api.route', routeName);
      scope.setTag('http.method', request.method);

      scope.setContext('request', {
        url: url.pathname,
        method: request.method,
        query: Object.fromEntries(url.searchParams.entries()),
      });

      try {
        return await handler(request, context);
      } catch (error) {
        // Capture with full context — logger.error also sends to Sentry,
        // but this ensures the scope tags are attached.
        logger.error(`Unhandled error in ${routeName}`, error, {
          route: routeName,
          method: request.method,
          path: url.pathname,
        });

        return NextResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 },
        );
      }
    });
  };
}
