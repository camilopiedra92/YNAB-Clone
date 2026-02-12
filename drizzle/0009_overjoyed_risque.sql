DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'budget_id') THEN
        ALTER TABLE "transfers" ADD COLUMN "budget_id" integer;
    END IF;
END $$;

-- 2. Backfill budget_id from transactions
-- A transfer links two transactions (from_transaction_id, to_transaction_id).
-- Both transactions must belong to the same budget.
UPDATE transfers t
SET budget_id = trx.budget_id
FROM transactions trx
WHERE t."from_transaction_id" = trx.id;

-- 3. Enforce NOT NULL (now that data is backfilled)
ALTER TABLE "transfers" ALTER COLUMN "budget_id" SET NOT NULL;

-- 4. Add Constraints & Indexes
DO $$ BEGIN
 ALTER TABLE "transfers" ADD CONSTRAINT "transfers_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "idx_transfers_budget" ON "transfers" USING btree ("budget_id");

-- 5. Enable RLS on Transfers
ALTER TABLE "transfers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transfers_budget_isolation ON transfers;
CREATE POLICY transfers_budget_isolation ON transfers
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);

-- 6. Enable RLS on User Metadata Tables (Users, Budget Shares)

-- Users Table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own record.
-- NOTE: This effectively blocks 'SELECT * FROM users'.
-- For Login and Sharing, we use the privileged function defined below.
DROP POLICY IF EXISTS users_self_isolation ON users;
CREATE POLICY users_self_isolation ON users
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Budget Shares Table
ALTER TABLE "budget_shares" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see shares where they are the target user OR the share belongs to the current budget scope.
DROP POLICY IF EXISTS budget_shares_authed_access ON budget_shares;
CREATE POLICY budget_shares_authed_access ON budget_shares
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR 
    budget_id = NULLIF(current_setting('app.budget_id', true), '')::int
  );

-- 7. Privileged User Lookup Function (SECURITY DEFINER)
-- Needed for:
-- 1. Login (requires fetching user by email before app.user_id is set)
-- 2. Sharing (requires finding another user by email to share with)
-- This function runs with the privileges of the CREATOR (superuser/owner), bypassing RLS.

CREATE OR REPLACE FUNCTION get_user_by_email_privileged(target_email text)
RETURNS SETOF users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM users WHERE email = target_email;
$$;