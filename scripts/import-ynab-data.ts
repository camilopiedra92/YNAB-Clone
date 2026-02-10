/**
 * YNAB CSV Data Importer (CLI)
 *
 * Reads YNAB export CSV files and populates the database.
 *
 * Usage:
 *   npm run db:import                       # auto-detect/create budget
 *   npm run db:import -- --budget-id=3      # import into budget 3
 */
import { eq } from 'drizzle-orm';
import { importData } from '../lib/data-import';
import db from '../lib/repos/client';
import * as schema from '../lib/db/schema';
import bcrypt from 'bcryptjs';

function parseBudgetIdArg(): number | undefined {
  const arg = process.argv.find(a => a.startsWith('--budget-id='));
  if (!arg) return undefined;
  const val = parseInt(arg.split('=')[1], 10);
  return isNaN(val) ? undefined : val;
}

// Run import
(async () => {
  try {
    const requestedBudgetId = parseBudgetIdArg();

    let budgetId: number;

    if (requestedBudgetId) {
      // Verify budget exists
      const [budget] = await db.select().from(schema.budgets)
        .where(eq(schema.budgets.id, requestedBudgetId));
      if (!budget) {
        console.error(`Budget with ID ${requestedBudgetId} not found.`);
        process.exit(1);
      }
      budgetId = budget.id;
      console.log(`Importing into budget: "${budget.name}" (ID: ${budgetId})`);
    } else {
      // Auto-detect or create user + budget
      let user = (await db.select().from(schema.users).limit(1))[0];
      if (!user) {
        const hashedPassword = await bcrypt.hash('admin', 12);
        const results = await db.insert(schema.users).values({
          name: 'Admin',
          email: 'admin@ynab.local',
          password: hashedPassword,
        }).returning();
        user = results[0];
      }

      let budget = (await db.select().from(schema.budgets).limit(1))[0];
      if (!budget) {
        const results = await db.insert(schema.budgets).values({
          userId: user.id,
          name: 'Imported Budget',
        }).returning();
        budget = results[0];
      }

      budgetId = budget.id;
      console.log(`Importing into budget: "${budget.name}" (ID: ${budgetId})`);
    }

    const stats = await importData(budgetId);
    console.log('\nImport stats:', stats);
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
})();
