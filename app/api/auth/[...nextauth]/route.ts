import { handlers } from '@/lib/auth';
import { authLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';

export const { GET } = handlers;

/**
 * Wrap NextAuth POST with rate limiting.
 * POST handles sign-in (credentials) — rate limit to prevent brute-force.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = await authLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit);

  return handlers.POST(request);
}
