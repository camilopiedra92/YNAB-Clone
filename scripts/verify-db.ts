
import db from '../lib/repos/client';
import { sql } from 'drizzle-orm';

async function main() {
  const ivan = await db.execute(sql`SELECT * FROM transactions WHERE payee LIKE '%Iván%' OR payee LIKE '%IVÁN%'`);
  console.log('--- IVÁN Transactions in DB ---');
  console.log(ivan);

  const transferRows = await db.execute(sql`SELECT * FROM transactions WHERE payee LIKE 'Transfer :%' LIMIT 5`);
  console.log('\n--- Transfer Transactions in DB ---');
  console.log(transferRows);

  const linkedTransfers = await db.execute(sql`SELECT * FROM transfers LIMIT 5`);
  console.log('\n--- Linked Transfers Table ---');
  console.log(linkedTransfers);
}

main().catch(console.error);
