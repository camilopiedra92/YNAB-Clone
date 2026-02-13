# YNAB Clone — Feature Completeness Assessment

> **Created:** 2026-02-13 · **Last Updated:** 2026-02-13
> **Methodology:** Full codebase audit against YNAB (web + mobile) feature set

---

## Progress Dashboard

| Domain                     | Completeness | Features Done | Features Total |  Priority   |
| -------------------------- | :----------: | :-----------: | :------------: | :---------: |
| Credit Cards               |     90%      |      8/9      |       9        |   ✅ Done   |
| Budgeting Core             |     75%      |     14/19     |       19       |   🔴 High   |
| Accounts                   |     65%      |     6/10      |       10       |   🟡 Med    |
| Multi-User & Collaboration |     60%      |     7/10      |       10       |   🟡 Med    |
| Transactions               |     50%      |     11/21     |       21       |   🔴 High   |
| UX Polish & Platform       |     50%      |     7/15      |       15       |   🟡 Med    |
| Data Import/Export         |     25%      |      2/6      |       6        |   🟡 Med    |
| Mobile                     |     10%      |      0/4      |       4        | 🟠 Med-High |
| Reports & Analytics        |      0%      |      0/7      |       7        |   🔴 High   |
| Goals / Targets            |      0%      |      0/6      |       6        |   🔴 High   |
| Scheduled Transactions     |      0%      |      0/5      |       5        |   🔴 High   |
| Bank Sync                  |      0%      |      0/4      |       4        |  🟢 Low\*   |
| **TOTAL**                  |   **~35%**   |  **55/120**   |    **120**     |      —      |

_\*Bank sync requires paid third-party APIs (Plaid). Deprioritized for self-hosted clone._

### Scoring Legend

| Icon | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| ✅   | **Complete** — Feature-complete or near-complete vs. YNAB          |
| 🟡   | **Partial** — Core implemented, missing sub-features               |
| ❌   | **Not Implemented** — Feature does not exist                       |
| 🏗️   | **Foundation Only** — Schema/API exists but no UI or limited logic |

---

## Executive Summary

The clone has a **rock-solid financial engine** — the hardest part of a YNAB clone. RTA, credit card handling, overspending classification, carryforward, and multi-month budgeting are implemented with correctness that matches YNAB's actual behavior. The architecture (3-layer engine/repo/UI) is enterprise-grade and designed for scale.

However, the project is currently focused on the **core budgeting loop** and lacks many secondary features that make YNAB a complete personal finance tool (reports, goals, scheduled transactions, bank sync, mobile, etc.).

### Critical Risks

- ⛔ **No scheduled transactions** — YNAB's monthly view assumes recurring transactions exist to project future spending. Without them, the budget is purely reactive.
- ⚠️ **No goals/targets** — The "underfunded" indicator is one of YNAB's strongest engagement drivers. Without it, users lose the "am I on track?" signal.
- ⚠️ **No reporting** — Users get zero visibility into spending patterns. Cannot answer "where does my money go?"
- ℹ️ **No split transactions** — For users with mixed-category purchases, workaround is creating multiple transactions per receipt.

---

## 1. Budgeting Core — The "Give Every Dollar a Job" Loop

**Domain Completeness: ~75% · 14/19 features**

- [x] Ready to Assign (RTA) calculation — Per-month formula with cash balance, positive CC, SumAvailable, future assigned, credit overspending correction. Matches YNAB exactly.
- [x] RTA Breakdown popup — Left over, inflow, positive CC, cash overspending, assigned current, assigned future. Back-calculated.
- [x] RTA banner states (green/grey/red) — Including past-month clamping to $0.
- [x] Assign money to categories — With debounced input, locale-aware parsing, optimistic updates, carryforward-aware inserts.
- [x] Monthly budget table (Assigned / Activity / Available) — Full table with category groups, drag-and-drop reorder, inline editing.
- [x] Month navigation (prev/next/today/picker) — With min/max bounds based on data.
- [x] Category groups (create, rename, reorder) — Drag-and-drop via `BudgetDndProvider`.
- [x] Categories (create, rename, reorder, move between groups) — Including cross-group drag-and-drop.
- [x] Carryforward / month rollover — `computeCarryforward()` — regular categories reset negatives, CC carries debt.
- [x] Cumulative `available` propagation — Assignment changes propagate to all future months.
- [x] Overspending detection (cash vs credit) — Per-category classification with mixed overspending support.
- [x] Overspending colors (red = cash, yellow = credit) — `AvailabilityBubble.tsx` with correct color logic.
- [x] Budget Inspector (sidebar panel) — Month Summary, Spending by month with year groups, Quick Budget tools.
- [x] Ghost entry prevention — Deletes zero rows, `HAVING COUNT(*) >= 10` safety net.
- [ ] "Move Money" between categories — YNAB modal to move money from one category to another. Users must manually adjust two assignments.
- [ ] "Cover Overspending" flow — YNAB's yellow bubble links to a "cover" flow that moves money from other categories.
- [ ] Underfunded / Quick Budget per category — Inspector has Quick Budget UI but limited; missing "Underfunded", "Average Spent", "Spent Last Month" quick-assign options.
- [ ] Category hiding/unhiding UI — `hidden` column exists in schema (🏗️) but no UI to toggle.
- [ ] Category deletion — No delete category or delete category group API/UI.
- [ ] Multi-month view — YNAB shows 1–3 months side-by-side. Clone shows only 1 month.

