/**
 * Database Helpers — Shared types and utilities for the database layer.
 *
 * This is a LEAF module with zero project-internal imports.
 * Repos import from here instead of `client.ts` to avoid circular deps.
 *
 * Exports:
 *   - `DrizzleDB` — app-wide database type alias
 *   - `queryRows()` — driver-agnostic row extraction from `db.execute()`
 */
import * as schema from './schema';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQL } from 'drizzle-orm';

/**
 * App-wide database type alias.
 *
 * Consumers import `DrizzleDB` — they never reference `PostgresJsDatabase`
 * directly. This alias is the single point to change if the driver changes.
 */
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

/**
 * Normalize `database.execute(sql)` result across drivers.
 *
 * - **postgres-js**: returns `T[]` (array-like RowList)
 * - **PGlite**: returns `{ rows: T[] }`
 *
 * This helper extracts the rows array regardless of driver format.
 */
export async function queryRows<T extends object>(
  db: DrizzleDB,
  query: SQL,
): Promise<T[]> {
  const result = await db.execute(query);
  // PGlite returns { rows: T[] }, postgres-js returns T[] (array-like)
  if (Array.isArray(result)) return result as unknown as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as unknown as { rows: T[] }).rows;
  }
  return result as unknown as T[];
}
