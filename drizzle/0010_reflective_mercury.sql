CREATE INDEX "idx_budget_months_cat_month_desc" ON "budget_months" USING btree ("category_id",month DESC);--> statement-breakpoint
CREATE INDEX "idx_transactions_category_date" ON "transactions" USING btree ("category_id","date");--> statement-breakpoint
CREATE INDEX "idx_transactions_account_date" ON "transactions" USING btree ("account_id","date");