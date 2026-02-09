import { execSync } from 'child_process';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../lib/db/schema';
import { DrizzleDB } from '../lib/repos/client';
import { importData } from '../lib/data-import';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';

import env from '../lib/env';

/**
 * Playwright Global Setup — E2E Database Isolation
 *
 * Creates a FRESH test database from scratch and seeds it with the canonical CSV data.
 * This ensures tests run against a deterministic dataset, independent of the
 * developer's local 'ynab_dev' state.
 */
export default async function globalSetup() {
  const DEV_DB_URL = env.DATABASE_URL;
  const TEST_DB_URL = DEV_DB_URL.replace(/\/([^\/]+)$/, '/ynab_test');

  console.log('E2E setup: Preparing fresh test database...');

  try {
    // 1. Recreate Test Database (Drop & Create)
    // We connect to DEV_DB to execute these metadata commands safely
    execSync(`psql "${DEV_DB_URL}" -c "DROP DATABASE IF EXISTS ynab_test"`, { stdio: 'inherit' });
    execSync(`psql "${DEV_DB_URL}" -c "CREATE DATABASE ynab_test"`, { stdio: 'inherit' });

    // 2. Connect to the new Test DB
    const client = postgres(TEST_DB_URL, { max: 1 });
    const testDb = drizzle(client, { schema }) as DrizzleDB;

    // 3. Run Migrations (Schema Setup)
    console.log('E2E setup: Running migrations on ynab_test...');
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    await migrate(testDb, { migrationsFolder });

    // 4. Seed Data from CSVs (Deterministic Data)
    console.log('E2E setup: Seeding ynab_test with canonical CSV data...');
    await importData(testDb); 

    // 5. Cleanup
    await client.end();

    console.log('E2E setup: ynab_test ready!');
  } catch (error) {
    console.error('E2E setup failed:', error);
    throw error;
  }
}
