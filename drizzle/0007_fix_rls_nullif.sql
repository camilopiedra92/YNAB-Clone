-- ══════════════════════════════════════════════════════════════════════
-- Fix RLS Policies — Handle empty string in session variables
-- ══════════════════════════════════════════════════════════════════════
--
-- PROBLEM: With connection pooling, session variables may be set to ''
-- (empty string) from a previous request on the same connection.
-- current_setting('app.budget_id', true) returns '' instead of NULL,
-- and ''::integer throws: "invalid input syntax for type integer"
--
-- FIX: Use NULLIF to convert '' to NULL before casting.
-- NULL::integer = NULL, and budget_id = NULL evaluates to FALSE (safe).
-- ══════════════════════════════════════════════════════════════════════

-- Drop and recreate all RLS policies with NULLIF protection

-- ── Accounts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS accounts_budget_isolation ON accounts;
CREATE POLICY accounts_budget_isolation ON accounts
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);

-- ── Category Groups ──────────────────────────────────────────────────
DROP POLICY IF EXISTS category_groups_budget_isolation ON category_groups;
CREATE POLICY category_groups_budget_isolation ON category_groups
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);

-- ── Budgets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS budgets_user_isolation ON budgets;
CREATE POLICY budgets_user_isolation ON budgets
  USING (
    user_id::text = NULLIF(current_setting('app.user_id', true), '')
    OR id = NULLIF(current_setting('app.budget_id', true), '')::int
  );
