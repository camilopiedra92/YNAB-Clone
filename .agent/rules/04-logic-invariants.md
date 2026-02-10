---
description: Core zero-based budgeting, double-entry, and envelope model invariants
---

# Core Accounting & YNAB Logic

## 1. Zero-Based Budgeting Invariant

- EVERY cent must be accounted for. The fundamental equation is:
  `Total Cash - Total Assigned = Ready to Assign (RTA)`
- If a category is overspent (negative balance), it must be highlighted as a critical error in the UI.
- Overspending in cash (red) MUST be deducted from the next month's RTA.
- Overspending in credit (yellow) MUST be added to the Credit Card debt balance unless covered.

## 2. Double-Entry Principle

- No transaction exists in isolation.
- A 'Spending' transaction is a DEBIT to a Category and a CREDIT to an Account.
- A 'Transfer' is a DEBIT to Source Account and a CREDIT to Destination Account (no category impact unless between On-Budget and Off-Budget).

## 3. The "Envelope" Model

- Categories are not "spending limits"; they are physical envelopes.
- Moving money between categories (Rule 3: Roll with the Punches) must be an atomic operation: `Category A (-x) -> Category B (+x)`.
