---
trigger: always_on
---

# Frontend: Mutation & Data Fetching Patterns

This rule is **MANDATORY** for all frontend code. Every write operation (create, update, delete) MUST follow the patterns described here. Never bypass, remove, or simplify this architecture — even for "quick fixes."

## 1. Core Principle: ALL Writes Go Through `useMutation`

**NEVER** use raw `fetch()`, `axios`, or any direct HTTP call for write operations in components or hooks. All mutations MUST use React Query's `useMutation` from dedicated hooks in `hooks/`.

### File Structure (Enforced)

| Location                        | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `hooks/use*Mutations.ts`        | All `useMutation` hooks for a domain (budget, transactions, accounts) |
| `hooks/use*.ts`                 | All `useQuery` hooks for reads                                        |
| `hooks/useDebouncedMutation.ts` | Debounce wrapper — use for text/numeric input fields                  |
| `hooks/usePayees.ts`            | Example of query hook replacing manual fetch                          |
| `components/Providers.tsx`      | `QueryClient` with `MutationCache` for global toast handling          |

### What this means in practice:

- ❌ `const res = await fetch('/api/...', { method: 'POST', ... })` inside a component
- ❌ `useEffect(() => { fetch(...).then(...) })` for writes
- ✅ `const mutation = useCreateTransaction(); mutation.mutate(payload);`
- ✅ `const { data } = usePayees();` for reads

## 2. Input DTOs (CamelCase Payloads)

All mutations MUST use **CamelCase** for input payloads, matching the API contract. Do not use snake_case in frontend code.

```typescript
// ✅ CORRECT
const payload = {
  accountId: 1,
  categoryId: 2,
  amount: 100,
  date: '2023-01-01',
};

// ❌ WRONG
const payload = {
  account_id: 1,
  category_id: 2,
  ...
};
```

## 3. Optimistic Updates (Required for All User-Facing Mutations)

Every mutation that modifies data visible to the user MUST implement the **snapshot/rollback** pattern:

```typescript
useMutation({
    mutationFn: async (vars) => { /* API call */ },

    onMutate: async (vars) => {
        // 1. Cancel outgoing refetches to prevent race conditions
        await queryClient.cancelQueries({ queryKey: ['...'] });

        // 2. Snapshot current cache for rollback
        const previous = queryClient.getQueriesData({ queryKey: ['...'] });

        // 3. Optimistically update the cache
        queryClient.setQueriesData({ queryKey: ['...'] }, (old) => /* update */);

        // 4. Return snapshot for rollback
        return { previous };
    },

    onError: (_err, _vars, context) => {
        // 5. Rollback on failure
        if (context?.previous) {
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
        }
    },

    onSettled: () => {
        // 6. Always refetch authoritative data from server
        queryClient.invalidateQueries({ queryKey: ['...'] });
    },
});
```

### Rules:

- **Always `cancelQueries` before cache manipulation** to prevent stale refetches from overwriting optimistic data.
- **Always snapshot before mutating** — the snapshot is the only rollback mechanism.
- **Always `invalidateQueries` in `onSettled`** (not just `onSuccess`) so the cache is reconciled even after errors.
- **Cross-domain invalidation:** Transaction mutations must invalidate `['transactions']`, `['accounts']`, AND `['budget']` since they affect all three.
- Use `getQueriesData` / `setQueriesData` (plural) when the same data may exist under multiple query keys (e.g., `['transactions']` and `['transactions', accountId]`).

### Engine-Powered Optimistic Updates

Budget mutations in `useBudgetMutations.ts` import pure calculation functions from `lib/engine/` to compute **exact** optimistic values instead of rough delta estimates:

- `validateAssignment()` and `calculateAssignment()` from `lib/engine/assignment.ts` for assignment delta and available
- `computeCarryforward()` from `lib/engine/carryforward.ts` for month rollover
- `parseLocaleNumber()` from `lib/engine/assignment.ts` for locale-aware input parsing

This ensures the optimistic UI matches the server's authoritative calculation exactly. See `05-financial-engine-architecture.md` for the full engine architecture.

## 4. Global Toast Feedback via `MutationCache`

Toast notifications are handled **globally** in `Providers.tsx` through `MutationCache.onSuccess` and `MutationCache.onError`. Individual mutations **MUST NOT** call `toast()` directly.

### How to use:

```typescript
useMutation({
    meta: {
        successMessage: 'Transacción guardada',     // optional — shows success toast
        errorMessage: 'Error al guardar transacción', // overrides default error toast
        skipGlobalError: false,                        // set true ONLY if handling errors manually
    },
    ...
});
```

### Rules:

- ❌ `import { toast } from 'sonner'` in mutation hooks
- ❌ `onError: () => toast.error('...')`
- ✅ `meta: { errorMessage: 'Error al ...' }`
- The **only** exception for `skipGlobalError: true` is when a mutation needs custom error handling logic (e.g., showing a specific modal instead of a toast).

