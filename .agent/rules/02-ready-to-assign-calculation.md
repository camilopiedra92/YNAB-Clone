---
trigger: always_on
---

# Logic: Ready to Assign — Formula, Breakdown & Component Rules

This file defines **how RTA is calculated**: the per-month formula, the RTA Breakdown popup, and the strict component rules (cash balance, CC balances, inflows, future-date exclusion). For overspending handling, carryforward/rollover, cumulative available guards, and edge cases, see `07-rta-overspending-edge-cases.md`.

## 1. Definition (from YNAB)

"Ready to Assign is money in cash-based accounts (like Checking) that is not assigned to spending categories."

## 2. The Implemented Formula

RTA is a **PER-MONTH** value — it depends on which month the user is viewing.

When viewing month **M**:

```
RTA(M) = Cash Balance (non-CC budget accounts, date ≤ today)
       + Positive CC Balances (cashback / overpayments — bank owes user)
       − Sum of category Available (latest budget month, cumulative)
       − Future Month Assigned (months > latestMonth AND ≤ M)
       − Credit Overspending Correction (see §2a)
```

**Key behavior:** Assignments in months **beyond M** do NOT reduce M's RTA.

- Example: If Feb has 1M assigned and March has 500K assigned:
  - Feb RTA = Cash − 1M (March's 500K is NOT subtracted)
  - March RTA = Cash − 1.5M (both are subtracted)
  - April+ RTA = Cash − 1.5M (same as March, no more future assigned)

The `available` column is CUMULATIVE — it carries forward from month to month and already accounts for all assigned amounts, activity, CC spending auto-moves, and cash overspending resets. See `07-rta-overspending-edge-cases.md` §1 for carryforward/rollover rules.

### 2a. Credit Overspending Correction (Critical)

When a CC transaction overspends a category, the negative `available` reduces `SumAvailable` **without reducing Cash**, which falsely inflates RTA. Credit overspending (yellow) must NEVER affect RTA, so we subtract it:

```
CreditOverspending = TotalOverspending − CashOverspending

Where:
  TotalOverspending = SUM(ABS(available)) for overspent regular categories (available < 0, non-CC-payment, non-income)
  CashOverspending  = portion from cash-account transactions (getCashOverspendingForMonth)
```

**Why:** A CC transaction reduces a category's available but NOT Cash. The unfunded portion creates a hole in SumAvailable that inflates RTA without this correction. See `07-rta-overspending-edge-cases.md` §2 for full overspending classification logic.

### 2b. Latest Month Selection

The formula uses the latest budget month — simply `MAX(month)` from `budget_months` for the budget.

Ghost entries (assigned=0, activity=0, available=0) are prevented at the source: `updateBudgetAssignment()`, `updateBudgetActivity()`, and `refreshAllBudgetActivity()` delete zero-value rows. See `07-rta-overspending-edge-cases.md` §3 for ghost entry prevention rules.

### 2c. Future Month Assigned (Per-Month)

Assigned in months **beyond** the latest month but **up to and including M** are subtracted. Assignments **beyond M** are NOT subtracted.

```sql
SELECT COALESCE(SUM(bm.assigned), 0) as total
FROM budget_months bm
JOIN categories c ON bm.category_id = c.id
JOIN category_groups cg ON c.category_group_id = cg.id
WHERE cg.is_income = 0 AND bm.month > ? AND bm.month <= ?
-- ?1 = latest month, ?2 = viewed month M
```

### Implementation

- **Pure formula:** `calculateRTA()` in `lib/engine/rta.ts`
- **Orchestration:** `getReadyToAssign(month)` in `lib/repos/budget-rta.ts`

## 3. RTA Breakdown (per-month, for UI popup)

Matches YNAB's web-only "Ready to Assign Breakdown":

### ➕ Money Added to RTA

- **Left Over from Previous Month:** Rollover from last month's RTA
- **Inflow: Ready to Assign in Current Month:** Income on cash accounts (Checking, Savings, Cash). Includes starting balances on new cash accounts.
- **Positive CC Balances:** Cashback/overpayments creating positive CC balance (bank owes user)
- **Inflow from Debt Account:** Cash advances or CC overpayments — only positive balance portion

### ➖ Money Deducted from RTA

- **Cash Overspending (Previous Month):** The "leak" — cash spent but not budgeted last month
- **Assigned in Current Month:** Money assigned to spending categories this month
- **Assigned in Future:** Informational only — NOT part of the per-month RTA equation

### Back-calculation of Left Over

```
leftOver = RTA(M) − inflowThisMonth − positiveCCBalances + assignedThisMonth + cashOverspending
```

`assignedInFuture` is NOT included because per-month RTA doesn't subtract assignments beyond M.

### Implementation

- **Pure formula:** `calculateRTABreakdown()` in `lib/engine/rta-breakdown.ts`
- **Orchestration:** `getReadyToAssignBreakdown()` in `lib/repos/budget.ts`

## 4. Component Rules (Strict Adherence)

### A. Cash on Hand

- Only **Budget Accounts** (Checking, Savings, Cash). **EXCLUDE** tracking and CC accounts.
- Use **Working Balance** (Cleared + Uncleared).
- **Future transactions (date > today) EXCLUDED.**

### B. Positive CC Balances

- Positive CC balance (bank owes user) = treated as cash. Per-account: `MAX(0, balance)`.
- Sources: cashback rewards, CC overpayments.

### C. Inflow Handling

- "Inflow: Ready to Assign" on a cash account → increases RTA.
- Categorized directly (e.g., refund to Clothing) → modifies category balance, NOT RTA.
- CC inflows categorized as "Inflow: Ready to Assign" → affect CC balance → flows to RTA only if it creates positive balance.

### D. Future Transaction Exclusion (Critical — Applies Everywhere)

**Future transactions (date > today) are EXCLUDED from ALL calculations.** YNAB only budgets money you have _right now_.

**Functions in `lib/repos/*.ts` that MUST use `notFutureDate(transactions.date)` from `lib/db/sql-helpers.ts`:**

1. `getReadyToAssign()` — cash + CC balance queries (budget repo)
2. `updateBudgetActivity()` — category activity (budget repo)
3. `updateCreditCardPaymentBudget()` — CC spending for funded amount (budget repo)
4. `updateAccountBalances()` — account balances (accounts repo)
5. `getReconciliationInfo()` — cleared balance (accounts repo)
6. `getCashOverspendingForMonth()` — cash overspending for RTA correction (budget repo)
7. `getOverspendingTypes()` — overspending classification for UI colors (budget repo)

**Helper:** `notFutureDate(column)` in `lib/db/sql-helpers.ts` encapsulates `column <= CURRENT_DATE`. All financial queries MUST use this helper instead of inline `date <= currentDate()`.

**CI Guard:** `npm run check:future-filter` scans all `SUM()` queries on `transactions` for `notFutureDate`. Fails the build if missing.

Engine functions (`lib/engine/`) are pure math — future-date filter is enforced at the query layer.

**Common bug:** Omitting the filter causes stale `available`/`activity` values.

### E. Multi-Month Interaction

- Assigning in month M affects RTA for M and all months ≥ M. Does NOT affect months < M.
- "Stealing from the Future": future month assignment reduces that month's RTA, not current.
- Negative RTA → red "You assigned more than you have" banner.
- "Assigned in Future" is informational only in the breakdown.

## 5. UI States

- **Green banner:** "Ready to Assign" — RTA > 0
- **Grey banner:** "All Money Assigned" — RTA = $0.00
- **Red banner:** "You assigned more than you have" — RTA < 0 with "Fix This" button

### Past Month Clamping

- Negative RTA is only shown for **current month and future months**.
- For **past months** (month < current), negative RTA is clamped to **$0.00** (grey banner).
