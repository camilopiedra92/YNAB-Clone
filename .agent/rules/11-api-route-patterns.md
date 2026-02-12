---
description: Mandatory patterns for Next.js App Router API routes
---

# API Route Patterns

This file defines the **MANDATORY** conventions for all API routes in `app/api/`. Every route must follow these patterns for consistency, security, and maintainability.

## 1. File Structure

Routes live under `app/api/budgets/[budgetId]/` for budget-scoped data:

```
app/api/
├── auth/[...nextauth]/route.ts    # NextAuth handler (don't touch)
├── auth/register/route.ts         # User registration
├── budgets/route.ts               # List/create budgets (uses withUserContext)
└── budgets/[budgetId]/
    ├── route.ts                   # Budget CRUD
    ├── accounts/route.ts          # Account operations
    ├── transactions/route.ts      # Transaction operations
    ├── categories/route.ts        # Category operations
    └── ...
```

Legacy routes at `app/api/transactions/route.ts` (flat) are deprecated. New routes **MUST** be nested under `budgets/[budgetId]/`.

## 2. Transaction-per-Request Architecture (Critical)

**All budget-scoped routes MUST use `withBudgetAccess()`.** This wrapper replaces the old `requireBudgetAccess()` pattern and solves the connection pooling + RLS problem.

### Why the transaction wrapper is required

PostgreSQL `set_config()` is per-connection, but connection pooling distributes queries across different connections. Without a transaction, `set_config('app.budget_id', ...)` may be set on connection A, while the actual query runs on connection B — causing RLS policy violations.

`withBudgetAccess()` wraps the ENTIRE handler in a single DB transaction, guaranteeing all queries share one connection.

### Budget-scoped routes: `withBudgetAccess()`

```typescript
import { NextResponse } from "next/server";
import { withBudgetAccess } from "@/lib/with-budget-access";
import { validateBody, SomeSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseInt(budgetIdStr, 10);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const data = await repos.getSomething(budgetId);
    return NextResponse.json(data);
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseInt(budgetIdStr, 10);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const body = await request.json();
    const validation = validateBody(SomeSchema, body);
    if (!validation.success) return validation.response;

    const result = await repos.createSomething(budgetId, validation.data);
    return NextResponse.json(result, { status: 201 });
  });
}
```

### What `withBudgetAccess()` does internally

1. Authenticates the user via `auth()`
2. Validates `budgetId` as a positive integer
3. Opens a DB transaction
4. Sets `app.user_id` and `app.budget_id` via `set_config(..., true)` (transaction-local)
5. Verifies budget access (owner or shared via `budget_shares`)
6. Creates transaction-scoped repos via `createDbFunctions(tx)`
7. Passes `tenant`, `repos`, and raw `tx` to the handler

**File:** `lib/with-budget-access.ts`

### Non-budget routes: `withUserContext()`

For routes that only need `userId` (e.g., `GET /api/budgets`), use the local `withUserContext()` helper defined in the route file:

```typescript
import { sql } from "drizzle-orm";
import db from "@/lib/db/client";
import { createDbFunctions } from "@/lib/db/client";

async function withUserContext<T>(
  userId: string,
  fn: (repos) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.user_id', ${userId}, true),
                 set_config('app.budget_id', ${"0"}, true)`,
    );
    const repos = createDbFunctions(tx as any);
    return fn(repos);
  });
}
```

> [!IMPORTANT]
> Always set BOTH `app.user_id` and `app.budget_id` in every transaction. Use `'0'` as the budget_id default for non-budget routes. This prevents `''::integer` cast errors in RLS policies on pooled connections.

## 3. Rules

### Required

- ✅ **Always use `withBudgetAccess()`** for budget-scoped routes — it handles auth, access check, RLS, and transaction
- ✅ **Always use `repos.*` functions** from the handler callback — never import repos directly
- ✅ **Always `await params`** before accessing route params (Next.js 15+ async params)
- ✅ **Always wrap non-`withBudgetAccess` code in `try/catch`** — `withBudgetAccess` handles its own errors internally
- ✅ **Always use `logger.error()`** for error logging (structured JSON in production)

### Forbidden

- ❌ **Never use `requireBudgetAccess()`** — replaced by `withBudgetAccess()` (function still exists for backward compat but MUST NOT be used in new code)
- ❌ **Never import `db` directly in routes** — use `repos` from `withBudgetAccess` callback or `withUserContext`
- ❌ **Never return database rows directly** — transform via DTO functions from `lib/dtos/`
- ❌ **Never use `console.error`** — use `logger.error()` from `lib/logger.ts`
- ❌ **Never set RLS variables (`set_config`) outside of a transaction** — it won't persist with connection pooling

## 4. Input Validation (Zod)

All write operations MUST validate the request body using `validateBody()`:

```typescript
const validation = validateBody(CreateTransactionSchema, body);
if (!validation.success) return validation.response;
const data = validation.data; // ← fully typed
```

### Rules

- Schemas live in `lib/schemas/*.ts` and are exported from `lib/schemas/index.ts`
- Schemas use **camelCase** keys (matching the API contract)
- `validateBody()` returns a `400` with structured error details on failure
- **Never** parse request bodies without Zod validation

## 5. Response Format

| Status | Format                                            | When                     |
| ------ | ------------------------------------------------- | ------------------------ |
| `200`  | `NextResponse.json(data)`                         | Successful read/update   |
| `201`  | `NextResponse.json(data, { status: 201 })`        | Successful creation      |
| `400`  | `apiError('message', 400)` or validation response | Validation / bad input   |
| `401`  | Handled by `withBudgetAccess()`                   | Not authenticated        |
| `403`  | Handled by `withBudgetAccess()`                   | Forbidden (wrong tenant) |
| `404`  | `apiError('Not found', 404)`                      | Resource not found       |
| `500`  | `apiError('Failed to ...', 500)`                  | Unexpected server error  |

### Rules

- Successful responses return the **data directly** (array or object), not wrapped in `{ data: ... }`
- Error responses use `apiError()` from `lib/api-error.ts` for consistent shape
- Validation errors include a `details` field with field-level error messages

## 6. DTOs (Data Transfer Objects)

- Defined in `lib/dtos/`
- Convert snake_case DB columns to camelCase API fields
- Convert Milliunits (bigint) to display numbers where appropriate
- **ALWAYS** use DTO transforms — never leak raw DB rows to the client

## 7. Handler Callback Signature

The `withBudgetAccess` handler receives three arguments:

```typescript
withBudgetAccess(budgetId, async (tenant, repos, tx) => {
  // tenant: { userId: string, budgetId: number }
  // repos:  transaction-scoped repository functions (ALL queries on same connection)
  // tx:     raw Drizzle transaction (for functions like importDataFromCSV that accept DrizzleDB)
});
```

Use `repos` for all standard operations. Use `tx` only when passing the connection to external functions that need raw DB access (e.g., data import).
