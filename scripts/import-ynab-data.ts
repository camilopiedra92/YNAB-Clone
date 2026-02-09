/**
 * YNAB CSV Data Importer
 *
 * Reads YNAB export CSV files (Register + Plan) and populates the database
 * using Drizzle ORM — no raw SQL or driver-specific APIs.
 *
 * Usage:
 *   npm run db:import
 */
import { importData } from '../lib/data-import';

// Run import
(async () => {
  try {
    await importData();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
})();
