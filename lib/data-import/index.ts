/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * YNAB CSV Data Importer
 *
 * Reads YNAB export CSV files (Register + Plan) and populates the database
 * using Drizzle ORM — no raw SQL or driver-specific APIs.
 *
 * Usage:
 *   npx tsx scripts/import-ynab-data.ts
 */
import fs from 'fs';
import path from 'path';
import { eq, and, like, sql, inArray } from 'drizzle-orm';
import db from '../repos/client';
import {
  accounts,
  categoryGroups,
  categories,
  transactions,
  transfers,
  budgetMonths,
} from '../db/schema';
import { currentDate } from '../db/sql-helpers';
import { toMilliunits, milliunit, ZERO } from '../engine/primitives';

// ── CSV Parsing ──────────────────────────────────────────────────────

interface RegisterRow {
  Account: string;
  Flag: string;
  Date: string;
  Payee: string;
  'Category Group/Category': string;
  'Category Group': string;
  Category: string;
  Memo: string;
  Outflow: string;
  Inflow: string;
  Cleared: string;
}

interface PlanRow {
  Month: string;
  'Category Group/Category': string;
  'Category Group': string;
  Category: string;
  Assigned: string;
  Activity: string;
  Available: string;
}

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

function parseAmount(str: string): number {
  if (!str) return 0;
  // YNAB exports use US format: dot = decimal separator, comma = thousands separator
  // e.g. $60,611.00 or $60611.00
  const cleaned = str
    .replace(/[^0-9.,-]/g, '')   // keep only digits, dots, commas, minus
    .replace(/,/g, '');           // remove commas (thousands separator), keep dots (decimal)
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : Math.round(value * 100) / 100;
}

