import db from '../lib/db';

const ivan = db.prepare("SELECT * FROM transactions WHERE payee LIKE '%Iván%' OR payee LIKE '%IVÁN%'").all();
console.log('--- IVÁN Transactions in DB ---');
console.log(ivan);

const transfers = db.prepare("SELECT * FROM transactions WHERE payee LIKE 'Transfer :%' LIMIT 5").all();
console.log('\n--- Transfer Transactions in DB ---');
console.log(transfers);

const linkedTransfers = db.prepare("SELECT * FROM transfers LIMIT 5").all();
console.log('\n--- Linked Transfers Table ---');
console.log(linkedTransfers);
