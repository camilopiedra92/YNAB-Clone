---
description: Authentication, multi-tenancy isolation, and security patterns
---

# Auth & Security Patterns

This file defines the **MANDATORY** authentication and security patterns for the project.

## 1. Auth Stack

| Component        | Technology                               | Location                                        |
| ---------------- | ---------------------------------------- | ----------------------------------------------- |
| **Framework**    | NextAuth v5 (Auth.js)                    | `lib/auth.ts`                                   |
| **Provider**     | Credentials (email + password)           | `lib/auth.ts`                                   |
| **Sessions**     | JWT strategy                             | `lib/auth.ts`                                   |
| **Hashing**      | bcryptjs (12 rounds)                     | `lib/auth.ts`, `app/api/auth/register/route.ts` |
| **Auth Helpers** | `requireAuth()`, `requireBudgetAccess()` | `lib/auth-helpers.ts`                           |
| **Schemas**      | `LoginSchema`, `RegisterSchema`          | `lib/schemas/auth.ts`                           |

## 2. Getting the Session

```typescript
// In API routes:
import { requireAuth } from "@/lib/auth-helpers";
const authResult = await requireAuth();
if (!authResult.ok) return authResult.response;
const userId = authResult.userId;

// In Server Components:
import { auth } from "@/lib/auth";
const session = await auth();
```

**Never** access `session.user.id` without null-checking first.

## 3. Multi-Tenancy: `requireBudgetAccess()` (Critical)

**Every API route that accesses budget data MUST call `requireBudgetAccess(budgetId)`.** This is the primary enforcement layer for data isolation.

```typescript
const access = await requireBudgetAccess(budgetId);
if (!access.ok) return access.response;
const { tenant } = access; // { userId, budgetId } — verified
```

### What it does:

1. Verifies the user is authenticated (calls `requireAuth()`)
2. Validates `budgetId` is a positive integer
3. Verifies the user owns the budget (queries `budgets` table)
4. Sets PostgreSQL session variables for RLS (`app.budget_id`, `app.user_id`)
5. Returns a `TenantContext` with verified `userId` and `budgetId`

### Rules

- ❌ **Never query budget data without calling `requireBudgetAccess()`**
- ❌ **Never trust `budgetId` from the URL without verification**
- ❌ **Never pass `budgetId` from the client to repo functions without auth check**
- ✅ **Always use the `budgetId` from `tenant.budgetId`** — it's verified

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

- **Implementation:** Middleware or API-level (configurable via `AUTH_LIMIT` env var)
- **Test environment:** `AUTH_LIMIT` is relaxed to 100 requests/min to prevent test interference
- **Production:** Stricter limit (value in `.env`)

### Rules

- **Never hardcode rate limits** — always read from `AUTH_LIMIT` env var
- E2E tests that test rate limiting must account for the relaxed limit

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

PostgreSQL RLS policies exist as a safety net. `requireBudgetAccess()` automatically sets session variables:

```sql
SELECT set_config('app.budget_id', '...', true),
       set_config('app.user_id', '...', true);
```

- The `true` makes it local to the current transaction
- In local dev (superuser), RLS policies exist but don't enforce
- In production, RLS adds a second layer of protection
- PGlite (unit tests) doesn't support `set_config` — silently ignored

## 8. CSRF Protection

Handled automatically by NextAuth. No additional configuration needed.

## 9. Protecting Auth Architecture

- ✅ Use `requireBudgetAccess()` in every budget-scoped API route
- ✅ Use `requireAuth()` for non-budget routes that need authentication
- ✅ Use bcryptjs with ≥12 rounds for all password hashing
- ✅ Validate all auth inputs with Zod schemas
- ❌ Never bypass `requireBudgetAccess()` — even for "read-only" endpoints
- ❌ Never expose user IDs, hashed passwords, or internal DB IDs unnecessarily
- ❌ Never disable RLS in production
- ❌ Never hardcode credentials in source code (use `.env`)
