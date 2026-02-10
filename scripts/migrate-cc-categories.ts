/**
 * ONE-TIME MIGRATION — Already applied. Kept for reference only.
 * Creates CC Payment categories linked to CC accounts.
 * Usage: npm run db:migrate-cc
 */
import { eq, and, sql, max, isNotNull } from 'drizzle-orm';
import db from '../lib/repos/client';
import * as schema from '../lib/db/schema';
import { yearMonth } from '../lib/db/sql-helpers';
import { milliunit, ZERO } from '../lib/engine/primitives';

async function migrate() {
  console.log('Starting Credit Card Payment categories migration...\n');

  // 1. Get all budgets
  const budgets = await db.select().from(schema.budgets);

  for (const budget of budgets) {
    console.log(`Processing budget: ${budget.name} (ID: ${budget.id})`);

    // Ensure "Credit Card Payments" category group exists for this budget
    const ccGroupRows = await db.select({ id: schema.categoryGroups.id })
        .from(schema.categoryGroups)
        .where(and(
            eq(schema.categoryGroups.name, 'Credit Card Payments'),
            eq(schema.categoryGroups.budgetId, budget.id)
        ));

    let ccGroup = ccGroupRows[0];

    if (!ccGroup) {
        const inserted = await db.insert(schema.categoryGroups)
        .values({
            budgetId: budget.id,
            name: 'Credit Card Payments',
            sortOrder: 0,
            hidden: false,
            isIncome: false,
        })
        .returning({ id: schema.categoryGroups.id });
        ccGroup = inserted[0];
        console.log(`✓ Created "Credit Card Payments" group (id=${ccGroup.id}).`);
    } else {
      // Ensure the group is visible and sorted first
      await db.update(schema.categoryGroups)
        .set({ hidden: false, sortOrder: 0 })
        .where(eq(schema.categoryGroups.id, ccGroup.id));
      console.log(`✓ "Credit Card Payments" group already exists (id=${ccGroup.id}), ensured visible.`);
    }

    // 2. Get all credit card accounts for this budget
    const creditAccounts = await db.select({
        id: schema.accounts.id,
        name: schema.accounts.name,
        balance: schema.accounts.balance,
    })
        .from(schema.accounts)
        .where(and(
            eq(schema.accounts.type, 'credit'),
            eq(schema.accounts.budgetId, budget.id)
        ));

    console.log(`Found ${creditAccounts.length} credit card accounts for budget ${budget.id}.\n`);

    for (const account of creditAccounts) {
        // Check if a CC Payment category already exists for this account
        const categoryRows = await db.select({ id: schema.categories.id, name: schema.categories.name })
          .from(schema.categories)
          .where(eq(schema.categories.linkedAccountId, account.id));

        let category = categoryRows[0];

        if (!category) {
          // Check if there's an existing category with the same name in the CC Payments group
          const namedCatRows = await db.select({ id: schema.categories.id, name: schema.categories.name })
            .from(schema.categories)
            .where(and(
              eq(schema.categories.categoryGroupId, ccGroup.id),
              eq(schema.categories.name, account.name),
            ));

          category = namedCatRows[0];

          if (category) {
            // Link the existing category
            await db.update(schema.categories)
              .set({ linkedAccountId: account.id })
              .where(eq(schema.categories.id, category.id));
            console.log(`✓ Linked existing category "${category.name}" (id=${category.id}) to account id=${account.id}`);
          } else {
            // Create new CC Payment category
            const maxOrderRows = await db.select({ maxOrder: max(schema.categories.sortOrder) })
              .from(schema.categories)
              .where(eq(schema.categories.categoryGroupId, ccGroup.id));
            const newOrder = (maxOrderRows[0]?.maxOrder || 0) + 1;

            const insertedRows = await db.insert(schema.categories)
              .values({
                name: account.name,
                categoryGroupId: ccGroup.id,
                sortOrder: newOrder,
                hidden: false,
                linkedAccountId: account.id,
              })
              .returning({ id: schema.categories.id, name: schema.categories.name });
            category = insertedRows[0];
            console.log(`✓ Created CC Payment category "${account.name}" (id=${category.id})`);
          }
        } else {
          console.log(`✓ CC Payment category already exists for "${account.name}" (category id=${category.id})`);
        }

        // 3. Calculate and set the Available for this CC Payment category
        // For each month that has transactions on this credit card
        const months = await db.selectDistinct({
          month: sql<string>`${yearMonth(schema.transactions.date)}`,
        })
          .from(schema.transactions)
          .where(eq(schema.transactions.accountId, account.id))
          .orderBy(yearMonth(schema.transactions.date));

        for (const { month } of months) {
          if (!month) continue;

          // Calculate funded spending on this CC for this month
          const spendingRows = await db.select({
            totalOutflow: sql<number>`COALESCE(SUM(${schema.transactions.outflow}), 0)`,
            totalInflow: sql<number>`COALESCE(SUM(${schema.transactions.inflow}), 0)`,
          })
            .from(schema.transactions)
            .where(and(
              eq(schema.transactions.accountId, account.id),
              sql`${yearMonth(schema.transactions.date)} = ${month}`,
              isNotNull(schema.transactions.categoryId),
            ));

          const spending = spendingRows[0];
          const ccPaymentActivity = (spending?.totalOutflow ?? 0) - (spending?.totalInflow ?? 0);

          if (ccPaymentActivity !== 0) {
            // Check if budget entry exists
            const existingRows = await db.select({
              id: schema.budgetMonths.id,
              assigned: schema.budgetMonths.assigned,
            })
              .from(schema.budgetMonths)
              .where(and(
                eq(schema.budgetMonths.categoryId, category.id),
                eq(schema.budgetMonths.month, month),
              ));

            const existing = existingRows[0];

            if (existing) {
              await db.update(schema.budgetMonths)
                .set({
                  activity: milliunit(ccPaymentActivity),
                  available: milliunit(existing.assigned + ccPaymentActivity),
                })
                .where(eq(schema.budgetMonths.id, existing.id));
            } else {
              await db.insert(schema.budgetMonths)
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
  }

  console.log('\nMigration complete! ✓');
}

migrate().catch(console.error);
