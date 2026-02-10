---
description: Run the Playwright E2E test suite to verify full-stack functionality
---

# E2E Tests

Runs Playwright E2E tests against an **isolated test database** (`ynab_test`).
The `globalSetup` automatically creates a fresh `ynab_test` DB, runs migrations,
and seeds it with canonical CSV data before tests run — your real data is never modified.

The test server runs a **production build** on **port 3001** (separate from the dev server on 3000).
This avoids port conflicts and `.next/dev/lock` issues, allowing E2E tests to run safely alongside the development server.

// turbo-all

1. Run the Playwright E2E tests:

```bash
npm run test:e2e
```