## 5. Mutation Keys (Serialization)

Every mutation MUST have a `mutationKey`. This enables:

- React Query's built-in mutation serialization (prevents concurrent conflicting writes)
- `useIsMutating()` to track pending mutations (used by `SyncStatus`)
- Offline queue management

### Naming convention:

```
['domain-action']
```

Examples: `['budget-update-assigned']`, `['transaction-create']`, `['account-update']`

### Rules:

- Mutations that modify the **same resource** should share the same key for serialization.
- Mutations that are independent can have different keys for parallel execution.

## 6. Debounced Mutations (For Text/Numeric Inputs)

For any input field where the user types rapidly (e.g., the `assigned` field in the budget table), use `useDebouncedMutation`:

```typescript
const mutation = useUpdateAssigned(currentMonth);
const { debouncedMutate, flush } = useDebouncedMutation(mutation, 400);

// In the input:
// onChange → debouncedMutate(vars)   // waits 400ms, resets on each keystroke
// onBlur  → flush(vars)             // fires immediately (commit on blur)
// Enter   → flush(vars)             // fires immediately (commit on Enter)
```

### Rules:

- **Never fire a mutation on every keystroke** for text/numeric inputs.
- Always provide a `flush` call on `onBlur` and `onKeyDown(Enter)` to ensure the value is committed when the user leaves the field.
- The delay should be 300–500ms (default 400ms).

## 7. Offline-First Queue (`networkMode: 'offlineFirst'`)

The `QueryClient` in `Providers.tsx` is configured with `networkMode: 'offlineFirst'` for all mutations. This means:

- Mutations execute immediately even when offline (optimistic updates apply to the cache).
- If the network request fails due to offline status, the mutation is **paused** and **queued**.
- When the network comes back, queued mutations execute automatically.
- `SyncStatus.tsx` shows the queue state ("X pending" when offline, "Syncing…" on reconnect).

### Rules:

- **Never disable `networkMode`** on individual mutations unless there's a specific reason.
- **Never add manual online/offline checks** — React Query handles this.

## 8. SyncStatus Component (Do Not Remove)

`SyncStatus.tsx` is rendered in `AppLayout.tsx` and provides visual feedback for mutation state:

- **Syncing** (with count) — mutations in flight
- **Saved** — briefly shown after all mutations complete
- **Offline** — no network
- **Queued** — offline with pending mutations
- **Error** — with retry button

### Rules:

- `SyncStatus` MUST always be rendered in the app layout.
- It relies on `useIsMutating()` and `useMutationState()` — never remove these dependencies.

## 9. Query Hooks for ALL Reads

All data fetching MUST use `useQuery` hooks. Never use `useEffect` + `fetch` for data loading.

### Existing query hooks:

- `useBudget(month)` — budget data + RTA
- `useTransactions(accountId?)` — transaction lists
- `useAccounts()` / `useAccount(id)` — account data
- `useCategories()` — category list
- `usePayees(enabled?)` — payee autocomplete
- `useOnlineStatus()` — browser online/offline status (via `useSyncExternalStore`)

### Rules:

- When adding a new data source, create a `use[Resource].ts` hook in `hooks/`.
- Set appropriate `staleTime` based on how frequently the data changes.
- Use `keepPreviousData` / `placeholderData` for smooth UI transitions.

## 10. Retry & Backoff (Global Defaults)

Configured globally in `Providers.tsx`:

- **Queries:** standard React Query defaults (3 retries with exponential backoff)
- **Mutations:** 2 retries with exponential backoff (`retryDelay: min(1000 * 2^attempt, 10_000)`)

Individual mutations can override with `retry: 1` for operations that shouldn't retry aggressively (e.g., deletes).

## 11. Protecting Frontend Architecture

When modifying frontend code:

- ✅ Add new mutations following this pattern
- ✅ Add optimistic updates to existing mutations that lack them
- ✅ Add `meta` for toast messages
- ✅ Import financial calculations from `lib/engine/` for optimistic updates
- ❌ Remove `onMutate` / `onError` / `onSettled` handlers
- ❌ Replace `useMutation` with raw `fetch`
- ❌ Remove `mutationKey` from any mutation
- ❌ Remove or bypass the `MutationCache` in `Providers.tsx`
- ❌ Remove `SyncStatus` from the layout
- ❌ Add `toast()` calls directly in mutation hooks (use `meta` instead)
- ❌ Remove `cancelQueries` from `onMutate` handlers
- ❌ Remove snapshot/rollback logic from optimistic mutations
- ❌ Inline financial formulas in hooks or components (use `lib/engine/` — see `05-financial-engine-architecture.md`)

**If a mutation seems too simple for optimistic updates** (e.g., creating a category group), it still MUST have `mutationKey` and `meta`. The `onMutate`/`onError` optimistic pattern can be omitted only for mutations where the result isn't immediately visible in the UI (e.g., reconciliation info fetch).
