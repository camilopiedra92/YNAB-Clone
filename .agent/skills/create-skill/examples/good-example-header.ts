/**
 * Example: How to annotate example files in skills.
 *
 * Every example file should start with a header comment that explains:
 * 1. WHAT this file demonstrates (which layer/pattern)
 * 2. WHERE it goes in the real project (target path)
 * 3. KEY rules to follow (referencing rule files)
 *
 * The body should use inline comments for non-obvious patterns.
 * Explain WHY, not WHAT — the code shows what, comments show why.
 */

// ─── Example: A well-annotated repo function ────────────────────────

import { eq, and } from 'drizzle-orm';
import { things } from '../db/schema';
import type { DrizzleDB } from './client';

export function createThingFunctions(database: DrizzleDB) {

  // Budget isolation: ALWAYS filter by budgetId to prevent cross-tenant access
  async function getThings(budgetId: number) {
    return database.select().from(things)
      .where(eq(things.budgetId, budgetId));
  }

  // Double filter: id + budgetId prevents fetching another tenant's data
  async function getThing(budgetId: number, id: number) {
    const rows = await database.select().from(things)
      .where(and(eq(things.id, id), eq(things.budgetId, budgetId)));
    return rows[0]; // undefined if not found — caller handles 404
  }

  // Return the object so lib/repos/index.ts can destructure and export
  return { getThings, getThing };
}
