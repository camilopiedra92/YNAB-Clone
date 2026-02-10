---
name: create-e2e-test
description: Guide for writing Playwright E2E tests with the project's auth, helpers, and isolation patterns
---

# Skill: Create E2E Test

Use this skill when adding a **new Playwright E2E test spec**. See `examples/` for annotated reference tests.

## Infrastructure

| File                      | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `playwright.config.ts`    | Serial execution, 1 worker, port 3001, auth project        |
| `tests/global-setup.ts`   | Creates fresh `ynab_test` DB, seeds CSV data, 2 users      |
| `tests/auth.setup.ts`     | Logs in as `TEST_USER`, saves session to `.auth/user.json` |
| `tests/test-constants.ts` | Credentials, URLs, DB names                                |
| `tests/e2e-helpers.ts`    | Navigation helpers                                         |

## Steps

### 1. Create the spec file

```
tests/<feature-name>.spec.ts
```

Use the template from [examples/example.spec.ts](examples/example.spec.ts).

### 2. Use navigation helpers (mandatory)

```typescript
import {
  gotoBudgetPage,
  gotoFirstAccount,
  getTestBudgetId,
} from "./e2e-helpers";
```

| Helper                            | What it does                                           |
| --------------------------------- | ------------------------------------------------------ |
| `gotoBudgetPage(page, request)`   | Navigate + wait for `budget-table`, returns `budgetId` |
| `gotoFirstAccount(page, request)` | Navigate + click first sidebar account                 |
| `getTestBudgetId(request)`        | Fetch budgetId via API (cached)                        |
| `budgetUrl(budgetId)`             | Returns `/budgets/{id}/budget`                         |
| `accountUrl(budgetId, accountId)` | Returns `/budgets/{id}/accounts/{accountId}`           |
| `allAccountsUrl(budgetId)`        | Returns `/budgets/{id}/accounts`                       |

**Never hardcode URLs** — SaaS routes use `/budgets/[id]/budget`, not `/budget`.

### 3. Use `data-testid` selectors

```typescript
page.getByTestId("rta-amount");
page.locator('[data-testid^="category-row-"]'); // prefix match
page.locator('[data-testid^="sidebar-account-"]');
```

### 4. Wait for server roundtrips after mutations

```typescript
await page.getByTestId("save-button").click();
await page.waitForResponse(
  (resp) => resp.url().includes("/api/budgets/") && resp.status() === 200,
);
await expect(page.getByTestId("value")).toHaveText("Updated");
```

### 5. Run

```bash
npm run test:e2e                              # full suite
npm run test:e2e -- tests/my-feature.spec.ts  # single file
npm run test:e2e -- --ui                      # debug UI
```

## Special Patterns

- **Animated values (RTA):** Poll for stability — see [examples/example.spec.ts](examples/example.spec.ts)
- **Tenant isolation:** Login as `ISOLATION_USER` manually — see [examples/isolation.spec.ts](examples/isolation.spec.ts)
- **Auth is automatic:** `auth.setup.ts` runs first, all specs use `TEST_USER` session

## Common Pitfalls

| Pitfall                        | Fix                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Wrong URL                      | Use helpers, not `page.goto('/budget')`                                      |
| Intermittent assertion failure | Wait for server roundtrip before asserting                                   |
| RTA shows `$ 0,00`             | Poll for animated value stability                                            |
| Login fails                    | UI labels are in Spanish (`Contraseña`, `Iniciar Sesión`)                    |
| `storageState` not found       | `auth-setup` project runs as dependency (configured in playwright.config.ts) |

## Examples Directory

| File                                            | Pattern                                                  |
| ----------------------------------------------- | -------------------------------------------------------- |
| [example.spec.ts](examples/example.spec.ts)     | Standard test with navigation, mutation, animated values |
| [isolation.spec.ts](examples/isolation.spec.ts) | Tenant isolation with manual login                       |
