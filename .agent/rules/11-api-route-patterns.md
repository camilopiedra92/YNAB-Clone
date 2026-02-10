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
├── budgets/route.ts               # List/create budgets
└── budgets/[budgetId]/
    ├── route.ts                   # Budget CRUD
    ├── accounts/route.ts          # Account operations
    ├── transactions/route.ts      # Transaction operations
    ├── categories/route.ts        # Category operations
    └── ...
```

Legacy routes at `app/api/transactions/route.ts` (flat) are deprecated. New routes **MUST** be nested under `budgets/[budgetId]/`.

## 2. Route Handler Skeleton (Required Pattern)

Every handler MUST follow this exact structure:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireBudgetAccess } from "@/lib/auth-helpers";
import { validateBody, SomeSchema } from "@/lib/schemas";
import { toSomeDTO } from "@/lib/dtos";

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Extract and parse budgetId (Next.js 15: params is a Promise)
    const { budgetId: budgetIdStr } = await params;
    const budgetId = parseInt(budgetIdStr, 10);

    // 2. Auth + tenant check (MANDATORY for every handler)
    const access = await requireBudgetAccess(budgetId);
    if (!access.ok) return access.response;

    // 3. Business logic (via repos — never inline SQL)
    const data = await getSomething(budgetId);

    // 4. Transform to DTO (camelCase) and respond
    return NextResponse.json(data.map(toSomeDTO));
  } catch (error) {
    console.error("Error fetching X:", error);
    return NextResponse.json({ error: "Failed to fetch X" }, { status: 500 });
  }
}
```

### Rules

- ❌ **Never skip `requireBudgetAccess()`** — it enforces auth + tenant isolation + RLS
- ❌ **Never import `db` directly in routes** — use repo functions from `lib/repos/`
- ❌ **Never return database rows directly** — transform via DTO functions from `lib/dtos/`
- ❌ **Never use `params.budgetId` directly** — `await params` first (Next.js 15 async params)
- ✅ **Always wrap in `try/catch`** — catch-all returns 500 with `console.error` for debugging
- ✅ **Always `console.error` in catch blocks** — include context about which operation failed

## 3. Input Validation (Zod)

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

## 4. Response Format

| Status | Format                                                 | When                     |
| ------ | ------------------------------------------------------ | ------------------------ |
| `200`  | `NextResponse.json(data)`                              | Successful read/update   |
| `201`  | `NextResponse.json(data, { status: 201 })`             | Successful creation      |
| `400`  | `NextResponse.json({ error: '...' }, { status: 400 })` | Validation / bad input   |
| `401`  | Handled by `requireBudgetAccess()`                     | Not authenticated        |
| `403`  | `NextResponse.json({ error: '...' }, { status: 403 })` | Forbidden (wrong tenant) |
| `404`  | `NextResponse.json({ error: '...' }, { status: 404 })` | Resource not found       |
| `500`  | `NextResponse.json({ error: '...' }, { status: 500 })` | Unexpected server error  |

### Rules

- Successful responses return the **data directly** (array or object), not wrapped in `{ data: ... }`
- Error responses always include an `error` field with a human-readable message
- Validation errors include a `details` field with field-level error messages

## 5. DTOs (Data Transfer Objects)

- Defined in `lib/dtos/`
- Convert snake_case DB columns to camelCase API fields
- Convert Milliunits (bigint) to display numbers where appropriate
- **ALWAYS** use DTO transforms — never leak raw DB rows to the client

## 6. Non-Budget Routes

For routes that don't operate on budget data (e.g., `/api/auth/register`):

- Use `requireAuth()` instead of `requireBudgetAccess()`
- Same try/catch + validation pattern applies
