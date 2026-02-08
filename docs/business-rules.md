# Business Intelligence & Logic Specification

This document serves as the authoritative reference for the core financial engine of the YNAB Clone. It provides exact formulas, logical proofs, and edge-case handling for the zero-based budgeting system.

## 1. The Global "Ready to Assign" (RTA) Engine

Unlike traditional accounting apps, RTA in a YNAB environment is a **global pool of liquid cash**. It represents the difference between the actual money you have and the "jobs" you've given to that money.

### 📐 The Mathematical Proof

The RTA is computed via a complex union of liquidity and assignment states:

```sql
RTA = (Cash_on_Hand + Positive_CC_Surplus) 
    - (Sum_of_All_Category_Available)
    - (Future_Assigned_Money)
    - (Credit_Overspending_Correction)
```

#### Breakdown of Terms:
- **Cash_on_Hand**: The sum of `inflow - outflow` for all non-credit budget accounts, filtered by `date <= date('now')`.
- **Positive_CC_Surplus**: YNAB treats credit card overpayments or cashback as cash. We calculate `SUM(MAX(0, balance))` across all credit accounts.
- **Sum_of_All_Category_Available**: The cumulative balance of all categories in the **latest complete month** (defined as a month with 10+ categories populated).
- **Future_Assigned_Money**: Any money assigned in months beyond the "latest complete" month must be deducted immediately, as it has already been "given a job."
- **Credit_Overspending_Correction**: Critical proof. Because CC overspending reduces a category's `available` but does NOT reduce your cash balance, it would falsely inflate RTA. We explicitly subtract this "unfunded debt" to maintain RTA integrity.

## 2. Credit Card "Transfer of Intent"

The application implements the automated movement of funds for credit card transactions to ensure you can always pay off your balance for funded spending.

### The Funding Algorithm
When a CC transaction is recorded, the engine executes the following logic (found in `updateCreditCardPaymentBudget`):

```javascript
netSpending = category_outflow - category_inflow;
if (netSpending > 0) {
    availableBefore = current_category_available + netSpending;
    fundedAmount = Math.min(Math.max(0, availableBefore), netSpending);
    // fundedAmount is then added to the CC Payment category's available
} else {
    // If it's a refund, money moves BACK from CC Payment to the category
    fundedActivity += netSpending;
}
```

### Scenario Matrix

| Transaction Type | Category Available | CC Payment Impact | UI Indicator |
| :--- | :--- | :--- | :--- |
| **Fully Funded** | $100 budget, $80 spend | +$80 to Payment Category | Green |
| **Partially Funded** | $20 budget, $80 spend | +$20 to Payment Category | Yellow (Unfunded Debt) |
| **Unfunded** | $0 budget, $80 spend | $0 move | Yellow (Unfunded Debt) |
| **Refund** | $80 return | -$80 from Payment Category | Increase in Cat Available |

## 3. The Overspending Taxonomy

How the system handles deficits depends entirely on whether the money was "lost" (Cash) or "borrowed" (Credit).

### Cash Overspending (The "Red" State)
- **Source**: Checking, Savings, or Cash account transactions.
- **Rollover**: At the end of the month, the negative category balance **resets to $0**. The deficit is physically deducted from the **next month's RTA**.
- **Philosophy**: You can't spend money you don't have. This is a "leak" in your budget.

### Credit Overspending (The "Yellow" State)
- **Source**: Credit Card transactions exceeding the budget.
- **Rollover**: The negative balance **stays as debt** in the current month and does not reduce next month's RTA. Instead, the CC account balance and CC Payment category will simply remain disparaged (underfunded).
- **Philosophy**: You've increased your debt. You'll need to assign money directly to the CC Payment category in the future to cover it.

## 4. Integrity Safeguards

### Ghost Row Prevention
In `lib/db.ts`, the `updateBudgetAssignment` function strictly prevents "ghost rows":
- If `assigned` is set to 0 and the resulting row has 0 activity and 0 available, the row is **deleted**.
- This ensures the `latestMonth` lookup for RTA remains accurate and doesn't point to many months in the future just because a user clicked a cell.

### Exclusion of Future
All RTA-impacting queries use `AND date <= date('now')`. Future transactions are visually tracked but are mathematically invisible to the current budget. This prevents "budgeting money you haven't received yet."
