DROP INDEX "idx_accounts_budget";--> statement-breakpoint
DROP INDEX "idx_budget_months_budget";--> statement-breakpoint
DROP INDEX "idx_category_groups_budget";--> statement-breakpoint
DROP INDEX "idx_transactions_account";--> statement-breakpoint
DROP INDEX "idx_transactions_account_date";--> statement-breakpoint
CREATE INDEX "idx_accounts_budget_type" ON "accounts" USING btree ("budget_id","type");--> statement-breakpoint
CREATE INDEX "idx_accounts_budget_type_closed" ON "accounts" USING btree ("budget_id","type","closed");--> statement-breakpoint
CREATE INDEX "idx_budget_months_budget_month" ON "budget_months" USING btree ("budget_id","month");--> statement-breakpoint
CREATE INDEX "idx_budget_months_budget_month_avail" ON "budget_months" USING btree ("budget_id","month","available");--> statement-breakpoint
CREATE INDEX "idx_category_groups_budget_income" ON "category_groups" USING btree ("budget_id","is_income");--> statement-breakpoint
CREATE INDEX "idx_transactions_account_date_cat" ON "transactions" USING btree ("account_id","date","category_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_budget_date_cat" ON "transactions" USING btree ("budget_id","date","category_id");