import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import fs from 'fs';

import env from '../lib/env';

async function main() {
  const connectionString = env.DATABASE_URL;

  console.log('Running migrations against:', connectionString);

  // Use a single connection for migration
  const client = postgres(connectionString, { max: 1, onnotice: () => {} });

  // Retry logic for DB connection (Wait for DB to be ready)
  let retries = 5;
  while (retries > 0) {
    try {
      await client`SELECT 1`;
      break; // Connection successful
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('❌ Could not connect to database after 5 attempts.');
        throw err;
      }
      console.log(`⏳ Waiting for database... (${5 - retries}/5)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const db = drizzle(client);

  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  if (!fs.existsSync(migrationsFolder)) {
    console.warn(`Migrations folder not found at: ${migrationsFolder}`);
    return;
  }

  try {
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations applied successfully.');
  } catch (err) {
    console.error('❌ CRITICAL: Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
