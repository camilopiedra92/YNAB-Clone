---
description: Run the full QA test suite (Audit, Lint, Build, Unit, E2E).
---

# Test: Full QA Suite (7 Layers)

Run this workflow to strictly verify the application before any deployment or major merge.
This is the **single source of truth** for quality assurance — it covers every layer from environment health to end-to-end browser testing.

> **Layer 0 (automatic):** Git hooks run lint + typecheck on every commit and unit tests on every push. This workflow covers the full suite for manual/CI verification.

// turbo-all

## Layer 1 — Environment & Database

Validate runtime prerequisites before running any code checks.

> **Note**: If you face `EPERM` errors on macOS/Linux, all `npm` scripts use `./scripts/with-local-tmp.sh` to redirect temp files to a local `.tmp/` directory. **DO NOT** set `NODE_ENV` in your `.env` file; let Next.js manage it automatically to avoid build inconsistencies.

```bash
# Check Node version, Database connectivity and critical variables
# Note: Uses 'source' for robust loading of variables with spaces/special characters
set -a && source .env && set +a && \
node -e "if(parseInt(process.version.slice(1))<18)process.exit(1)" && \
psql "${DATABASE_URL}" -c "SELECT 1" > /dev/null 2>&1 && \
echo "✓ Environment & Database Ok" || (echo "✗ Environment check failed: Ensure Node >= 18 and DATABASE_URL is set in .env." && exit 1)
```

## Layer 2 — Security Audit

Check for known vulnerabilities in dependencies.

```bash
./scripts/with-local-tmp.sh npm audit --audit-level=high
```

_If this fails, fix the vulnerabilities or explicitly ignore them if they are false positives._

## Layer 3 — Lint (Code Style)

```bash
npm run lint
```

## Layer 4 — Type Check (TypeScript Strict Mode)

```bash
npm run typecheck
```

_`--noEmit` checks types without generating files._

## Layer 5 — Build Verification

Verify that the Next.js application builds for production. Catches errors that dev mode often swallows (e.g., RSC serialization issues, missing env vars).

```bash
# We use NODE_ENV=production explicitly to ensure a clean build state
NEXT_TEST_BUILD=1 NODE_ENV=production npm run build
```

_Uses `NEXT_TEST_BUILD=1` to build into `.next-test/` — does NOT overwrite the dev server's `.next/` cache._

## Layer 6 — Unit Tests (with Coverage)

Verify business logic and core components.

```bash
npm run test:coverage
```

### Coverage Targets

| Module        | Metric             | Target    |
| ------------- | ------------------ | --------- |
| `lib/engine/` | Branch Coverage    | **100%**  |
| `lib/repos/`  | Statement Coverage | **> 80%** |
| `lib/utils/`  | Statement Coverage | **> 70%** |

## Layer 7 — End-to-End (E2E) Tests

Verify the full application flow in a real browser environment.

```bash
npm run test:e2e
```

_Playwright builds a production server on port 3001 (`.next-test/`), completely isolated from the dev server on port 3000. It uses an isolated `ynab_test` database. All scripts use `./scripts/with-local-tmp.sh` to avoid system permission issues._

---

## Developer Quick Commands

### Watch Mode (Fast TDD Feedback)

```bash
npm run test:watch
```

### Focused E2E Only

```bash
npm run test:e2e
```

See also: `/test-e2e` workflow for details on E2E isolation.
