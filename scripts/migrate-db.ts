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
  const client = postgres(connectionString, { max: 1 });
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
    console.error('⚠️ Migration failed:', err);
    if (process.env.NODE_ENV === 'production') {
      console.error('App will start with existing schema. Investigate migration failure.');
      // Don't exit — app may still work with the previous schema version
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
