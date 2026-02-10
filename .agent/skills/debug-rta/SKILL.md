---
name: debug-rta
description: Diagnostic flowchart for debugging Ready to Assign (RTA) calculation discrepancies
---

# Skill: Debug RTA (Ready to Assign)

Use this skill when RTA shows an incorrect value. See `scripts/` for diagnostic SQL queries.

## Quick Start

```bash
npm run db:debug-rta
```

This prints per-month income, assigned, and RTA for the last 12 months.

## The RTA Formula

```
RTA(M) = Cash Balance (non-CC budget accounts, date ≤ today)
       + Positive CC Balances (cashback/overpayments)
       − Sum of category Available (latest complete month, cumulative)
       − Future Month Assigned (months > latestComplete AND ≤ M)
       − Credit Overspending Correction
```

RTA is **per-month** — assignments beyond month M do NOT reduce M's RTA.

## Diagnostic Flowchart

### Step 1: Identify the Symptom

| Symptom                        | Likely Cause                            | Section |
| ------------------------------ | --------------------------------------- | ------- |
| RTA is way too high (millions) | Ghost entry → wrong latest month        | §A      |
| RTA is slightly too high       | Credit overspending not subtracted      | §B      |
| RTA is too low                 | Extra assignments, missing carryforward | §C      |
| Wrong for one specific month   | `available` propagation broken          | §D      |
| Past month shows negative RTA  | Clamping not applied                    | §E      |

### §A. Ghost Entry Problem

A ghost entry (assigned=0, activity=0, available=0) in a future month causes `MAX(month)` to select that month. With only 1 entry, `SumAvailable ≈ 0` → RTA = full cash balance.

**Diagnose:** Run queries 1–2 from [scripts/diagnostic-queries.sql](scripts/diagnostic-queries.sql).

**Fix:** Delete ghost entries. The `HAVING COUNT(*) >= 10` clause is the safety net.

**Prevention:** `updateBudgetAssignment()` must delete rows when all fields are zero.

### §B. Credit Overspending Not Subtracted

CC spending overspent a category. The negative `available` reduced `SumAvailable` without reducing cash → inflated RTA.

**Diagnose:** Run query 3 from [scripts/diagnostic-queries.sql](scripts/diagnostic-queries.sql). Check `getCashOverspendingForMonth()` classification.

**Key:** If ALL spending is from CC → credit overspending (subtract from RTA formula). If ANY from cash → cash overspending (does NOT inflate RTA).

### §C. RTA Too Low

**Check 1 — Carryforward:** When no `budget_months` row exists, `computeCarryforward()` must fetch available from the latest prior month. If broken → `available = 0`.

**Check 2 — Future assigned:** Is `futureMonthAssigned` including too many months? Run query 5 from [scripts/diagnostic-queries.sql](scripts/diagnostic-queries.sql).

**Check 3 — Propagation:** Assignment delta not propagating to subsequent months.

### §D. Available Propagation Broken

The `available` column is cumulative: `available(M) = available(M-1) + assigned(M) + activity(M)`.

**Diagnose:** Run query 4 from [scripts/diagnostic-queries.sql](scripts/diagnostic-queries.sql) for the affected category. Look for breaks in the chain.

### §E. Past Month Negative RTA

Past months (month < current) should clamp negative RTA to $0.00 (grey banner). Only current and future months show negative RTA (red banner).

## Key Files

| File                          | Function                        | Purpose             |
| ----------------------------- | ------------------------------- | ------------------- |
| `lib/engine/rta.ts`           | `calculateRTA()`                | Pure RTA formula    |
| `lib/engine/rta-breakdown.ts` | `calculateRTABreakdown()`       | RTA popup breakdown |
| `lib/repos/budget.ts`         | `getReadyToAssign()`            | Orchestration       |
| `lib/engine/overspending.ts`  | `calculateCashOverspending()`   | Cash vs credit      |
| `lib/engine/carryforward.ts`  | `computeCarryforward()`         | Month rollover      |
| `lib/engine/cc-payment.ts`    | `calculateCCPaymentAvailable()` | CC funded amount    |
| `scripts/debug-rta.ts`        | CLI script                      | Per-month dump      |

## Critical Rule: Future Date Filter

**Every balance query MUST use `AND date <= date('now')`**. Missing this filter causes future transactions to inflate balances.

Functions that need this filter:

1. `getReadyToAssign()` — cash + CC balance
2. `updateBudgetActivity()` — category activity
3. `updateCreditCardPaymentBudget()` — CC spending
4. `updateAccountBalances()` — account balances
5. `getReconciliationInfo()` — cleared balance

## Related Rules

- `02-ready-to-assign-calculation.md` — Full formula
- `03-credit-card-rta-logic.md` — CC interaction
- `07-rta-overspending-edge-cases.md` — Overspending, carryforward, ghost entries
