CREATE TABLE IF NOT EXISTS "budget_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency_code" text DEFAULT 'COP' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"currency_decimals" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'budget_id') THEN
        ALTER TABLE "accounts" ADD COLUMN "budget_id" integer;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'category_groups' AND column_name = 'budget_id') THEN
        ALTER TABLE "category_groups" ADD COLUMN "budget_id" integer;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'budget_shares_budget_id_budgets_id_fk') THEN
        ALTER TABLE "budget_shares" ADD CONSTRAINT "budget_shares_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'budget_shares_user_id_users_id_fk') THEN
        ALTER TABLE "budget_shares" ADD CONSTRAINT "budget_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'budgets_user_id_users_id_fk') THEN
        ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'accounts_budget_id_budgets_id_fk') THEN
        ALTER TABLE "accounts" ADD CONSTRAINT "accounts_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'category_groups_budget_id_budgets_id_fk') THEN
        ALTER TABLE "category_groups" ADD CONSTRAINT "category_groups_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accounts_budget" ON "accounts" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_groups_budget" ON "category_groups" USING btree ("budget_id");