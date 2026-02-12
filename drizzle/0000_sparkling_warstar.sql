DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit', 'cash', 'investment', 'tracking');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cleared_status') THEN
        CREATE TYPE "public"."cleared_status" AS ENUM('Cleared', 'Uncleared', 'Reconciled');
    END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"balance" numeric(19, 2) DEFAULT 0 NOT NULL,
	"cleared_balance" numeric(19, 2) DEFAULT 0 NOT NULL,
	"uncleared_balance" numeric(19, 2) DEFAULT 0 NOT NULL,
	"note" text DEFAULT '',
	"closed" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_months" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"month" text NOT NULL,
	"assigned" numeric(19, 2) DEFAULT 0 NOT NULL,
	"activity" numeric(19, 2) DEFAULT 0 NOT NULL,
	"available" numeric(19, 2) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_group_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"linked_account_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"is_income" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"date" date NOT NULL,
	"payee" text,
	"category_id" integer,
	"memo" text,
	"outflow" numeric(19, 2) DEFAULT 0 NOT NULL,
	"inflow" numeric(19, 2) DEFAULT 0 NOT NULL,
	"cleared" "cleared_status" DEFAULT 'Uncleared' NOT NULL,
	"flag" text,
	"created_at" text DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_transaction_id" integer NOT NULL,
	"to_transaction_id" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'budget_months_category_id_categories_id_fk') THEN
        ALTER TABLE "budget_months" ADD CONSTRAINT "budget_months_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_category_group_id_category_groups_id_fk') THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_category_group_id_category_groups_id_fk" FOREIGN KEY ("category_group_id") REFERENCES "public"."category_groups"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_linked_account_id_accounts_id_fk') THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transactions_account_id_accounts_id_fk') THEN
        ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transactions_category_id_categories_id_fk') THEN
        ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transfers_from_transaction_id_transactions_id_fk') THEN
        ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_transaction_id_transactions_id_fk" FOREIGN KEY ("from_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transfers_to_transaction_id_transactions_id_fk') THEN
        ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_transaction_id_transactions_id_fk" FOREIGN KEY ("to_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_months_cat_month" ON "budget_months" USING btree ("category_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_budget_months_category" ON "budget_months" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_budget_months_month" ON "budget_months" USING btree ("month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_account" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_category" ON "transactions" USING btree ("category_id");