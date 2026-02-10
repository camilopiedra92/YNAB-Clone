import { execSync } from 'child_process';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../lib/db/schema';
import { importData } from '../lib/data-import';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import bcrypt from 'bcryptjs';

import env from '../lib/env';
import {
  TEST_USER,
  ISOLATION_USER,
  TEST_DB_NAME,
  ADMIN_DB_NAME,
  BCRYPT_TEST_ROUNDS,
  replaceDbName,
} from './test-constants';

/**
 * Playwright Global Setup — E2E Database Isolation
 *
 * Creates a FRESH test database from scratch and seeds it with the canonical CSV data.
 * Also creates test users for authentication and tenant isolation.
 */
export default async function globalSetup() {
  const DEV_DB_URL = env.DATABASE_URL;

  // Safety guard: refuse to run against non-local databases
  if (!DEV_DB_URL.includes('localhost') && !DEV_DB_URL.includes('127.0.0.1')) {
    throw new Error(
      'E2E setup REFUSED: DATABASE_URL does not point to localhost. ' +
      `Got: ${DEV_DB_URL.replace(/\/\/.*@/, '//<redacted>@')}`
    );
  }

  const TEST_DB_URL = replaceDbName(DEV_DB_URL, TEST_DB_NAME);
  const ADMIN_DB_URL = replaceDbName(DEV_DB_URL, ADMIN_DB_NAME);

  console.log('E2E setup: Preparing fresh test database...');

  // 1. Drop and recreate the test DB using the postgres maintenance DB
  //    WITH (FORCE) kills any lingering connections (requires PG 13+)
  execSync(
    `psql "${ADMIN_DB_URL}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)"`,
    { stdio: 'inherit', timeout: 15_000 },
  );
  execSync(
    `psql "${ADMIN_DB_URL}" -c "CREATE DATABASE ${TEST_DB_NAME}"`,
    { stdio: 'inherit', timeout: 15_000 },
  );

  // 2. Connect to the new test DB
  const client = postgres(TEST_DB_URL, { max: 1 });

  try {
    const testDb = drizzle(client, { schema });

    // 3. Run Migrations (Schema Setup)
    console.log('E2E setup: Running migrations on', TEST_DB_NAME, '...');
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    await migrate(testDb, { migrationsFolder });

    // 4. Create Test User and Budget (Deterministic Data)
    console.log('E2E setup: Creating test user and budget...');
    const hashedPassword = await bcrypt.hash(TEST_USER.password, BCRYPT_TEST_ROUNDS);
    const [user] = await testDb.insert(schema.users).values({
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: hashedPassword,
    }).returning();

    const [budget] = await testDb.insert(schema.budgets).values({
      userId: user.id,
      name: 'Test Budget',
    }).returning();

    // 5. Seed Data from CSVs
    console.log('E2E setup: Seeding', TEST_DB_NAME, 'with canonical CSV data...');
    await importData(budget.id, testDb);

    // 6. Create Second Test User + Budget (for tenant isolation tests)
    console.log('E2E setup: Creating isolation user and budget...');
    const hashedPassword2 = await bcrypt.hash(ISOLATION_USER.password, BCRYPT_TEST_ROUNDS);
    const [user2] = await testDb.insert(schema.users).values({
      name: ISOLATION_USER.name,
      email: ISOLATION_USER.email,
      password: hashedPassword2,
    }).returning();

    await testDb.insert(schema.budgets).values({
      userId: user2.id,
      name: 'Isolation Budget',
    }).returning();

    console.log('E2E setup:', TEST_DB_NAME, 'ready!');
  } catch (error) {
    console.error('E2E setup failed:', error);
    throw error;
  } finally {
    // Always close the connection, even on failure
    await client.end();
  }
}
