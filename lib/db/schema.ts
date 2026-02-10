/**
 * Drizzle ORM Schema Definition — Source of Truth
 *
 * This file defines all database tables and relations using Drizzle's
 * pg-core API for PostgreSQL.
 *
 * To generate migrations after modifying this file:
 *   npm run db:generate
 */
import { pgTable, pgEnum, serial, integer, text, boolean, date, index, uniqueIndex, customType, uuid, timestamp } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { ZERO, type Milliunit } from '../engine/primitives';

/**
 * Money column — PostgreSQL BIGINT storing Milliunits (1/1000 currency unit).
 *
 * Storage: BIGINT (integer) — eliminates all floating-point arithmetic errors.
 * Application: Milliunit branded type (number & brand).
 *
 * Examples:
 *   $10.50  → stored as 10500 (bigint)
 *   $0.01   → stored as 10    (bigint)
 *   -$5.00  → stored as -5000 (bigint)
 *
 * Safety:
 *   - `fromDriver`: validates the parsed value is a finite, safe integer
 *   - `toDriver`: validates before persisting — rejects NaN, Infinity, unsafe integers
 *
 * PostgreSQL drivers return BIGINT as strings (to handle values > 2^53),
 * but personal finance values are well within Number.MAX_SAFE_INTEGER ($9 quadrillion).
 */
const money = customType<{ data: Milliunit; driverData: string }>({
  dataType() {
    return 'bigint';
  },
  fromDriver(value: string): Milliunit {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(
        `[Financial Safety] Invalid monetary value from database: "${value}". ` +
        `Expected a finite numeric string.`
      );
    }
    return num as Milliunit;
  },
  toDriver(value: Milliunit): string {
    if (typeof value !== 'number' || isNaN(value) || !Number.isFinite(value)) {
      throw new Error(
        `[Financial Safety] Attempted to persist invalid monetary value: ${value} ` +
        `(type: ${typeof value}). This indicates a bug in upstream calculations.`
      );
    }
    const rounded = Math.round(value);
    if (!Number.isSafeInteger(rounded)) {
      throw new Error(
        `[Financial Safety] Value exceeds safe integer precision: ${value}. ` +
        `Max safe milliunit = ±${Number.MAX_SAFE_INTEGER} (≈ ±$9 quadrillion).`
      );
    }
    return String(rounded);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════

export const accountTypeEnum = pgEnum('account_type', [
  'checking', 'savings', 'credit', 'cash', 'investment', 'tracking',
]);

export const clearedStatusEnum = pgEnum('cleared_status', [
  'Cleared', 'Uncleared', 'Reconciled',
]);

// ═══════════════════════════════════════════════════════════════════════
// Tables
// ═══════════════════════════════════════════════════════════════════════

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text().notNull(), // bcrypt hash
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const budgets = pgTable('budgets', {
  id: serial().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  currencyCode: text('currency_code').notNull().default('COP'),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  currencyDecimals: integer('currency_decimals').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const budgetShares = pgTable('budget_shares', {
  id: serial().primaryKey(),
  budgetId: integer('budget_id')
    .notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text().notNull().default('editor'), // 'editor' | 'viewer'
});

export const accounts = pgTable('accounts', {
  id: serial().primaryKey(),
  budgetId: integer('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  type: accountTypeEnum().notNull(),
  balance: money().notNull().default(ZERO),
  clearedBalance: money('cleared_balance').notNull().default(ZERO),
  unclearedBalance: money('uncleared_balance').notNull().default(ZERO),
  note: text().default(''),
  closed: boolean().notNull().default(false),
  createdAt: text('created_at').default(sql`now()`),
}, (table) => [
  index('idx_accounts_budget').on(table.budgetId),
]);

export const categoryGroups = pgTable('category_groups', {
  id: serial().primaryKey(),
  budgetId: integer('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  hidden: boolean().notNull().default(false),
  isIncome: boolean('is_income').notNull().default(false),
}, (table) => [
  index('idx_category_groups_budget').on(table.budgetId),
]);

export const categories = pgTable('categories', {
  id: serial().primaryKey(),
  categoryGroupId: integer('category_group_id').notNull()
    .references(() => categoryGroups.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  hidden: boolean().notNull().default(false),
  linkedAccountId: integer('linked_account_id')
    .references(() => accounts.id, { onDelete: 'set null' }),
});

export const budgetMonths = pgTable('budget_months', {
  id: serial().primaryKey(),
  categoryId: integer('category_id').notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  month: text().notNull(),
  assigned: money().notNull().default(ZERO),
  activity: money().notNull().default(ZERO),
  available: money().notNull().default(ZERO),
}, (table) => [
  uniqueIndex('budget_months_cat_month').on(table.categoryId, table.month),
  index('idx_budget_months_category').on(table.categoryId),
  index('idx_budget_months_month').on(table.month),
]);

export const transactions = pgTable('transactions', {
  id: serial().primaryKey(),
  accountId: integer('account_id').notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  date: date({ mode: 'string' }).notNull(),
  payee: text(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  memo: text(),
  outflow: money().notNull().default(ZERO),
  inflow: money().notNull().default(ZERO),
  cleared: clearedStatusEnum().notNull().default('Uncleared'),
  flag: text(),
  createdAt: text('created_at').default(sql`now()`),
}, (table) => [
  index('idx_transactions_account').on(table.accountId),
  index('idx_transactions_date').on(table.date),
  index('idx_transactions_category').on(table.categoryId),
]);

export const transfers = pgTable('transfers', {
  id: serial().primaryKey(),
  fromTransactionId: integer('from_transaction_id').notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  toTransactionId: integer('to_transaction_id').notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
});

// ═══════════════════════════════════════════════════════════════════════
// Relations (for Drizzle relational queries)
// ═══════════════════════════════════════════════════════════════════════

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
  accounts: many(accounts),
  categoryGroups: many(categoryGroups),
  shares: many(budgetShares),
}));

export const budgetSharesRelations = relations(budgetShares, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetShares.budgetId],
    references: [budgets.id],
  }),
  user: one(users, {
    fields: [budgetShares.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  budget: one(budgets, {
    fields: [accounts.budgetId],
    references: [budgets.id],
  }),
  transactions: many(transactions),
}));

export const categoryGroupsRelations = relations(categoryGroups, ({ one, many }) => ({
  budget: one(budgets, {
    fields: [categoryGroups.budgetId],
    references: [budgets.id],
  }),
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  group: one(categoryGroups, {
    fields: [categories.categoryGroupId],
    references: [categoryGroups.id],
  }),
  linkedAccount: one(accounts, {
    fields: [categories.linkedAccountId],
    references: [accounts.id],
  }),
  budgetMonths: many(budgetMonths),
  transactions: many(transactions),
}));

export const budgetMonthsRelations = relations(budgetMonths, ({ one }) => ({
  category: one(categories, {
    fields: [budgetMonths.categoryId],
    references: [categories.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  fromTransaction: one(transactions, {
    fields: [transfers.fromTransactionId],
    references: [transactions.id],
    relationName: 'fromTransaction',
  }),
  toTransaction: one(transactions, {
    fields: [transfers.toTransactionId],
    references: [transactions.id],
    relationName: 'toTransaction',
  }),
}));
