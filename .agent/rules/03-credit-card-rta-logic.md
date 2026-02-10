---
trigger: always_on
---

# Logic: Credit Card Categories & RTA Interaction

## 1. The "Transfer of Intent" Principle

Credit card transactions in a YNAB clone must not be treated as immediate cash outflows from the RTA. Instead, they trigger a move of funds between categories.

## 2. Budgeted Spending (The Standard Flow)

When a transaction occurs on a Credit Card account and it has a category with sufficient 'Available' funds:

- **Action:** The system must automatically move the transaction amount from the `Category: Available` to the `Credit Card Payment: Available` category.
- **RTA Impact:** ZERO. The money was already removed from RTA when it was assigned to the spending category (e.g., Groceries). The "Job" of the money simply changed from "Buy Food" to "Pay Bank".

## 3. Direct Assignment to CC Category (Debt Service)

- **Scenario:** The user wants to pay off a balance that existed before starting the app or debt incurred from overspending.
- **Action:** The user manually enters a value in the 'Assigned' column of the Credit Card Payment category.
- **RTA Impact:** NEGATIVE. This action reduces RTA exactly like assigning money to any other category. It is "Giving a Job" to new income to cover past debt.

## 4. Credit Overspending (The "Yellow" State)

- **Scenario:** A user spends $100 on a CC in a category that only had $80.
- **Action:** 1. $80 is moved from the `Category: Available` to `CC Payment: Available`. 2. The category balance becomes -$20 (Yellow/Orange). 3. The CC Payment category will now be $20 short of covering the actual Account Balance.
- **RTA Impact:** ZERO in the current month. Unlike cash overspending (Red), credit overspending does NOT reduce RTA. It simply creates "Unfunded Debt". If not fixed by the end of the month, this debt stays on the card balance and does not affect the next month's RTA.

## 5. Returns and Refunds on Credit Cards

- **To a Category:** If a refund is categorized (e.g., back to 'Clothing'), the `CC Payment: Available` must be reduced and the `Category: Available` increased.
  - **RTA Impact:** ZERO.
- **To RTA (Inflow):** If a refund is categorized as 'Inflow: Ready to Assign':
  - **Action:** It reduces the Credit Card balance and INCREASES the RTA.
  - **Warning:** If this creates a positive balance on the Credit Card (the bank owes the user), that surplus must be treated as Cash and added to RTA.

## 6. Credit Card Payments (The Transfer)

- **Action:** When the user pays the bank, it is a Transfer from `Checking` to `CC Account`.
- **Logic:** This reduces the `CC Payment: Available` balance and the `Checking` balance.
- **RTA Impact:** ZERO. The money was already set aside in the CC Payment category.

## 7. CC Payment Available Calculation (Implementation Detail)

The CC Payment category's `available` (displayed as "Available for Payment") is computed by:

- **Pure formula:** `calculateCCPaymentAvailable()` in `lib/engine/cc-payment.ts`
- **Orchestration (query→engine→write):** `updateCreditCardPaymentBudget()` in `lib/repos/budget.ts`

### Formula

```
CC Payment Available = Carryforward + Assigned + Activity

Where:
  Activity = Funded Spending − CC Payments
```

Where:

- **Carryforward** = previous month's CC Payment available (cumulative debt tracking)
- **Assigned** = money manually assigned by the user to pay down CC debt
- **Funded Spending** = sum of funded spending across all categories on this CC (positive)
- **CC Payments** = inflows to the CC account with no category (transfers from checking/savings)

### Funded Spending Calculation (Critical)

For each spending category that has CC transactions this month:

```
net_spending = outflow − inflow (on CC for that category)

if net_spending ≤ 0:
    # Refund/return → moves money back from CC Payment
    funded = net_spending

else:
    # Spending → only the funded portion moves to CC Payment
    available_before = current_available + net_spending   # reconstruct pre-spending balance
    funded = MIN(MAX(0, available_before), net_spending)
```

**Only the funded portion moves.** The unfunded portion (credit overspending) stays as a negative on the spending category.

### Example

