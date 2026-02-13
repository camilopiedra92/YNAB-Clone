/**
 * Health Check Endpoint — Used by Coolify/Docker/Traefik to verify app liveness.
 *
 * Returns 200 if the app and database are healthy, 503 if not.
 * This endpoint is NOT protected by authentication (proxy.ts excludes /api/*).
 *
 * Response format:
 *   { status: 'healthy'|'unhealthy', timestamp, uptime, version, sentry_release, checks: { database } }
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';

// Prevent caching — health must always be live
export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  try {
    // Database connectivity + latency check
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - start;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '0.1.0',
      commit: process.env.COMMIT_SHA?.slice(0, 7) || 'dev',
      sentry_release: process.env.COMMIT_SHA || 'dev',
      checks: {
        database: {
          status: 'up',
          latencyMs: dbLatencyMs,
        },
      },
    });
  } catch (error) {
    // Report infrastructure failure to Sentry immediately
    Sentry.captureException(error, {
      tags: { component: 'health-check' },
      level: 'fatal',
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        checks: {
          database: {
            status: 'down',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 503 },
    );
  }
}
