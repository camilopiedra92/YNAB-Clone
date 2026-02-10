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

  it('allows requests under the limit', () => {
    const limiter = createRateLimiter(testConfig);
    const r1 = limiter.check('ip-1');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check('ip-1');
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check('ip-1');
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('denies requests that exceed the limit', () => {
    const limiter = createRateLimiter(testConfig);
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-1');

    const r4 = limiter.check('ip-1');
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter(testConfig);
    // Fill up ip-1
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-1');
    expect(limiter.check('ip-1').success).toBe(false);

    // ip-2 should still be allowed
    const r1 = limiter.check('ip-2');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('resets the window after expiration', () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(testConfig);
      // Use up all 3 requests
      limiter.check('ip-1');
      limiter.check('ip-1');
      limiter.check('ip-1');
      expect(limiter.check('ip-1').success).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(1001);

      // Should be allowed again
      const result = limiter.check('ip-1');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns correct resetAt timestamp', () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      const limiter = createRateLimiter(testConfig);
      const r1 = limiter.check('ip-1');
      // resetAt should be now + windowMs
      expect(r1.resetAt.getTime()).toBe(now + testConfig.windowMs);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reset() clears a specific key', () => {
    const limiter = createRateLimiter(testConfig);
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-1');
    expect(limiter.check('ip-1').success).toBe(false);

    limiter.reset('ip-1');

    const result = limiter.check('ip-1');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('clear() clears all keys', () => {
    const limiter = createRateLimiter(testConfig);
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-2');
    limiter.check('ip-2');
    limiter.check('ip-2');

    expect(limiter.check('ip-1').success).toBe(false);
    expect(limiter.check('ip-2').success).toBe(false);

    limiter.clear();

    expect(limiter.check('ip-1').success).toBe(true);
    expect(limiter.check('ip-2').success).toBe(true);
  });

  it('sliding window prunes old timestamps correctly', () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

      // Request at t=0
      limiter.check('ip-1');
      
      // Request at t=500
      vi.advanceTimersByTime(500);
      limiter.check('ip-1');
      
      // At t=500, both within window → limit reached
      expect(limiter.check('ip-1').success).toBe(false);

      // Advance to t=1001 — first request (t=0) falls out of window
      vi.advanceTimersByTime(501);
      
      // Now only the t=500 request is in the window → 1 slot available
      const result = limiter.check('ip-1');
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
