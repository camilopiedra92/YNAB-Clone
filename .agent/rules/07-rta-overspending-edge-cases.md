---
trigger: always_on
---

# Logic: Overspending, Carryforward, Cumulative Available & Edge Cases

This file covers the **defensive rules** that protect RTA accuracy: overspending classification and rollover, carryforward logic, cumulative `available` guards, ghost entry prevention, and UI states. For the RTA formula itself and component rules, see `02-ready-to-assign-calculation.md`.

## 1. Overspending Types & Month Rollover

### Cash Overspending (Red)

- **Trigger:** Category balance goes negative due to cash/debit account transactions.
- **During the month:** Category shows negative available in red.
- **At month rollover:** Resets to 0. The negative amount becomes a "leak" deducted from the **next** month's RTA.
- **RTA impact:** Deducted from the NEXT month's RTA (not the current month).

### Credit Overspending (Yellow/Amber)

- **Trigger:** Category balance goes negative due to CC transactions only.
- **During the month:** Category shows negative available in yellow. CC Payment is underfunded by that amount.
- **At month rollover:** Resets to 0. The unfunded debt stays on the CC balance — the CC Payment category will be underfunded.
- **RTA impact:** NEVER. The RTA formula explicitly subtracts credit overspending to prevent inflation (see `02-ready-to-assign-calculation.md` §2a).

### Both Types Reset at Month Boundaries (Critical)

Per YNAB docs: "Overspending on a credit card does not roll over when the month rolls over." Both cash AND credit overspending reset the category to 0. The only difference is the RTA impact: cash → deducts from next month, credit → does not.

### Mixed Overspending

If a category has both cash and CC transactions causing overspending:

- Cash overspending = `MIN(total_overspent, cash_spending_amount)`
- Credit overspending = `total_overspent − cash_overspending`
- Cash type takes priority for UI color.

### Carryforward Rules (Pure Logic)

- **Regular categories:** `max(0, prev.available)` — negative available (overspending) resets to 0
- **CC Payment categories:** Carry forward ANY value including negative (debt accumulates)

## 2. Overspending Classification & Cash Overspending Calculation

For each overspent category (available < 0, non-CC-payment, non-income):

**Classification per category:**

- Query all transactions in the category for the given month, split by account type
- If category has ANY spending from cash/debit accounts → classify as 'cash' overspending
- If ALL spending is from CC accounts → classify as 'credit' overspending

**Cash overspending total (for RTA correction):**

- For each overspent category classified as 'cash': add `ABS(available)` to total
- This total is used in the RTA formula to separate credit vs cash overspending

### Implementation

- **Pure logic (in `lib/engine/`):**
  - `computeCarryforward(prevAvailable, isCCPayment)` in `carryforward.ts`
  - `calculateCashOverspending(categories)` in `overspending.ts`
  - `classifyOverspending(input)` in `overspending.ts`
  - `calculateFundedAmount(netSpending, currentAvailable)` in `cc-payment.ts`
- **Orchestration (in `lib/repos/budget.ts`):**
  - `computeCarryforward(categoryId, month)` — queries prev available + linked account, calls engine
  - `getCashOverspendingForMonth(month)` — queries overspent categories, calls engine
  - `getOverspendingTypes(month)` — queries categories, calls engine per category

## 3. Ghost Entry Prevention in `budget_months` (Critical)

Ghost entries are `budget_months` rows with `assigned=0, activity=0, available=0`. They corrupt the RTA calculation by making `MAX(month)` select a sparse future month where `SumAvailable ≈ 0`.

### Rules for `updateBudgetAssignment()`

1. When setting assigned=0, check if the resulting entry has `assigned=0 AND activity=0 AND available=0`. If so, **DELETE the row**.
2. **MUST NOT** create new `budget_months` rows when `assigned=0` (skip INSERT if value is zero and no row exists).

**Why:** A ghost row in `2026-03` with 1 entry causes the latest-month query to pick it. With only 1 category, `SumAvailable ≈ 0`, so RTA = full cash balance (e.g., $55M instead of $0).

**Mitigation in RTA formula:** The latest month query uses `HAVING COUNT(*) >= 10` to skip sparse months. Ghost entry prevention is the first line of defense; the HAVING clause is the safety net.

## 4. Cumulative Available — Implementation Guards

The `available` column is cumulative — it carries forward from month to month. Multiple critical guards ensure this works correctly.

### 4a. `getBudgetForMonth()` Must Handle Missing Rows

`getBudgetForMonth()` uses a `LEFT JOIN` on the exact month. Categories without a `budget_months` row would show `available = 0` — losing all carried-forward value.

**Fix:** When no row exists for a category, call `computeCarryforward()` to fetch the available from the latest prior month.

### 4b. `updateBudgetAssignment()` Must Include Carryforward

When inserting new `budget_months` rows: `available = carryforward + assigned`, not just `available = assigned`.

### 4c. Aggregate Queries MUST Use `getBudgetForMonth()`

Any function computing **aggregate totals** (`SUM(available)`, `SUM(activity)`) across categories for a month **MUST NOT** use raw SQL with `bm.month = ?`. For months without explicit rows, SQL returns 0 — losing cumulative available.

**Pattern:** Use `getBudgetForMonth(month)` and iterate over results. This function handles carryforward.

**Functions affected:**

- `getBudgetInspectorData()` — Month Summary (totalAvailable, totalActivity)
- Any future aggregate function

### 4d. Cumulative Available Propagation on Assignment Changes

When `assigned` changes for a category in month M, the delta MUST propagate to `available` in ALL subsequent months (M+1, M+2, ...). Without this, past-month changes won't affect the current month's RTA.

## 5. Additional Edge Cases

### Starting Balances

- **Cash accounts:** Treated as income → increases RTA.
- **CC accounts:** Creates initial debt → user must manually assign to CC Payment category.

### Reconciliation Adjustments

- Inflow adjustments go to RTA.
- Outflow adjustments deduct from RTA if uncategorized.

### Atomic Updates

Any change in `assigned` or `transaction` amounts must trigger RTA re-calculation. The orchestration layer in `lib/repos/budget.ts` handles this via `updateBudgetActivity()` → `updateCreditCardPaymentBudget()` → `getReadyToAssign()`.

## 6. UI States

### RTA Banner States

- **Green banner:** "Ready to Assign" — RTA > 0
- **Grey banner:** "All Money Assigned" — RTA = $0.00
- **Red banner:** "You assigned more than you have" — RTA < 0 with "Fix This" button

### Past Month Clamping (Critical)

- Negative RTA is only shown for **current month and future months**.
- For **past months** (month < current), negative RTA is clamped to **$0.00** (grey banner).
- Rationale: past overspending has been absorbed and is no longer actionable.

### Overspending Colors in Budget Table

- **Red (negative available):** Cash overspending — money was spent from cash accounts without budgeting
- **Yellow/Amber (negative available):** Credit overspending — spent on CC beyond budget, creates unfunded debt
- Red takes priority when both types exist in the same category
