-- ══════════════════════════════════════════════════════════════
-- Production Database User for RLS Enforcement
-- ══════════════════════════════════════════════════════════════
--
-- RUN ONCE on the production PostgreSQL instance.
-- This creates a restricted role (ynab_app) with only DML permissions.
-- RLS policies in drizzle/0006_security_rls.sql are bypassed when
-- connecting as the postgres superuser — this role makes them enforce.
--
-- Usage:
--   psql -U postgres -d ynab_prod -f create-prod-user.sql
--
-- After running, update DATABASE_URL in Coolify:
--   postgresql://ynab_app:<password>@<host>:5432/ynab_prod
-- ══════════════════════════════════════════════════════════════

-- 1. Create the role (REPLACE the password before running!)
CREATE ROLE ynab_app LOGIN PASSWORD '<generate-strong-password>';

-- 2. Grant database access
GRANT CONNECT ON DATABASE ynab_prod TO ynab_app;
GRANT USAGE ON SCHEMA public TO ynab_app;

-- 3. Grant table permissions (SELECT, INSERT, UPDATE, DELETE — no DROP, ALTER, TRUNCATE)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ynab_app;

-- 4. Grant sequence permissions (for serial/auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ynab_app;

-- 5. Set defaults for future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ynab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ynab_app;

-- 6. Grant migration table access (Drizzle migration runner needs INSERT + SELECT)
GRANT ALL ON TABLE __drizzle_migrations TO ynab_app;

-- ── Verification ─────────────────────────────────────────────
-- Connect as ynab_app and verify RLS enforces:
--   SET app.budget_id = '1';
--   SELECT * FROM accounts;  -- Should only return accounts for budget_id=1
--
--   RESET app.budget_id;
--   SELECT * FROM accounts;  -- Should return ZERO rows (fail-safe)
