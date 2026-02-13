DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budget_shares' AND column_name = 'created_at') THEN
        ALTER TABLE "budget_shares" ADD COLUMN "created_at" timestamp DEFAULT now();
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_shares_budget_user" ON "budget_shares" USING btree ("budget_id","user_id");