function parseDate(dateStr: string): string {
  // Convert DD/MM/YYYY to YYYY-MM-DD
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// ── Import Logic ─────────────────────────────────────────────────────

import env from '../env';


export async function importData(targetDb = db) {
  console.log('Starting YNAB data import...');

  // Use environment variables or default to the hardcoded paths for backward compatibility/local convenience
  // but prioritize env vars for better infrastructure practices.
  const envRegisterPath = env.YNAB_REGISTER_CSV;
  const envPlanPath = env.YNAB_PLAN_CSV;

  // Paths relative to project root as a base idea, but absolute paths from env are best
  const projectRoot = process.cwd();
  const defaultBaseDir = path.resolve(projectRoot, '..', 'YNAB Export - Compartido COP as of 2026-02-07 16-53');
  
  const registerPath = envRegisterPath || path.join(defaultBaseDir, 'Compartido COP as of 2026-02-07 16-53 - Register.csv');
  const planPath = envPlanPath || path.join(defaultBaseDir, 'Compartido COP as of 2026-02-07 16-53 - Plan.csv');

  if (!fs.existsSync(registerPath)) {
    console.error('Register CSV not found at:', registerPath);
    console.error('Please set YNAB_REGISTER_CSV environment variable.');
    return;
  }

  if (!fs.existsSync(planPath)) {
    console.error('Plan CSV not found at:', planPath);
    console.error('Please set YNAB_PLAN_CSV environment variable.');
    return;
  }

  const registerData = parseCSV(registerPath) as RegisterRow[];
  const planData = parseCSV(planPath) as PlanRow[];

  console.log(`Loaded ${registerData.length} transactions and ${planData.length} budget entries`);
  console.log('Register headers:', Object.keys(registerData[0] || {}));

  // Clear existing data (order matters for FK constraints)
  console.log('Clearing existing data...');
  await targetDb.delete(transfers);
  await targetDb.delete(transactions);
  await targetDb.delete(budgetMonths);
  await targetDb.delete(categories);
  await targetDb.delete(categoryGroups);
  await targetDb.delete(accounts);

  // Reset autoincrement sequences (PostgreSQL)
  // Note: We use execute() on the specific targetDb
  try {
    // Only attempt sequence reset if we have a way to execute raw SQL efficiently
    // Drizzle's execute is fine
    await targetDb.execute(sql`ALTER SEQUENCE accounts_id_seq RESTART WITH 1`);
    await targetDb.execute(sql`ALTER SEQUENCE category_groups_id_seq RESTART WITH 1`);
    await targetDb.execute(sql`ALTER SEQUENCE categories_id_seq RESTART WITH 1`);
    await targetDb.execute(sql`ALTER SEQUENCE transactions_id_seq RESTART WITH 1`);
    await targetDb.execute(sql`ALTER SEQUENCE transfers_id_seq RESTART WITH 1`);
    await targetDb.execute(sql`ALTER SEQUENCE budget_months_id_seq RESTART WITH 1`);
  } catch {
    // Sequences might not exist yet or have different names — skip
  }

  // ── Create Accounts ────────────────────────────────────────────

  const accountNames = new Set<string>();
  registerData.forEach(row => {
    if (row.Account && !row.Account.startsWith('Transfer :')) {
      accountNames.add(row.Account);
    }
  });

  console.log(`Found ${accountNames.size} accounts`);

  const accountMap = new Map<string, number>();
  for (const name of accountNames) {
    let type: 'checking' | 'savings' | 'credit' | 'cash' = 'checking';
    if (
      name.toLowerCase().includes('credit') ||
      name.toLowerCase().includes('mastercard') ||
      name.toLowerCase().includes('master card') ||
      name.toLowerCase().includes('visa') ||
      name.toLowerCase().includes('american express') ||
      name.toLowerCase().includes('amex') ||
      name.toLowerCase().includes('one rewards')
    ) {
      type = 'credit';
    } else if (name.toLowerCase().includes('efectivo') || name.toLowerCase().includes('cash')) {
      type = 'cash';
    } else if (name.toLowerCase().includes('fiducuenta') || name.toLowerCase().includes('investment')) {
      type = 'savings';
    } else if (name.toLowerCase().includes('ahorros') || name.toLowerCase().includes('savings')) {
      type = 'savings';
    }

    const result = await targetDb.insert(accounts)
      .values({
        name,
        type,
        balance: ZERO,
        clearedBalance: ZERO,
        unclearedBalance: ZERO,
      })
      .returning({ id: accounts.id });

    accountMap.set(name, result[0].id);
    console.log(`Created account: ${name} (${type})`);
  }

  // ── Create Category Groups & Categories ────────────────────────

  const categoryGroupMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const categoryData = new Map<string, Set<string>>();

  // 1. From transactions
  registerData.forEach(row => {
    const groupName = row['Category Group'];
    const categoryName = row.Category;
    if (groupName && categoryName) {
      if (!categoryData.has(groupName)) categoryData.set(groupName, new Set());
      categoryData.get(groupName)!.add(categoryName.trim());
    }
  });

  // 2. From budget plan (to catch categories with no transactions)
  planData.forEach(row => {
    const groupName = row['Category Group'];
    const categoryName = row.Category;
    if (groupName && categoryName) {
      if (!categoryData.has(groupName)) categoryData.set(groupName, new Set());
      categoryData.get(groupName)!.add(categoryName.trim());
    }
  });

  let groupSortOrder = 0;
  for (const [groupName, cats] of categoryData) {
    const isIncome = groupName === 'Inflow';
    const hidden = groupName.includes('Hidden');
    const isCreditCardPayments = groupName === 'Credit Card Payments';

    let sortOrder: number;
    if (isIncome) sortOrder = -1;
    else if (isCreditCardPayments) sortOrder = 0;
    else sortOrder = groupSortOrder++ + 1;

    const groupResult = await targetDb.insert(categoryGroups)
      .values({
        name: groupName,
        sortOrder,
        hidden,
        isIncome,
      })
      .returning({ id: categoryGroups.id });

    const groupId = groupResult[0].id;
    categoryGroupMap.set(groupName, groupId);

    let categorySortOrder = 0;
    for (const categoryName of cats) {
      let linkedAccountId: number | null = null;

      // Find account with the same name that is a credit card
      for (const [accName, accId] of accountMap.entries()) {
        if (accName === categoryName) {
          const accRows = await targetDb.select({ type: accounts.type })
            .from(accounts)
            .where(eq(accounts.id, accId));
          const acc = accRows[0];
          if (acc && acc.type === 'credit') {
            linkedAccountId = accId;
            console.log(`Linking category "${categoryName}" to credit account ID ${accId}`);
            break;
          }
        }
      }

      const catResult = await targetDb.insert(categories)
        .values({
          categoryGroupId: groupId,
          name: categoryName,
          sortOrder: categorySortOrder++,
          hidden: false,
          linkedAccountId,
        })
        .returning({ id: categories.id });

      categoryMap.set(`${groupName}:${categoryName}`, catResult[0].id);
    }

    console.log(`Created category group: ${groupName} with ${cats.size} categories`);
  }

  // ── Import Transactions ────────────────────────────────────────

  console.log('Importing transactions...');
  let transactionCount = 0;
  let skippedCount = 0;

  const transferIdMap = new Map<string, number>();

  for (let index = 0; index < registerData.length; index++) {
    const row = registerData[index];
    try {
      const accountName = row.Account;
      const accountId = accountMap.get(accountName);

      if (!accountId) {
        skippedCount++;
        continue;
      }

      const date = parseDate(row.Date);
      const payee = row.Payee;
      const memo = row.Memo;
      const outflow = parseAmount(row.Outflow);
      const inflow = parseAmount(row.Inflow);
      const cleared = row.Cleared || 'Uncleared';
      const flag = row.Flag || null;

      let categoryId: number | null = null;
      if (row['Category Group'] && row.Category) {
        const categoryKey = `${row['Category Group'].trim()}:${row.Category.trim()}`;
        categoryId = categoryMap.get(categoryKey) || null;
      }

      const result = await targetDb.insert(transactions)
        .values({
          accountId,
          date,
          payee,
          categoryId,
          memo,
          outflow: toMilliunits(outflow),
          inflow: toMilliunits(inflow),
          cleared: cleared as 'Cleared' | 'Uncleared' | 'Reconciled',
          flag,
        })
        .returning({ id: transactions.id });

      transactionCount++;

      // Track transfers for later linking
      if (payee && payee.startsWith('Transfer :')) {
        const transferKey = `${date}-${outflow || inflow}`;
        transferIdMap.set(transferKey, result[0].id);
      }

      if (transactionCount % 500 === 0) {
        console.log(`Imported ${transactionCount} transactions...`);
      }
    } catch (error) {
      console.error(`Error importing transaction ${index}:`, error);
      skippedCount++;
    }
  }

  console.log(`Imported ${transactionCount} transactions (skipped ${skippedCount})`);

  // ── Process Transfers ──────────────────────────────────────────

  console.log('Processing transfers...');
  let transferCount = 0;

  const potentialTransfers = await targetDb.select({
    id: transactions.id,
    accountId: transactions.accountId,
    date: transactions.date,
    outflow: transactions.outflow,
    inflow: transactions.inflow,
    payee: transactions.payee,
    accountName: accounts.name,
  })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(like(transactions.payee, 'Transfer : %'));

  const processedTransferIds = new Set<number>();

  for (const t1 of potentialTransfers) {
    if (processedTransferIds.has(t1.id)) continue;

    const targetAccountName = t1.payee!.substring(11); // Remove "Transfer : "
    const amount = t1.outflow > 0 ? t1.outflow : t1.inflow;
    const isOutflow = t1.outflow > 0;

    const match = potentialTransfers.find(t2 =>
      t2.id !== t1.id &&
      !processedTransferIds.has(t2.id) &&
      t2.date === t1.date &&
      ((isOutflow && t2.inflow === amount) || (!isOutflow && t2.outflow === amount)) &&
      t2.accountName === targetAccountName
    );

    if (match) {
      await targetDb.insert(transfers)
        .values({
          fromTransactionId: t1.id,
          toTransactionId: match.id,
        });

      processedTransferIds.add(t1.id);
      processedTransferIds.add(match.id);
      transferCount++;
    }
  }
  console.log(`Linked ${transferCount} transfers`);

  // ── Import Budget Data ─────────────────────────────────────────

  console.log('Importing budget data...');
  let budgetCount = 0;

  const monthNameToNum: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
  };

  for (const row of planData) {
    try {
      const month = row.Month;
      const groupName = row['Category Group'];
      const categoryName = row.Category;
      const assigned = parseAmount(row.Assigned);
      const activity = parseAmount(row.Activity);
      const available = parseAmount(row.Available);

      if (!month || !groupName || !categoryName) continue;

      const categoryKey = `${groupName.trim()}:${categoryName.trim()}`;
      const categoryId = categoryMap.get(categoryKey);

      if (!categoryId) continue;

      // Convert "Jan 2023" to "2023-01"
      const parts = month.trim().split(' ');
      if (parts.length !== 2) continue;

      const [monthName, year] = parts;
      if (!monthNameToNum[monthName]) continue;

      const monthStr = `${year}-${monthNameToNum[monthName]}`;

      await targetDb.insert(budgetMonths)
        .values({
          categoryId,
          month: monthStr,
          assigned: toMilliunits(assigned),
          activity: toMilliunits(activity),
          available: toMilliunits(available),
        })
        .onConflictDoUpdate({
          target: [budgetMonths.categoryId, budgetMonths.month],
          set: { assigned: toMilliunits(assigned), activity: toMilliunits(activity), available: toMilliunits(available) },
        });

      budgetCount++;
    } catch (error) {
      console.error('Error importing budget entry:', error, row);
    }
  }

  console.log(`Imported ${budgetCount} budget entries`);

  // ── Update Account Balances ────────────────────────────────────

  console.log('Updating account balances...');
  for (const [accountName, accountId] of accountMap) {
    const result = await targetDb.select({
      balance: sql<number>`SUM(${transactions.inflow} - ${transactions.outflow})`,
      clearedBalance: sql<number>`SUM(CASE WHEN ${transactions.cleared} IN ('Cleared', 'Reconciled') THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END)`,
      unclearedBalance: sql<number>`SUM(CASE WHEN ${transactions.cleared} = 'Uncleared' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END)`,
    })
      .from(transactions)
      .where(and(
        eq(transactions.accountId, accountId),
        sql`${transactions.date} <= ${currentDate()}`,
      ));

    const row = result[0];

    await targetDb.update(accounts)
      .set({
        balance: milliunit(Number(row?.balance) || 0),
        clearedBalance: milliunit(Number(row?.clearedBalance) || 0),
        unclearedBalance: milliunit(Number(row?.unclearedBalance) || 0),
      })
      .where(eq(accounts.id, accountId));
  }

  // ── Mark Closed Credit Card Accounts ───────────────────────────

  // Find CC accounts whose payment category is in "Hidden Categories"
  const hiddenCCNames = (await targetDb.select({ name: categories.name })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
    .where(eq(categoryGroups.name, 'Hidden Categories')))
    .map(r => r.name);

  if (hiddenCCNames.length > 0) {
    await targetDb.update(accounts)
      .set({ closed: true })
      .where(and(
        eq(accounts.type, 'credit'),
        inArray(accounts.name, hiddenCCNames),
      ));
  }

  console.log('Marked closed credit card accounts based on hidden categories');
  console.log('Data import completed successfully!');
}

