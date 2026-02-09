
/**
 * Migration: Credit Card Payment Categories
 *
 * 1. Ensure CC Payment categories exist for all credit card accounts
 * 2. Link existing categories to their accounts
 * 3. Calculate initial Available for each CC Payment category
 *
 * Uses Drizzle ORM with PostgreSQL.
 *
 * Usage:
 *   npx tsx scripts/migrate-cc-categories.ts
 */
import { eq, and, sql, max, isNotNull } from 'drizzle-orm';
import db from '../lib/repos/client';
import {
  accounts,
  categoryGroups,
  categories,
  transactions,
  budgetMonths,
} from '../lib/db/schema';
import { yearMonth } from '../lib/db/sql-helpers';
import { milliunit, ZERO } from '../lib/engine/primitives';

async function migrate() {
  console.log('Starting Credit Card Payment categories migration...\n');

  // 1. Ensure "Credit Card Payments" category group exists
  const ccGroupRows = await db.select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(eq(categoryGroups.name, 'Credit Card Payments'));

  let ccGroup = ccGroupRows[0];

  if (!ccGroup) {
    const inserted = await db.insert(categoryGroups)
      .values({
        name: 'Credit Card Payments',
        sortOrder: 0,
        hidden: false,
        isIncome: false,
      })
      .returning({ id: categoryGroups.id });
    ccGroup = inserted[0];
    console.log(`✓ Created "Credit Card Payments" group (id=${ccGroup.id}).\n`);
  } else {
    // Ensure the group is visible and sorted first
    await db.update(categoryGroups)
      .set({ hidden: false, sortOrder: 0 })
      .where(eq(categoryGroups.id, ccGroup.id));
    console.log(`✓ "Credit Card Payments" group already exists (id=${ccGroup.id}), ensured visible.\n`);
  }

  // 2. Get all credit card accounts
  const creditAccounts = await db.select({
    id: accounts.id,
    name: accounts.name,
    balance: accounts.balance,
  })
    .from(accounts)
    .where(eq(accounts.type, 'credit'));

  console.log(`Found ${creditAccounts.length} credit card accounts.\n`);

  for (const account of creditAccounts) {
    // Check if a CC Payment category already exists for this account
    const categoryRows = await db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.linkedAccountId, account.id));

    let category = categoryRows[0];

    if (!category) {
      // Check if there's an existing category with the same name in the CC Payments group
      const namedCatRows = await db.select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(and(
          eq(categories.categoryGroupId, ccGroup.id),
          eq(categories.name, account.name),
        ));

      category = namedCatRows[0];

      if (category) {
        // Link the existing category
        await db.update(categories)
          .set({ linkedAccountId: account.id })
          .where(eq(categories.id, category.id));
        console.log(`✓ Linked existing category "${category.name}" (id=${category.id}) to account id=${account.id}`);
      } else {
        // Create new CC Payment category
        const maxOrderRows = await db.select({ maxOrder: max(categories.sortOrder) })
          .from(categories)
          .where(eq(categories.categoryGroupId, ccGroup.id));
        const newOrder = (maxOrderRows[0]?.maxOrder || 0) + 1;

        const insertedRows = await db.insert(categories)
          .values({
            name: account.name,
            categoryGroupId: ccGroup.id,
            sortOrder: newOrder,
            hidden: false,
            linkedAccountId: account.id,
          })
          .returning({ id: categories.id, name: categories.name });
        category = insertedRows[0];
        console.log(`✓ Created CC Payment category "${account.name}" (id=${category.id})`);
      }
    } else {
      console.log(`✓ CC Payment category already exists for "${account.name}" (category id=${category.id})`);
    }

    // 3. Calculate and set the Available for this CC Payment category
    // For each month that has transactions on this credit card
    const months = await db.selectDistinct({
      month: sql<string>`${yearMonth(transactions.date)}`,
    })
      .from(transactions)
      .where(eq(transactions.accountId, account.id))
      .orderBy(yearMonth(transactions.date));

    for (const { month } of months) {
      if (!month) continue;

      // Calculate funded spending on this CC for this month
      const spendingRows = await db.select({
        totalOutflow: sql<number>`COALESCE(SUM(${transactions.outflow}), 0)`,
        totalInflow: sql<number>`COALESCE(SUM(${transactions.inflow}), 0)`,
      })
        .from(transactions)
        .where(and(
          eq(transactions.accountId, account.id),
          sql`${yearMonth(transactions.date)} = ${month}`,
          isNotNull(transactions.categoryId),
        ));

      const spending = spendingRows[0];
      const ccPaymentActivity = (spending?.totalOutflow ?? 0) - (spending?.totalInflow ?? 0);

      if (ccPaymentActivity !== 0) {
        // Check if budget entry exists
        const existingRows = await db.select({
          id: budgetMonths.id,
          assigned: budgetMonths.assigned,
        })
          .from(budgetMonths)
          .where(and(
            eq(budgetMonths.categoryId, category.id),
            eq(budgetMonths.month, month),
          ));

        const existing = existingRows[0];

        if (existing) {
          await db.update(budgetMonths)
            .set({
              activity: milliunit(ccPaymentActivity),
              available: milliunit(existing.assigned + ccPaymentActivity),
            })
            .where(eq(budgetMonths.id, existing.id));
        } else {
          await db.insert(budgetMonths)
            .values({
              categoryId: category.id,
              month,
              assigned: ZERO,
              activity: milliunit(ccPaymentActivity),
              available: milliunit(ccPaymentActivity),
            });
        }
        console.log(`  → ${month}: CC Payment activity = ${ccPaymentActivity.toFixed(0)}`);
      }
    }
    console.log('');
  }

  console.log('Migration complete! ✓');
}

migrate().catch(console.error);
