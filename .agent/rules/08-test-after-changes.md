---
description: Mandatory testing and quality standards — zero regression policy, coverage targets, and milliunit test helpers
---

# Testing & Quality Standards

## 1. The "Zero Regression" Policy (Mandatory)

**No task is complete until all tests pass.**

- You **MUST** run the full test suite before marking any task as done.
- If a test fails, you **MUST** fix the code or the test immediately.
- **NEVER** skip, disable, or comment out failing tests to "make it pass".
- **NEVER** proceed with broken tests assuming "someone else will fix it".

> [!TIP]
> **Automatic enforcement:** Git hooks run lint + typecheck on every commit (`pre-commit`) and unit tests on every push (`pre-push`). Broken code can't be committed or pushed without `--no-verify`. See `15-git-branching-strategy.md` §5.

### 💡 Environment & Permission Caveats

- **Permission Errors (`EPERM`)**: All `npm` scripts use `./scripts/with-local-tmp.sh` to redirect temp files to a local `.tmp/` directory, bypassing system `/tmp` permission issues.
- **Robust `.env` Loading**: When running shell commands that depend on `.env` variables (like `psql`), use `set -a && source .env && set +a` instead of `export $(grep ...)`. This handles spaces and special characters in values correctly.
- **`NODE_ENV` management**: Do **NOT** set `NODE_ENV` in your `.env` file. Next.js manages this automatically. Setting it manually causes inconsistencies and non-standard environment warnings during builds.

## 2. When to Write Tests

You must create or update tests for **every** change:

| Change Type                | Requirement                                                                      |
| :------------------------- | :------------------------------------------------------------------------------- |
| **New logic** (engine/lib) | Create a new unit test file in `lib/__tests__/`. Verify all edge cases.          |
| **Bug fix**                | Add a regression test case that reproduces the bug, then fix it.                 |
| **Refactoring**            | Ensure existing tests cover the refactored code. run tests _before_ and _after_. |
| **New UI Feature**         | Create a new E2E test in `tests/` if it adds a new user flow.                    |
| **UI Update**              | Update existing E2E selectors if the DOM structure changes.                      |

## 3. Mandatory Usage: `npm run test:coverage`

Always run tests with code coverage to ensure you aren't leaving logic untested.

```bash
npm run test:coverage
```

### Coverage Goals:

- **Financial Engine (`lib/engine/`):** 100% Branch Coverage. (Financial math must be perfect).
- **Repositories (`lib/repos/`):** > 80% Statement Coverage.
- **Utils:** > 70% Statement Coverage.

## 4. Testing Financial Math (Milliunits)

We use a branded `Milliunit` type. **Function arguments in tests MUST use test helpers.**

### Do NOT Cast Manually

```typescript
// ❌ WRONG
updateAssignment(id, month, 500 as Milliunit);
```

### ✅ CORRECT: Use Helpers

Import `mu` and `ZERO` from `./test-helpers`:

```typescript
import { mu, ZERO } from "./test-helpers";

// ...
updateAssignment(id, month, mu(500)); // casts number to Milliunit
updateAssignment(id, month, ZERO); // optimized constant for 0
```

## 5. Workflows

### Unit Testing (Fast, Frequent)

Run this while developing logic:

```bash
npm run test:watch
```

### E2E Testing (Integration, Final Check)

Run this before finishing any UI-related task:

```bash
npm run test:e2e
```

> [!CAUTION]
> **NEVER run `npx vitest run` or `npx vitest` directly.** Always use `npm test`, `npm run test:watch`, or `npm run test:coverage`. Direct invocation bypasses `scripts/with-local-tmp.sh`, causing `EPERM: operation not permitted` errors in the sandboxed environment. See rule `10-dev-environment-tmpdir.md` for details.

**Note:** E2E tests run against an **isolated `ynab_test`** database on **port 3001**. The process is automatic and uses a **production build** (`next build && next start`) to avoid conflicts with your development server. All scripts use `./scripts/with-local-tmp.sh` to bypass macOS/Linux system directory restrictions.

## 6. What to Do If Tests Fail

1. **Read the Output:** The error message usually tells you exactly what logic failed.
2. **Fix the Core Issue:** Do not just adjust the test expectation unless the requirement changed.
3. **Re-run Coverage:** Verify the fix didn't break something else.
