/**
 * Rate Limiter Unit Tests — validates sliding window rate limiter behavior.
 *
 * Covers:
 * - Basic allow/deny flow
 * - Window expiration
 * - Per-key isolation
 * - Reset and clear operations
 * - Config presets
 * - getClientIP extraction from headers
 * - rateLimitResponse 429 format
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createRateLimiter,
  getClientIP,
  rateLimitResponse,
  AUTH_LIMIT,
  API_LIMIT,
  IMPORT_LIMIT,
  type RateLimitConfig,
} from '../rate-limit';

// ─────────────────────────────────────────────────────────────────────
// createRateLimiter
// ─────────────────────────────────────────────────────────────────────
describe('createRateLimiter', () => {
  const testConfig: RateLimitConfig = { maxRequests: 3, windowMs: 1000 };

  it('allows requests under the limit', async () => {
    const limiter = createRateLimiter(testConfig);
    const r1 = await limiter.check('ip-1');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await limiter.check('ip-1');
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await limiter.check('ip-1');
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('denies requests that exceed the limit', async () => {
    const limiter = createRateLimiter(testConfig);
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    await limiter.check('ip-1');

    const r4 = await limiter.check('ip-1');
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('tracks keys independently', async () => {
    const limiter = createRateLimiter(testConfig);
    // Fill up ip-1
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    expect((await limiter.check('ip-1')).success).toBe(false);

    // ip-2 should still be allowed
    const r1 = await limiter.check('ip-2');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('resets the window after expiration', async () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(testConfig);
      // Use up all 3 requests
      await limiter.check('ip-1');
      await limiter.check('ip-1');
      await limiter.check('ip-1');
      expect((await limiter.check('ip-1')).success).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(1001);

      // Should be allowed again
      const result = await limiter.check('ip-1');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns correct resetAt timestamp', async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      const limiter = createRateLimiter(testConfig);
      const r1 = await limiter.check('ip-1');
      // resetAt should be now + windowMs
      expect(r1.resetAt.getTime()).toBe(now + testConfig.windowMs);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reset() clears a specific key', async () => {
    const limiter = createRateLimiter(testConfig);
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    expect((await limiter.check('ip-1')).success).toBe(false);

    await limiter.reset('ip-1');

    const result = await limiter.check('ip-1');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('clear() clears all keys', async () => {
    const limiter = createRateLimiter(testConfig);
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    await limiter.check('ip-1');
    await limiter.check('ip-2');
    await limiter.check('ip-2');
    await limiter.check('ip-2');

    expect((await limiter.check('ip-1')).success).toBe(false);
    expect((await limiter.check('ip-2')).success).toBe(false);

    await limiter.clear();

    expect((await limiter.check('ip-1')).success).toBe(true);
    expect((await limiter.check('ip-2')).success).toBe(true);
  });

  it('sliding window prunes old timestamps correctly', async () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

      // Request at t=0
      await limiter.check('ip-1');
      
      // Request at t=500
      vi.advanceTimersByTime(500);
      await limiter.check('ip-1');
      
      // At t=500, both within window → limit reached
      expect((await limiter.check('ip-1')).success).toBe(false);

      // Advance to t=1001 — first request (t=0) falls out of window
      vi.advanceTimersByTime(501);
      
      // Now only the t=500 request is in the window → 1 slot available
      const result = await limiter.check('ip-1');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0); // used the last slot
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Config Presets
// ─────────────────────────────────────────────────────────────────────
describe('Rate Limit Presets', () => {
  it('AUTH_LIMIT is 5 per 60s', () => {
    expect(AUTH_LIMIT.maxRequests).toBe(5);
    expect(AUTH_LIMIT.windowMs).toBe(60_000);
  });

  it('API_LIMIT is 60 per 60s', () => {
    expect(API_LIMIT.maxRequests).toBe(60);
    expect(API_LIMIT.windowMs).toBe(60_000);
  });

  it('IMPORT_LIMIT is 3 per 300s', () => {
    expect(IMPORT_LIMIT.maxRequests).toBe(3);
    expect(IMPORT_LIMIT.windowMs).toBe(300_000);
  });

  it('AUTH_LIMIT uses relaxed limit when NEXT_TEST_BUILD is set', async () => {
    const originalEnv = process.env.NEXT_TEST_BUILD;
    process.env.NEXT_TEST_BUILD = 'true';
    try {
      // Force re-evaluation of the module-level constant
      vi.resetModules();
      const mod = await import('../rate-limit');
      expect(mod.AUTH_LIMIT.maxRequests).toBe(100);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.NEXT_TEST_BUILD;
      } else {
        process.env.NEXT_TEST_BUILD = originalEnv;
      }
      vi.resetModules();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// getClientIP
// ─────────────────────────────────────────────────────────────────────
describe('getClientIP', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost/api', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIP(request)).toBe('1.2.3.4');
  });

  it('extracts IP from x-real-ip header', () => {
    const request = new Request('http://localhost/api', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIP(request)).toBe('10.0.0.1');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
      },
    });
    expect(getClientIP(request)).toBe('1.1.1.1');
  });

  it('returns "unknown" when no IP headers exist', () => {
    const request = new Request('http://localhost/api');
    expect(getClientIP(request)).toBe('unknown');
  });

  it('trims whitespace from x-forwarded-for', () => {
    const request = new Request('http://localhost/api', {
      headers: { 'x-forwarded-for': '  3.3.3.3 , 4.4.4.4' },
    });
    expect(getClientIP(request)).toBe('3.3.3.3');
  });
});

// ─────────────────────────────────────────────────────────────────────
// rateLimitResponse
// ─────────────────────────────────────────────────────────────────────
describe('rateLimitResponse', () => {
  it('returns 429 with correct body and headers', async () => {
    const resetAt = new Date(Date.now() + 30_000);
    const result = {
      success: false as const,
      remaining: 0,
      resetAt,
    };

    const response = rateLimitResponse(result);

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(resetAt.toISOString());
    expect(response.headers.get('Retry-After')).toBeDefined();

    const body = await response.json();
    expect(body.error).toContain('Too many requests');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// MemoryStore cleanup interval
// ─────────────────────────────────────────────────────────────────────
describe('MemoryStore cleanup interval', () => {
  it('prunes expired entries after 5-minute interval', async () => {
    vi.useFakeTimers();
    try {
      const windowMs = 1000;
      const limiter = createRateLimiter({ maxRequests: 2, windowMs });

      // Exhaust the limiter for a key
      await limiter.check('cleanup-key');
      await limiter.check('cleanup-key');
      expect((await limiter.check('cleanup-key')).success).toBe(false);

      // Advance past the window so timestamps are expired
      vi.advanceTimersByTime(windowMs + 1);

      // Advance to trigger the 5-minute cleanup interval
      vi.advanceTimersByTime(5 * 60_000);

      // After cleanup, expired entries are pruned → key is fully reset
      const result = await limiter.check('cleanup-key');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('partial cleanup keeps valid timestamps', async () => {
    vi.useFakeTimers();
    try {
      const windowMs = 10 * 60_000; // 10-minute window (larger than 5-min cleanup interval)
      const limiter = createRateLimiter({ maxRequests: 3, windowMs });

      // Add request at t=0
      await limiter.check('partial-key');

      // Advance to just before the 5-min cleanup interval fires
      vi.advanceTimersByTime(4 * 60_000 + 59_000); // t=4m59s

      // Add request at t=4m59s — still within 10-min window
      await limiter.check('partial-key');

      // Advance 1s to trigger cleanup at t=5m
      vi.advanceTimersByTime(1000);

      // At cleanup (t=5m=300000ms):
      //   - timestamp t=0: age 300000ms < 600000ms window → VALID
      //   - timestamp t=299000: age 1000ms < 600000ms window → VALID
      // Neither should be pruned, entry should NOT be deleted
      const result = await limiter.check('partial-key');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0); // 2 existing + this new one = 3 used, 0 remaining
    } finally {
      vi.useRealTimers();
    }
  });
});
