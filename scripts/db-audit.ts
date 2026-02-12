/**
 * Audit: Check for data integrity issues in the database.
 * Usage: npm run db:audit
 */
import db from '../lib/db/client';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('🔍 Running Database Integrity Audit...');
  let issuesFound = 0;

  // 1. Ghost Entries in budget_months
  // Entries with 0 assigned, 0 activity, 0 available are "ghosts" that should be deleted
  // unless they are for the current month or explicitly needed (which they usually aren't).
  // The RTA calculation can be affected by these if they exist in future months.
  const ghostEntries = await db.execute(sql`
    SELECT count(*) as count 
    FROM budget_months 
    WHERE assigned = 0 AND activity = 0 AND available = 0
  `);
  
  const ghostCount = Number(ghostEntries[0].count);
  if (ghostCount > 0) {
    console.warn(`⚠️  WARNING: Found ${ghostCount} ghost entries in budget_months (0 assigned/activity/available).`);
    console.warn(`   Run minimal cleanup query: DELETE FROM budget_months WHERE assigned = 0 AND activity = 0 AND available = 0;`);
    issuesFound++;
  } else {
    console.log('✅ budget_months: No ghost entries found.');
  }

  // 2. Orphaned Categories
  // Categories pointing to non-existent groups
  const orphanedCategories = await db.execute(sql`
    SELECT count(*) as count
    FROM categories c
    LEFT JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.id IS NULL
  `);
  const orphanCount = Number(orphanedCategories[0].count);
  if (orphanCount > 0) {
    console.error(`❌ ERROR: Found ${orphanCount} orphaned categories (invalid category_group_id).`);
    issuesFound++;
  } else {
    console.log('✅ categories: No orphaned categories found.');
  }

  // 3. Negative RTA in Past Months (Informational)
    // RTA should ideally be >= 0 in past months due to clamping logic in UI, but DB might show actuals.
    // This is just a check to see if we have massive historical holes.
    // skipped for now as logic is complex (calculated in code, not stored in DB)

  if (issuesFound > 0) {
    console.log(`\n🛑 Audit found ${issuesFound} issues.`);
    process.exit(1);
  } else {
    console.log('\n✨ Database integrity check passed.');
    process.exit(0);
  }
}

main()
  .catch((err) => {
    console.error('Fatal error during audit:', err);
    process.exit(1);
  });
