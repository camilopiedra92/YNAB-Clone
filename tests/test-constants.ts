/**
 * Shared Test Constants — Single Source of Truth
 *
 * All test credentials, URLs, and DB config live here.
 * Both global-setup.ts and individual spec files import from this module.
 */

// ─────────────────────────────────────────────────────────────────────
// Test Users
// ─────────────────────────────────────────────────────────────────────

export const TEST_USER = {
  email: 'test@test.com',
  password: 'password123',
  name: 'Test User',
} as const;

export const ISOLATION_USER = {
  email: 'isolation@test.com',
  password: 'password456',
  name: 'Isolation User',
} as const;

// ─────────────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────────────

export const TEST_DB_NAME = 'ynab_test';
export const ADMIN_DB_NAME = 'postgres';

/** bcrypt cost factor — low for test speed (~5ms vs ~250ms at cost 12) */
export const BCRYPT_TEST_ROUNDS = 4;

// ─────────────────────────────────────────────────────────────────────
// URLs
// ─────────────────────────────────────────────────────────────────────

export const TEST_BASE_URL = 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────

/**
 * Replaces the database name in a PostgreSQL connection string.
 * Uses URL parsing to safely handle query params, auth, ports, etc.
 */
export function replaceDbName(connectionString: string, dbName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}
