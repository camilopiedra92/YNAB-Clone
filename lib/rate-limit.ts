/**
 * In-Memory Rate Limiter — Sliding Window Counter
 *
 * Simple, zero-dependency rate limiter for protecting API routes.
 * Tracks requests per key (usually IP address) within a time window.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ In-memory only — resets on server restart.                  │
 * │ For multi-instance deployments, replace with Redis-backed.  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   const limiter = createRateLimiter(AUTH_LIMIT);
 *   const result = await limiter.check(ip);
 *   if (!result.success) return NextResponse.json(..., { status: 429 });
 */

import { NextResponse } from 'next/server';

// ── Configuration Presets ───────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/** Auth routes — strict: 5 attempts per minute (relaxed in test builds) */
export const AUTH_LIMIT: RateLimitConfig = {
  maxRequests: process.env.NEXT_TEST_BUILD ? 100 : 5,
  windowMs: 60_000,
};

/** Standard API routes — 60 requests per minute */
export const API_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
};

/** Import routes — 3 imports per 5 minutes */
export const IMPORT_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 300_000,
};

// ── Rate Limiter Implementation ─────────────────────────────────────

interface RateLimitEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** When the window resets (earliest timestamp + windowMs) */
  resetAt: Date;
}

export interface RateLimiter {
  /** Check if a request from the given key is allowed */
  check(key: string): Promise<RateLimitResult> | RateLimitResult;
  /** Reset the rate limit for a given key (useful for testing) */
  reset(key: string): Promise<void> | void;
  /** Clear all entries (useful for testing) */
  clear(): Promise<void> | void;
}


/**
 * Create a sliding-window rate limiter.
 *
 * Old entries are pruned on each check to prevent memory leaks.
 * A periodic cleanup runs every 5 minutes to remove stale entries
 * for keys that haven't been seen recently.
 */
// ── Storage Abstraction ─────────────────────────────────────────────
export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | undefined> | RateLimitEntry | undefined;
  set(key: string, entry: RateLimitEntry): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

class MemoryStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  constructor(windowMs: number) {
    // Periodic cleanup
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
        if (entry.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
    }, 5 * 60_000);

    // Allow Node.js process to exit even if cleanup is pending
    cleanupInterval.unref();
  }

  get(key: string) {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry) {
    this.store.set(key, entry);
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

/**
 * Create a sliding-window rate limiter.
 * Supports swappable storage (Memory, Redis, etc.)
 */
export function createRateLimiter(config: RateLimitConfig, store?: RateLimitStore): RateLimiter {
  const effectiveStore = store || new MemoryStore(config.windowMs);

  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      let entry = await effectiveStore.get(key);

      if (!entry) {
        entry = { timestamps: [] };
      }

      // Prune timestamps outside the current window
      // (Note: MemoryStore does this periodically, but doing it on read ensures strictness)
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < config.windowMs
      );

      const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
      const resetAt = new Date(
        entry.timestamps.length > 0
          ? entry.timestamps[0] + config.windowMs
          : now + config.windowMs
      );

      if (entry.timestamps.length >= config.maxRequests) {
        // Even if blocked, we might want to update the store if we were tracking "last blocked" etc.
        // But for simple sliding window, we just return fail.
        return { success: false, remaining: 0, resetAt };
      }

      // Record this request
      entry.timestamps.push(now);
      await effectiveStore.set(key, entry);

      return {
        success: true,
        remaining: remaining - 1,
        resetAt,
      };
    },

    async reset(key: string): Promise<void> {
      await effectiveStore.delete(key);
    },

    async clear(): Promise<void> {
      await effectiveStore.clear();
    },
  };
}


// ── Singleton Limiters (shared across API routes) ───────────────────

/** Rate limiter for auth routes (login, register) */
export const authLimiter = createRateLimiter(AUTH_LIMIT);

/** Rate limiter for standard API routes */
export const apiLimiter = createRateLimiter(API_LIMIT);

/** Rate limiter for import routes */
export const importLimiter = createRateLimiter(IMPORT_LIMIT);

/** Rate limiter for test endpoint (tight limit for E2E rate-limit verification) */
export const testLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });

// ── Helper: Extract client IP from request ──────────────────────────

/**
 * Extract the client IP from a request.
 * Checks common proxy headers, falls back to 'unknown'.
 */
export function getClientIP(request: Request): string {
  // Standard proxy headers (Vercel, Cloudflare, nginx)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Fallback — in local dev without proxy, all requests are same-origin
  return 'unknown';
}

// ── Helper: Create 429 response ─────────────────────────────────────

/**
 * Create a standard 429 Too Many Requests response.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      status: 429,
      retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(
          Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
        ),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetAt.toISOString(),
      },
    }
  );
}