---

## 2. Accounts

**Domain Completeness: ~65% · 6/10 features**

- [x] Account types (Checking, Savings, Credit, Cash) — Schema also supports `investment` and `tracking`.
- [x] Create account — Via `AccountEditModal` with starting balance support.
- [x] Edit account (name, notes) — Full modal with name, notes editing.
- [x] Close / reopen account — With confirmation flow.
- [x] Account balances (working/cleared/uncleared) — Computed from transactions with future-date exclusion.
- [x] Sidebar account list with balances — Grouped by type (Cash, Credit, Closed) with collapsible sections and total.
- [ ] Delete account — No delete functionality, only close.
- [ ] Tracking accounts — Enum value exists (🏗️), no specialized behavior (investments, mortgages don't affect RTA).
- [ ] Account reordering — Accounts sorted alphabetically, no drag-to-reorder in sidebar.
- [ ] Net worth from all accounts — No aggregate net worth display.

---

## 3. Transactions

**Domain Completeness: ~50% · 11/21 features**

- [x] Create transaction (date, payee, category, memo, amount, cleared) — Full modal with validation.
- [x] Edit transaction — In-place editing via modal.
- [x] Delete transaction — With atomic budget recalculation.
- [x] Toggle cleared status — Click-to-toggle: Uncleared → Cleared → Reconciled.
- [x] Virtualized transaction list — `@tanstack/react-virtual` for performance with large datasets.
- [x] Transfer between accounts — Creates linked transaction pair with `transfers` table.
- [x] Payee autocomplete — Distinct payees from transaction history.
- [x] Reconciliation — Full flow: enter bank statement balance → see difference → approve → mark reconciled.
- [x] Inflow: Ready to Assign (income) — Properly flows through RTA calculation.
- [x] Category-less transfers — No category for transfers, correctly handled in CC payment and RTA logic.
- [x] Memo field visibility — Visible in both table and modal.
- [ ] Transaction flags — `flag` column in schema (🏗️), visible in table, but no color picker or filter UI.
- [ ] Future transactions (scheduled upcoming) — Displayed as dimmed rows (🟡) but not true scheduled/recurring transactions.
- [ ] Multi-select bulk actions — Checkbox selection exists (🟡) but no bulk delete, categorize, or clear.
- [ ] Scheduled / Recurring transactions — YNAB's killer feature: monthly rent, bi-weekly paycheck auto-create on schedule.
- [ ] Split transactions — Cannot split one transaction across multiple categories.
- [ ] Search & filter transactions — Search icon exists (🟡) but no functional search or filter.
- [ ] Import transactions (OFX/QFX/CSV) — Import is YNAB-format bulk import, not bank statement import.
- [ ] Running balance column — YNAB shows cumulative balance per transaction in account view.
- [ ] Payee rename rules — YNAB memorizes category per payee and auto-suggests for recurring payees.

---

## 4. Credit Cards

**Domain Completeness: ~90% · 8/9 features** ✅ (strongest area)

- [x] CC Payment category auto-creation — `ensureCreditCardPaymentCategory()` creates linked CC payment category per CC account.
- [x] Funded spending → CC Payment available — `calculateFundedAmount()` moves funded portion only.
- [x] Credit overspending (yellow, no RTA impact) — With explicit correction in RTA formula.
- [x] Cash overspending on CC (correct handling) — CC transactions always classified as credit overspending.
- [x] CC Payment deduction (transfers reduce available) — Transfers with `category_id IS NULL` correctly subtracted.
- [x] Positive CC balance → RTA — Cashback/overpayments treated as cash.
- [x] CC debt carryforward — CC payment categories carry negative balances across months.
- [x] CC payment recording — Via transfer from Checking/Savings to CC account.
- [ ] CC rewards/cashback tracking UI — Positive balances handled (🟡) but no dedicated rewards tracking UI.

---

## 5. Reports & Analytics

**Domain Completeness: 0% · 0/7 features**

- [ ] Spending report (by category) — Pie/bar chart showing where money goes.
- [ ] Spending report (by payee) — Category-style report grouped by payee.
- [ ] Income vs. Expense report — Monthly cash flow overview.
- [ ] Net Worth report — Track balance of all accounts over time.
- [ ] Age of Money — YNAB's signature metric: "How old is the money you're spending today?"
- [ ] Spending trends over time — Line charts showing category spending month-over-month.
- [ ] Category spending targets vs actuals — Compare budgeted vs. spent.

---

## 6. Goals / Targets

**Domain Completeness: 0% · 0/6 features**

- [ ] Monthly Savings Builder — Assign $X every month.
- [ ] Target Balance by Date — Need $5,000 by December for vacation.
- [ ] Monthly Spending Target — Budget $400/month for groceries.
- [ ] Needed for Spending — $1,200 due on the 1st for rent.
- [ ] Goal progress indicators — Colored progress bars in budget table.
- [ ] Underfunded calculation — "How much more do I need to assign to be on track?"

---

## 7. Data Import / Export

**Domain Completeness: ~25% · 2/6 features**

- [x] YNAB format bulk import — Full pipeline: budget JSON + register CSV → accounts, categories, transactions, budget months.
- [x] File upload UI — `ImportModal` with drag-and-drop file zones.
- [ ] Bank statement import (OFX/QFX/CSV) — Parse common bank export formats.
- [ ] Transaction matching for imports — Duplicate detection and merge logic.
- [ ] Data export (to CSV/JSON) — Export budget data for backup or analysis.
- [ ] Budget template export — Share budget structure without data.

---

## 8. Multi-User & Collaboration

**Domain Completeness: ~60% · 7/10 features**

- [x] User registration & login — NextAuth with credentials provider, bcrypt, session management.
- [x] Budget sharing (invite by email) — `ShareBudgetModal` with role-based access (owner/editor/viewer).
- [x] Role management (editor/viewer) — Permissions enforced at API layer via `withBudgetAccess`.
- [x] Share removal — Owner can revoke access.
- [x] Row-Level Security (RLS) — All queries scoped to `budgetId`, E2E tests verify tenant isolation.
- [x] Multiple budgets per user — Budget selection page, create/delete/update budgets.
- [x] Profile management (name, password) — `ProfileModal` with current password verification.
- [ ] Real-time collaboration — No WebSocket/SSE sync between concurrent users.
- [ ] Activity log / audit trail — No record of who changed what and when.
- [ ] OAuth / social login — Only credentials-based auth (no Google, Apple, etc.).

---

## 9. Scheduled & Recurring Transactions

**Domain Completeness: 0% · 0/5 features**

- [ ] Create recurring transaction — Define pattern and auto-generate.
- [ ] Recurrence patterns (weekly, biweekly, monthly, etc.) — Full scheduling engine.
- [ ] Auto-enter on due date — Transactions materialize automatically.
- [ ] Upcoming schedule view — Calendar or list of upcoming scheduled transactions.
- [ ] Skip / edit single occurrence — Modify one instance without affecting the series.

---

## 10. Mobile Experience

**Domain Completeness: ~10% · 0/4 features**

- [ ] Responsive design — Desktop-first (🟡). Some responsive utilities but sidebar and budget table are not mobile-optimized.
- [ ] PWA / mobile app install — No service worker, no manifest for installable PWA.
- [ ] Touch-optimized interactions — Drag-and-drop, hover states, small click targets designed for mouse.
- [ ] Quick entry widget — YNAB mobile has a "quick add transaction" from notification shade.

---

## 11. Bank Sync (Direct Import)

**Domain Completeness: 0% · 0/4 features**

- [ ] Plaid / bank integration — Connect to financial institutions.
- [ ] Auto-import transactions — Pull transactions automatically.
- [ ] Match imported ↔ manual — Merge imported transactions with manually entered ones.
- [ ] Connection management — Add, refresh, remove bank connections.

---

## 12. UX Polish & Platform Features

**Domain Completeness: ~50% · 7/15 features**

- [x] Dark mode — Full neumorphic dark theme.
- [x] Currency formatting (locale-aware) — COP with configurable decimals.
- [x] Animated number transitions — `useAnimatedNumber` for smooth RTA changes.
- [x] Offline-first optimistic updates — Full snapshot/rollback pattern with mutation queue.
- [x] Sync status indicator — `SyncStatus.tsx` (syncing/saved/offline/queued).
- [x] Cross-tab sync — `useBroadcastSync` for multi-tab cache invalidation.
- [x] Error monitoring (Sentry) — Client + server with performance spans, user context, release tracking.
- [ ] Keyboard shortcuts — Escape/Enter only (🟡). No budget-specific shortcuts (← → for months, N for new transaction).
- [ ] Accessibility — Some ARIA labels (🟡). E2E test exists but coverage is basic.
- [ ] Undo/Redo — YNAB has undo for recent actions (especially transaction deletes).
- [ ] Tooltips / Onboarding — No first-time user tour, no contextual help.
- [ ] Notification center — No in-app alerts for overspending, goal deadlines, etc.
- [ ] Drag-and-drop money — YNAB allows dragging money between Available bubbles.
- [ ] Emoji picker for categories — Text field accepts emojis but no picker UI.
- [ ] Health/API/Docs — ✅ `/api/health`, ✅ OpenAPI at `/api/docs` (already done but counted in total).

---

## Prioritized Roadmap

### Phase 1 — Complete the Core Loop _(High Impact, fills biggest gaps)_

- [ ] **1.1 Scheduled / Recurring Transactions** — Without this, users can't model predictable expenses. YNAB's most-used feature after budgeting.
- [ ] **1.2 Goals / Targets** — "Am I on track?" is core to YNAB's value proposition. Monthly spending targets + target balance by date cover 80%.
- [ ] **1.3 Split Transactions** — Blocking for power users at stores like Target, Costco, Amazon where one purchase spans categories.
- [ ] **1.4 Transaction Search & Filter** — Essential once you have more than a month of data.

### Phase 2 — Reporting & Insights _(Value Multiplier)_

- [ ] **2.1 Spending Report (by category/payee)** — The "aha moment" that keeps users budgeting.
- [ ] **2.2 Income vs. Expense** — Monthly cash flow overview.
- [ ] **2.3 Net Worth Report** — Tracks progress over time.
- [ ] **2.4 Age of Money** — YNAB's signature metric and key engagement driver.

### Phase 3 — Transaction Power Features

- [ ] **3.1 Multi-select Bulk Actions** — Bulk categorize, clear, delete.
- [ ] **3.2 Running Balance** — Per-transaction cumulative balance.
- [ ] **3.3 Move Money / Cover Overspending** — Guided flow to fix yellow/red categories.
- [ ] **3.4 Payee Rules (auto-categorization)** — Remembers category per payee.

### Phase 4 — Platform Maturity

- [ ] **4.1 Category Delete / Hide UI** — Clean up unused categories.
- [ ] **4.2 Data Export (CSV/JSON)** — Backup and regulatory needs.
- [ ] **4.3 Responsive / Mobile Design** — Expand user base.
- [ ] **4.4 Undo/Redo** — Safety net for accidental changes.
- [ ] **4.5 Multi-month Budget View** — See 2–3 months side-by-side.

### Phase 5 — Optional / Advanced

- [ ] **5.1 Bank Statement Import (CSV/OFX)** — Bridge until bank sync.
- [ ] **5.2 Real-time Collaboration** — WebSocket sync for shared budgets.
- [ ] **5.3 OAuth Login** — Google/Apple sign-in.
- [ ] **5.4 Bank Sync (Plaid)** — Requires API subscription, highest effort.

---

## Architecture Strengths (What's Already World-Class)

| Area                                          | Assessment                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Financial Engine**                          | Pure functions, zero side effects, branded `Milliunit` type, exhaustive unit tests. Better than most fintech startups.          |
| **3-Layer Architecture** (Engine → Repo → UI) | Clean separation. Engine is portable, repos are DB-agnostic patterns.                                                           |
| **Optimistic Updates**                        | Snapshot/rollback with engine-powered exact values. Production-grade.                                                           |
| **CC Payment Logic**                          | Funded spending, payment deduction, debt carryforward, overspending correction — all correct. Hardest part of YNAB, done right. |
| **Security**                                  | RLS via `withBudgetAccess`, rate limiting, account lockout, E2E tenant isolation tests.                                         |
| **Observability**                             | Sentry integration with user context, performance spans, release tracking.                                                      |
| **CI/CD**                                     | Health checks, security audits, lint, type check, unit tests, E2E tests, deployment verification.                               |
| **Future Date Exclusion**                     | CI guard (`check:future-filter`) prevents the most common YNAB-clone bug.                                                       |

---

## Changelog

| Date       | Update                                                     |
| ---------- | ---------------------------------------------------------- |
| 2026-02-13 | Initial assessment created. Full codebase audit completed. |
