---
description: Error handling, logging, and client/server error conventions
---

# Error Handling & Logging

This file defines **MANDATORY** patterns for handling errors across the stack.

## 1. API Routes (Server)

Every API route handler MUST use the try/catch pattern:

```typescript
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // ... auth, validation, business logic ...
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating X:", error);
    return NextResponse.json({ error: "Failed to create X" }, { status: 500 });
  }
}
```

### Rules

- ✅ **Always catch at the handler level** — never let unhandled errors crash the route
- ✅ **Always `console.error` with context** — include which operation failed (e.g., "Error creating transaction:")
- ✅ **Always return a structured error** — `{ error: 'human message' }` with appropriate HTTP status
- ❌ **Never swallow errors silently** — always log before returning 500
- ❌ **Never expose stack traces to the client** — the `error` message should be generic

## 2. Zod Validation Errors (400)

The `validateBody()` helper from `lib/schemas/helpers.ts` handles this automatically:

```typescript
const validation = validateBody(SomeSchema, body);
if (!validation.success) return validation.response;
// validation.data is fully typed
```

The error response format is:

```json
{
  "error": "Validation failed",
  "details": {
    "fieldName": ["Error message 1", "Error message 2"],
    "nested.field": ["Required"]
  }
}
```

### Rules

- **Never validate manually** — always use `validateBody()` or `schema.safeParse()`
- If using `safeParse` directly, format errors using the same `{ error, details }` shape

## 3. Client-Side Errors (Mutations)

All mutation errors are handled **globally** via `MutationCache` in `Providers.tsx`. See `06-frontend-mutation-patterns.md` §4 for full details.

```typescript
// ✅ CORRECT — use meta for toast messages
useMutation({
  meta: {
    errorMessage: "Error al crear transacción",
  },
});

// ❌ WRONG — never call toast directly
onError: () => toast.error("...");
```

### Optimistic Rollback

When optimistic updates fail, the `onError` handler restores the previous cache snapshot. This is critical for data consistency. See `06-frontend-mutation-patterns.md` §3.

## 4. Repository Layer (`lib/repos/`)

Repos should **let errors propagate** to the API route's catch block. Don't catch and re-throw unless adding context:

```typescript
// ✅ CORRECT — let it propagate
export async function getTransactions(filters) {
  return await db.select()...;
}

// ❌ WRONG — catching just to re-throw
export async function getTransactions(filters) {
  try {
    return await db.select()...;
  } catch (error) {
    throw error; // pointless
  }
}

// ✅ OK — catching to add context
export async function getTransactions(filters) {
  try {
    return await db.select()...;
  } catch (error) {
    throw new Error(`Failed to query transactions for budget ${filters.budgetId}`, { cause: error });
  }
}
```

## 5. Engine Layer (`lib/engine/`)

Engine functions are pure — they should **throw on invalid input** rather than returning error objects:

```typescript
// ✅ CORRECT — throw on bad input
export function calculateRTA(input: RTAInput): Milliunit {
  if (!input.cashBalance && input.cashBalance !== ZERO) {
    throw new Error("cashBalance is required");
  }
  // ... calculation ...
}
```

These errors propagate through the repo layer to the API route's catch block.

## 6. Logging Convention

| Layer      | Method                                    | When              |
| ---------- | ----------------------------------------- | ----------------- |
| API routes | `console.error('Error [action]:', error)` | Catch blocks      |
| Scripts    | `console.error('Step failed:', error)`    | Catch blocks      |
| Engine     | `throw new Error(...)`                    | Invalid input     |
| Client     | Handled by `MutationCache`                | Mutation failures |

### Rules

- **No custom logger** — use `console.error` for now (structured logging is a future improvement)
- **Always include context** — "Error creating transaction:" not just "Error:"
- **Never log sensitive data** — passwords, tokens, full user objects
