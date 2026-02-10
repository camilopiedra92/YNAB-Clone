/**
 * ONE-TIME MIGRATION — Already applied. Kept for reference only.
 * Backfills user + budget for pre-multitenancy data.
 * Usage: npm run db:migrate-tenants
 */
import db from '../lib/repos/client';
import * as schema from '../lib/db/schema';
import { isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function migrateToMultitenancy() {
  console.log('🚀 Starting multi-tenancy migration...');

  try {
    // 1. Ensure at least one user exists
    let user = (await db.select().from(schema.users).limit(1))[0];
    
    if (!user) {
      console.log('No users found. Creating legacy user...');
      const hashedPassword = await bcrypt.hash('legacy-password-change-me', 12);
      const insertedUsers = await db.insert(schema.users).values({
        name: 'Legacy User',
        email: 'legacy@ynab.local',
        password: hashedPassword,
      }).returning();
      user = insertedUsers[0];
      console.log(`Created legacy user: ${user.email}`);
    } else {
      console.log(`Using existing user: ${user.email}`);
    }

    // 2. Create the default budget if not already present
    // For this backfill, we'll just create a new one called "Mi Presupuesto"
    // and assume all existing data belongs to it.
    console.log('Creating default budget...');
    const insertedBudgets = await db.insert(schema.budgets).values({
      userId: user.id,
      name: 'Mi Presupuesto',
      currencyCode: 'COP',
      currencySymbol: '$',
      currencyDecimals: 0,
    }).returning();
    const defaultBudget = insertedBudgets[0];
    console.log(`Created default budget: ${defaultBudget.name} (ID: ${defaultBudget.id})`);

    // 3. Update all accounts with the default budget ID
    console.log('Updating accounts...');
    const _accountsUpdated = await db.update(schema.accounts)
      .set({ budgetId: defaultBudget.id })
      .where(isNull(schema.accounts.budgetId));
    console.log(`Accounts updated.`);

    // 4. Update all category groups with the default budget ID
    console.log('Updating category groups...');
    const _groupsUpdated = await db.update(schema.categoryGroups)
      .set({ budgetId: defaultBudget.id })
      .where(isNull(schema.categoryGroups.budgetId));
    console.log(`Category groups updated.`);

    console.log('✅ Multi-tenancy backfill completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateToMultitenancy();
