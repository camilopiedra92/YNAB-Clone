-- ══════════════════════════════════════════════════════════════════════
-- MANUAL FIX: Transfer Ownership to App User
-- ══════════════════════════════════════════════════════════════════════
--
-- RUN THIS AS SUPERUSER (postgres) ON THE PRODUCTION DATABASE
--
-- Context:
-- If the database was restored from a backup or created by a different user
-- (e.g., 'postgres'), the application user ('ynab_app') might not have
-- permission to modify tables, functions, or types during migrations.
--
-- This script recursively transfers ownership of ALL objects in 'public'
-- to 'ynab_app'.
--
-- Usage:
-- docker exec -it <db-container-id> psql -U postgres -d ynab_prod -f fix-db-ownership.sql
--
-- ══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Transfer Tables
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO ynab_app', r.tablename);
    END LOOP;

    -- 2. Transfer Sequences
    FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO ynab_app', r.sequence_name);
    END LOOP;

    -- 3. Transfer Views
    FOR r IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
    LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO ynab_app', r.table_name);
    END LOOP;

    -- 4. Transfer Functions
    FOR r IN 
        SELECT n.nspname AS schema_name,
               p.proname AS function_name,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) OWNER TO ynab_app', r.schema_name, r.function_name, r.args);
    END LOOP;

    -- 5. Transfer Types (Enums)
    FOR r IN 
        SELECT t.typname AS type_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e' -- Only Enums created by user
    LOOP
        EXECUTE format('ALTER TYPE public.%I OWNER TO ynab_app', r.type_name);
    END LOOP;
    
    RAISE NOTICE 'Ownership transfer complete. All objects in public schema now owned by ynab_app.';
END $$;
