# Deployment & Architectural Audit

**Date:** 2026-02-12
**Scope:** Deployment pipeline, Docker configuration, Database migrations, Entrypoint logic.

## Executive Summary

The current deployment setup is **90% production-ready** but contains **one critical stability flaw** that prevents database migrations from failing safely. This explains why migrations might appear to "not run" or why the app might start with an outdated schema.

## Critical Findings 🚨

### 1. Silent Failure of Migrations in Production

**Severity:** Critical
**File:** `scripts/migrate-db.ts`

The migration script explicitly suppresses errors when running in `production` mode:

```typescript
if (process.env.NODE_ENV === "production") {
  console.error(
    "App will start with existing schema. Investigate migration failure.",
  );
  // Don't exit — app may still work with the previous schema version
} else {
  process.exit(1);
}
```

**Impact:**

- If the migration fails (e.g., DB connection timeout, lock, SQL error), the script logs an error but **exits with code 0 (success)**.
- The `docker-entrypoint.sh` checks for success (`if npm run db:migrate:prod; then ...`).
- Since the script "succeeded" (exit code 0), the container continues to start the application with an **out-of-sync database**.
- This creates a dangerous state where the code expects columns/tables that do not exist, leading to runtime crashes or data corruption.

**Recommendation:**
Fail hard. If migrations fail, the container **must** crash and restart (looping) until the issue is fixed. This alerts the orchestration layer (Coolify) that the deployment is unhealthy.

## Architectural Review 🏗️

### Docker Building (Grade: A)

- **Multi-stage build:** Correctly used to minimize image size.
- **Standalone mode:** Next.js standalone output is used efficiently.
- **Security:** Runs as non-root user (`nextjs`).
- **Optimization:** Dependencies layer caching is implemented correctly.

### Configuration Management (Grade: A)

- **Environment Validation:** `lib/env.ts` using Zod is world-class. It ensures the app refuses to start if configuration is missing.
- **Build vs Runtime:** Separation of build-time args and runtime envs is handled correctly in the Dockerfile.

### Database Strategy (Grade: B+)

- **Tooling:** Drizzle + Postgres.js is a high-performance modern stack.
- **Transactions:** Drizzle migrations are transactional by default (good).
- **Missing:** The entrypoint script lacks a "wait-for-db" mechanism. In cloud environments, the DB container might take a few seconds longer to start than the app container. Relying solely on the migration script's connection logic can be flaky if it doesn't retry.

## Recommended Improvements

### 1. Fix the Migration Script (Immediate Priority)

Remove the `try/catch` logic that swallows errors in production.

```typescript
// scripts/migrate-db.ts
} catch (err) {
    console.error('❌ CRITICAL: Migration failed:', err);
    process.exit(1); // ALWAYS exit with error
}
```

### 2. Implement Connection Retry

Add a simple retry loop or `wait-for` logic in `docker-entrypoint.sh` or the migration script to handle "Database starting up" states gracefully.

### 3. Verify Coolify Configuration

Ensure Coolify is pointing to the `Dockerfile` for the build strategy, not Nixpacks (unless configured carefully), as Nixpacks might ignore the custom entrypoint logic if not explicitly set.

## Conclusion

The architecture is solid. The "silent failure" logic was likely added as a temporary safety measure ("keep the app running") but is actually an anti-pattern in container orchestration. Fixing this single line of code will resolve the deployment consistency issues.
