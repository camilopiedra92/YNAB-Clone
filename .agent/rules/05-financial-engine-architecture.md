---
trigger: always_on
---

# Architecture: Financial Engine — Single Source of Truth

**`lib/engine/` is the ONLY place where financial business logic may exist.** This rule is **MANDATORY** for ALL code.

## 1. The Rule

Every financial calculation MUST be implemented as a **pure function** in `lib/engine/`. No other file may contain financial formulas.

## 2. Architecture (3-Layer Pattern)

| Layer                                  | Location                 | Responsibility                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine** (pure logic)                | `lib/engine/*.ts`        | All financial formulas. Zero dependencies on DB, HTTP, React, or environment. Receives plain data, returns computed results.                                                                                                                                                                                                       |
| **Orchestration** (query→engine→write) | `lib/repos/*.ts`         | Queries data from PostgreSQL, passes it to engine functions, writes results back. No inline math. Split into domain modules: `budget.ts` (mutations, activity, inspector), `budget-rta.ts` (RTA queries), `budget-cc.ts` (CC payments, overspending), `accounts.ts`, `transactions.ts`, `categories.ts`, `budgets.ts`, `users.ts`. |
| **UI** (optimistic updates)            | `hooks/use*Mutations.ts` | Imports engine functions to compute exact optimistic cache values. No inline math.                                                                                                                                                                                                                                                 |

## 3. Strict Monetary Typing: Milliunits

We use a **branded type** (`Milliunit`) for all monetary values. This prevents accidental arithmetic with non-money numbers (IDs, counts).

### Production Code

- **Import**: `import { milliunit, ZERO } from '@/lib/engine/primitives';`
- **Cast**: Use `milliunit(n)` to cast from SQL/API results.
- **Example**: `const assigned = milliunit(row.assigned);`

### Test Code

- **Import**: `import { mu, ZERO } from './test-helpers';`
- **Helper**: Use `mu(500)` for literals. Use `ZERO` for 0.
- **Example**: `await fns.updateBudgetAssignment(catId, month, mu(500));`

**NEVER use `any` cast or plain `number` for monetary fields.**

## 4. What This Means in Practice

```typescript
// ❌ FORBIDDEN — inline formula
const rta = cashBalance - totalAvailable;

// ✅ CORRECT — import from engine
import { calculateRTA } from "@/lib/engine";
const rta = calculateRTA({ cashBalance, totalAvailable, ... });
```

## 5. When Adding New Financial Logic

1.  **Define input/output types** in `lib/engine/types.ts`.
2.  **Implement pure function** in `lib/engine/*.ts`.
3.  **Export from barrel file** `lib/engine/index.ts`.
4.  **Write unit tests** in `lib/__tests__/engine.test.ts`.
5.  **Use in repo/hooks** via import.

## 6. Engine Modules Reference

| Module             | Functions                                                                                | Domain                              |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| `primitives.ts`    | `milliunit`, `ZERO`, `add`, `sub`, `mul`, `neg`, `abs`, `min`, `max`, `sum`, `toDisplay` | Branded Milliunit type + arithmetic |
| `clock.ts`         | `currentDate`, `currentMonth`, `isCurrentOrFutureMonth`                                  | Date/time helpers (mockable)        |
| `carryforward.ts`  | `computeCarryforward`                                                                    | Month rollover logic                |
| `rta.ts`           | `calculateRTA`                                                                           | Ready to Assign formula             |
| `rta-breakdown.ts` | `calculateRTABreakdown`                                                                  | RTA popup breakdown                 |
| `assignment.ts`    | `parseLocaleNumber`, `validateAssignment`, `calculateAssignment`                         | Budget assignment + input parsing   |
| `cc-payment.ts`    | `calculateFundedAmount`, `calculateTotalFundedSpending`, `calculateCCPaymentAvailable`   | CC payment available                |
| `overspending.ts`  | `calculateCashOverspending`, `classifyOverspending`                                      | Cash vs. credit overspending        |
| `activity.ts`      | `calculateBudgetAvailable`                                                               | Budget available formula            |
| `move-money.ts`    | `validateMoveMoney`, `calculateMoveMoney`                                                | Move money between categories       |

## 7. Protecting the Engine Boundary

When modifying ANY code in the project:

- ✅ Import financial calculations from `lib/engine/`
- ✅ Add new engine functions following the pattern above
- ✅ Use engine functions in optimistic updates for exact values
- ✅ Use `Milliunit` branded types for ALL monetary values
- ❌ Inline financial formulas in hooks, components, API routes, or `lib/db.ts`
- ❌ Duplicate engine logic anywhere — the engine is the single source of truth
- ❌ Add DB, HTTP, React, or environment dependencies to `lib/engine/` files
- ❌ Skip writing unit tests for new engine functions

## 8. Why This Matters

- **Portability:** The engine can be used in any environment (server, client, CLI, tests) without modification.
- **Consistency:** Client optimistic updates and server calculations use the **same functions** — no divergence possible.
- **Testability:** Engine tests run in <50ms with zero DB setup. Pure input → output verification.
- **SaaS-Ready:** Replacing PostgreSQL with another backend only requires changing `lib/db.ts` queries. The engine is untouched.
