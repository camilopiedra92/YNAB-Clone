ALTER TABLE "accounts" ALTER COLUMN "balance" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "cleared_balance" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "uncleared_balance" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "budget_months" ALTER COLUMN "assigned" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "budget_months" ALTER COLUMN "activity" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "budget_months" ALTER COLUMN "available" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "outflow" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "inflow" SET DATA TYPE bigint;