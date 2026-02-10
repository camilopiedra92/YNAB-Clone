/**
 * Example: Adding a new table to lib/db/schema.ts
 *
 * After adding, run:
 *   npm run db:generate
 *   npm run db:migrate
 */
import { pgTable, serial, integer, bigint, text, timestamp } from 'drizzle-orm/pg-core';

// Reference existing tables for foreign keys
// import { budgets, categories } from './schema';

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  budgetId: integer('budget_id').notNull(), // .references(() => budgets.id)
  categoryId: integer('category_id').notNull(), // .references(() => categories.id)
  targetAmount: bigint('target_amount', { mode: 'number' }).notNull().default(0),
  targetDate: text('target_date'), // YYYY-MM format
  createdAt: timestamp('created_at').defaultNow(),
});
