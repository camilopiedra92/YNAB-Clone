---
description: Authentication, multi-tenancy isolation, and security patterns
---

# Auth & Security Patterns

This file defines the **MANDATORY** authentication and security patterns for the project.

## 1. Auth Stack

| Component        | Technology                            | Location                                           |
| ---------------- | ------------------------------------- | -------------------------------------------------- |
| **Framework**    | NextAuth v5 (Auth.js)                 | `lib/auth.ts`                                      |
| **Provider**     | Credentials (email + password)        | `lib/auth.ts`                                      |
| **Sessions**     | JWT strategy                          | `lib/auth.ts`                                      |
| **Hashing**      | bcryptjs (12 rounds)                  | `lib/auth.ts`, `app/api/auth/register/route.ts`    |
| **Auth Helpers** | `requireAuth()`, `withBudgetAccess()` | `lib/auth-helpers.ts`, `lib/with-budget-access.ts` |
| **Schemas**      | `LoginSchema`, `RegisterSchema`       | `lib/schemas/auth.ts`                              |

## 2. Getting the Session

```typescript
// In API routes (budget-scoped): use withBudgetAccess — handles auth internally
import { withBudgetAccess } from "@/lib/with-budget-access";

return withBudgetAccess(budgetId, async (tenant, repos) => {
  // tenant.userId and tenant.budgetId are already verified
  const data = await repos.getSomething(tenant.budgetId);
  return NextResponse.json(data);
});

// In API routes (non-budget): use requireAuth directly
import { requireAuth } from "@/lib/auth-helpers";
const authResult = await requireAuth();
if (!authResult.ok) return authResult.response;

// In Server Components:
import { auth } from "@/lib/auth";
const session = await auth();
```

**Never** access `session.user.id` without null-checking first.

## 3. Multi-Tenancy: `withBudgetAccess()` (Critical)

**Every API route that accesses budget data MUST use `withBudgetAccess()`.** This is the primary enforcement layer for data isolation AND connection pooling safety.

```typescript
import { withBudgetAccess } from "@/lib/with-budget-access";

return withBudgetAccess(budgetId, async (tenant, repos) => {
  // All repos.* calls are transaction-scoped — same DB connection
  const data = await repos.getBudgetForMonth(month);
  return NextResponse.json(data);
});
```

### What it does (in order):

1. Verifies the user is authenticated (calls `auth()`)
2. Validates `budgetId` is a positive integer
3. **Opens a DB transaction** — all queries share one connection
4. Sets `app.user_id` and `app.budget_id` via `set_config(..., true)` (transaction-local)
5. Verifies budget access (queries `budgets` and `budget_shares` tables)
6. Creates transaction-scoped repos via `createDbFunctions(tx)`
7. Returns `TenantContext`, `repos`, and raw `tx` to the handler

### Why transaction wrapping is required

PostgreSQL `set_config()` is per-connection. With connection pooling (`postgres.js`), each query may be dispatched to a different pooled connection. Without a transaction, RLS session variables set by `set_config` are lost before the actual query executes.

**File:** `lib/with-budget-access.ts`

> [!WARNING]
> The old `requireBudgetAccess()` function in `lib/auth-helpers.ts` still exists but MUST NOT be used in new code. It does not wrap queries in a transaction, so RLS variables are unreliable with connection pooling.

### Rules

- ❌ **Never use `requireBudgetAccess()`** — use `withBudgetAccess()` instead
- ❌ **Never query budget data without using `withBudgetAccess()`**
- ❌ **Never trust `budgetId` from the URL without verification**
- ❌ **Never import `db` directly in route handlers** — use `repos` from callback
- ❌ **Never call `set_config()` outside of a transaction** — it won't persist
- ✅ **Always use `repos.*` from the callback** — they're transaction-scoped
- ✅ **Always use `tenant.budgetId`** — it's verified

## 4. Account Lockout

Configured in `lib/auth.ts`:

| Setting                 | Value            |
| ----------------------- | ---------------- |
| **Max failed attempts** | 5                |
| **Lockout duration**    | 15 minutes       |
| **Reset on**            | Successful login |

- After 5 failed login attempts, the account is locked for 15 minutes
- `failedLoginAttempts` and `lockedUntil` fields on the `users` table
- Successful login resets both counters

## 5. Rate Limiting

- **Implementation:** In-memory sliding window counter in `lib/rate-limit.ts`
- **3 tiers:** Auth (5/min), Import (3/5min), API (60/min — defined but not yet applied)
- **Per-IP tracking** with auto-cleanup

### Rules

- Rate limit configuration is defined in `lib/rate-limit.ts`
- E2E tests account for rate limit behavior
- In-memory store resets on restart — acceptable for single-instance

## 6. Password Hashing

```typescript
import bcrypt from "bcryptjs";

// Hashing (registration):
const hashedPassword = await bcrypt.hash(plainPassword, 12);

// Comparing (login):
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

### Rules

- **Minimum 12 rounds** for bcrypt — never lower this
- **Never store plaintext passwords** — even in seeds or test data
- **Never log passwords** — not even hashed ones

## 7. Row-Level Security (RLS) — Defense in Depth

PostgreSQL RLS policies exist as a safety net. `withBudgetAccess()` automatically sets session variables inside a transaction:

```sql
SELECT set_config('app.budget_id', '123', true),
       set_config('app.user_id', 'uuid', true);
```

- The `true` makes it local to the current transaction
- In local dev (superuser), RLS policies exist but don't enforce
- In production (non-superuser `ynab_app` role), RLS is active
- PGlite (unit tests) doesn't support `set_config` — silently ignored

### RLS Policy Design (NULLIF Protection)

All RLS policies use `NULLIF` to handle empty string values from connection pooling:

```sql
-- Accounts & Category Groups
USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);

-- Budgets (user OR budget access)
USING (
  user_id::text = NULLIF(current_setting('app.user_id', true), '')
  OR id = NULLIF(current_setting('app.budget_id', true), '')::int
);
```

**Why NULLIF?** `current_setting(..., true)` returns empty string `''` (not NULL) when a variable was previously set to `''` on a pooled connection. `''::integer` throws a cast error. `NULLIF` converts `''` to `NULL`, and `budget_id = NULL` evaluates to `FALSE` (safe deny).

**Migration:** `drizzle/0006_security_rls.sql` (original), `drizzle/0007_fix_rls_nullif.sql` (NULLIF fix)

## 8. CSRF Protection

Handled automatically by NextAuth. No additional configuration needed.

## 9. Protecting Auth Architecture

- ✅ Use `withBudgetAccess()` in every budget-scoped API route
- ✅ Use `requireAuth()` for non-budget routes that need authentication
- ✅ Use bcryptjs with ≥12 rounds for all password hashing
- ✅ Validate all auth inputs with Zod schemas
- ✅ Always set both `app.user_id` and `app.budget_id` in transactions
- ❌ Never use `requireBudgetAccess()` — use `withBudgetAccess()` instead
- ❌ Never bypass auth — even for "read-only" endpoints
- ❌ Never expose user IDs, hashed passwords, or internal DB IDs unnecessarily
- ❌ Never disable RLS in production
- ❌ Never hardcode credentials in source code (use `.env`)
- ❌ Never call `set_config()` outside a transaction — it won't persist with pooling
