DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budget_months' AND column_name = 'budget_id') THEN
        ALTER TABLE "budget_months" ADD COLUMN "budget_id" integer;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'budget_id') THEN
        ALTER TABLE "categories" ADD COLUMN "budget_id" integer;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'budget_id') THEN
        ALTER TABLE "transactions" ADD COLUMN "budget_id" integer;
    END IF;
END $$;

-- Backfill data
-- 1. Categories (from Category Groups)
UPDATE categories c
SET budget_id = cg.budget_id
FROM category_groups cg
WHERE c.category_group_id = cg.id;

-- 2. Transactions (from Accounts)
UPDATE transactions t
SET budget_id = a.budget_id
FROM accounts a
WHERE t.account_id = a.id;

-- 3. Budget Months (from Categories, now that they have budget_id)
UPDATE budget_months bm
SET budget_id = c.budget_id
FROM categories c
WHERE bm.category_id = c.id;

-- Enforce NOT NULL constraints (now that data is backfilled)
ALTER TABLE "budget_months" ALTER COLUMN "budget_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "budget_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "budget_id" SET NOT NULL;

-- Add Foreign Keys
DO $$ BEGIN
 ALTER TABLE "budget_months" ADD CONSTRAINT "budget_months_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add Indexes for Performance
CREATE INDEX IF NOT EXISTS "idx_budget_months_budget" ON "budget_months" USING btree ("budget_id");
CREATE INDEX IF NOT EXISTS "idx_categories_budget" ON "categories" USING btree ("budget_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_budget" ON "transactions" USING btree ("budget_id");

-- Enable RLS on new tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create Policies (O(1) Check)
-- using NULLIF to handle connection pooling edge cases
CREATE POLICY categories_budget_isolation ON categories
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);

CREATE POLICY budget_months_budget_isolation ON budget_months
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);

CREATE POLICY transactions_budget_isolation ON transactions
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);