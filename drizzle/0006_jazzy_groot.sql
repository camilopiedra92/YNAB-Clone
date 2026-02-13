-- Clean up duplicate transfer records before adding unique constraints.
-- Keeps only the row with the LOWEST id for each (from_transaction_id, to_transaction_id) pair.
DELETE FROM transfers
WHERE id NOT IN (
  SELECT MIN(id) FROM transfers GROUP BY from_transaction_id, to_transaction_id
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfers_from_tx_unique" ON "transfers" USING btree ("from_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfers_to_tx_unique" ON "transfers" USING btree ("to_transaction_id");