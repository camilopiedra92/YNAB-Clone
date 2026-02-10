/**
 * Test-Only: Rate Limiter Utilities
 *
 * POST /api/auth/test-rate-limit → clears all in-memory rate limiter entries
 * GET  /api/auth/test-rate-limit → rate-limited test endpoint (3 req/min) for E2E testing
 *
 * Placed under /api/auth/ to bypass the auth middleware (same as /api/auth/csrf).
 * Only available when NEXT_TEST_BUILD=1.
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { authLimiter, importLimiter, testLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

/** Force dynamic rendering — prevents Next.js from caching GET responses */
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!process.env.NEXT_TEST_BUILD) {
    return apiError('Not found', 404);
  }

  authLimiter.clear();
  importLimiter.clear();
  testLimiter.clear();

  return NextResponse.json({ ok: true });
}

/** GET — rate-limited endpoint for testing 429 behavior */
export async function GET(request: NextRequest) {
  if (!process.env.NEXT_TEST_BUILD) {
    return apiError('Not found', 404);
  }

  const ip = getClientIP(request);
  const limit = await testLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit);

  return NextResponse.json({ ok: true, remaining: limit.remaining });
}
