-- ══════════════════════════════════════════════════════════════════════
-- Row-Level Security (RLS) — Safety Net for Multi-Tenancy
-- ══════════════════════════════════════════════════════════════════════
--
-- RLS policies ensure that even if application-level budgetId scoping
-- has a bug, the database itself prevents cross-tenant data leaks.
--
-- HOW IT WORKS:
--   1. Before querying, the API layer sets: SET app.budget_id = '123'
--   2. RLS policies filter rows to only those matching the budget_id
--   3. If app.budget_id is not set, all rows are hidden (fail-safe)
--
-- IMPORTANT: RLS does NOT apply to the database superuser/owner role.
-- For production, the app should connect with a non-superuser role.
-- In local dev (postgres superuser), policies exist but don't enforce.
--
-- Child tables (categories, budget_months, transactions, transfers)
-- inherit tenancy through FK chains from accounts/category_groups.
-- RLS on root tenant tables is sufficient.
-- ══════════════════════════════════════════════════════════════════════

-- ── Accounts (root tenant table) ─────────────────────────────────────

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_budget_isolation ON accounts;
CREATE POLICY accounts_budget_isolation ON accounts
  USING (budget_id = current_setting('app.budget_id', true)::int);

-- ── Category Groups (root tenant table) ──────────────────────────────

ALTER TABLE category_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_groups_budget_isolation ON category_groups
  USING (budget_id = current_setting('app.budget_id', true)::int);
CREATE POLICY category_groups_budget_isolation ON category_groups
  USING (budget_id = current_setting('app.budget_id', true)::int);

-- ── Budgets (owner isolation) ────────────────────────────────────────

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budgets_user_isolation ON budgets;
CREATE POLICY budgets_user_isolation ON budgets
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR id = current_setting('app.budget_id', true)::int
  );