- Category "Groceries" has `available = 80` before CC spending of `100`
- After the CC transaction: `available = 80 - 100 = -20`
- `available_before = -20 + 100 = 80`
- `funded = MIN(MAX(0, 80), 100) = 80`
- CC Payment gets +80 (not +100)
- Groceries shows -20 (yellow, credit overspending)

### CC Payment Deduction (Critical — Bug Fix)

CC payments are transfers from a budget account (Checking, Savings) to the CC account. These transactions have `category_id IS NULL` and `inflow > 0` on the CC account side.

**Without subtracting payments, CC Payment available accumulates all funded spending forever, inflating the value massively.**

```sql
-- CC payments query (transfers to CC account)
SELECT COALESCE(SUM(t.inflow), 0) as total_payments
FROM transactions t
WHERE t.account_id = ?          -- CC account ID
  AND strftime('%Y-%m', t.date) = ?
  AND t.date <= date('now')
  AND t.category_id IS NULL      -- transfers have no category
  AND t.inflow > 0
```

**Verification example (Dec 2025):**

- Funded spending = 5,731,024.46
- CC payments = 6,450,155.96
- Net activity = 5,731,024.46 − 6,450,155.96 = **−719,131.50** (matches YNAB export)

### Critical Rules

1. **Future transactions EXCLUDED:** The query must use `AND t.date <= date('now')`. Future-dated CC transactions do NOT affect CC Payment available — they are "Upcoming" in YNAB.
2. **Exclude CC Payment category itself:** Don't count transactions on the CC that are categorized as the CC Payment category (e.g., payments).
3. **Refunds move money back:** When `net_spending ≤ 0` (net refund on a category), that negative amount reduces CC Payment available and increases the category's available.
4. **CC Payments MUST be subtracted:** Inflows to the CC account with `category_id IS NULL` are payments/transfers that reduce CC Payment available. Without this, available grows indefinitely.
5. **Ghost entry prevention:** When activity is 0 and no budget_months row exists, do NOT create a new row (avoids cluttering the DB with zero-value CC Payment entries for future months).

## 8. Overspending Type & Month Rollover

### Credit Overspending (Yellow/Amber)

- **During the month:** Category shows negative available in yellow. CC Payment is underfunded by that amount.
- **At month rollover:** Credit overspending **resets to 0** (per YNAB docs: "Overspending on a credit card does not roll over when the month rolls over"). The unfunded debt remains on the CC balance — the CC Payment category will be underfunded.
- **RTA Impact:** NEVER. The `getReadyToAssign()` formula explicitly subtracts credit overspending to prevent it from falsely inflating RTA (see §2a in `02-ready-to-assign-calculation.md`).

### Cash Overspending (Red)

- **During the month:** Category shows negative available in red (only when the overspending is from cash/debit account transactions).
- **At month rollover:** Cash overspending **resets to 0** and deducts the amount from the next month's RTA (the "leak").
- **RTA Impact:** Deducted from the NEXT month's RTA, not the current.

### Both Types Reset at Month Rollover

Per YNAB docs, **both** cash and credit overspending reset the category to 0 at month boundaries. The `computeCarryforward()` function in `lib/engine/carryforward.ts` implements the pure logic: for regular categories, `max(0, prev.available)`. Only CC Payment categories carry forward negative balances (debt). The orchestration layer in `lib/db.ts` queries the previous month's data and calls this engine function.

### Mixed Overspending

If a category has both cash and CC transactions that cause overspending:

- Cash overspending = `MIN(total_overspent, cash_spending_amount)`
- Credit overspending = `total_overspent − cash_overspending`
- The more urgent type (cash) takes priority for UI color.

### Implementation

- **Pure logic (in `lib/engine/`):**
  - `computeCarryforward(prevAvailable, isCCPayment)` in `carryforward.ts`
  - `classifyOverspending(input)` in `overspending.ts`
  - `calculateCashOverspending(categories)` in `overspending.ts`
- **Orchestration (in `lib/repos/*.ts`):** `computeCarryforward()`, `getOverspendingTypes()`, `getCashOverspendingForMonth()` handle queries and delegate to engine
