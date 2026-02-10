---
description: Quick pre-flight smoke test (Env, DB, Lint, Types, Unit Tests, Build)
---

# Project Health Check (Pre-Flight)

A **fast smoke test** to quickly verify the project's integrity. Runs environment validation, database connectivity, linting, type-checking, unit tests, and a production build.

> For the **full QA suite** (security audit, coverage targets, E2E browser tests), use the `/test` workflow.

// turbo-all

## Run

```bash
npm run health:check
```

_(This script orchestrates: env checks → DB connectivity → lint → type-check → unit tests → production build.)_

## Troubleshooting

- **Database Connection Failed:**
  - Ensure PostgreSQL is running (`brew services start postgresql@14`).
  - Check `.env` for correct `DATABASE_URL`.
  - Verify with robust loading: `set -a && source .env && set +a && psql $DATABASE_URL -c "SELECT 1"`.
- **Lint/Type Errors:**
  - Run `npm run lint -- --fix` to auto-fix some issues.
- **Build Failed (prerender errors):**
  - If you see `TypeError: Cannot read properties of null (reading 'useState')` or `'useContext'`, ensure `NODE_ENV` is not set to a non-standard value. The build step explicitly sets `NODE_ENV=production`.
  - Run `npm install` to ensure deps are up to date.
  - Check for circular dependencies in the output.
