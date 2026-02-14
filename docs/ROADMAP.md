# Technical Roadmap

> Last updated: 2026-02-13 | Health Score: 8.5/10 | See `docs/audits/` for open findings

## Current State

The codebase is architecturally sound: 542+ unit tests, 50+ E2E tests, ~98% coverage, 100% engine coverage, zero type safety escapes, zero circular dependencies, and consistent patterns across all layers. The SaaS multi-tenant migration (auth, budgets, sharing, RLS) is complete. Internationalization (es/en) is fully implemented with `next-intl`. What follows are **growth opportunities** — not fixes.

---

## 🏗️ Infrastructure & DX

### I1. CI/CD Pipeline ✅

**Priority:** 🔴 High | **Effort:** M (1–3h) | **Completed:** 2026-02-11

PR-only GitHub Actions pipeline with `ci-passed` summary gate. Quality-gate runs first (lint, typecheck, build), then unit-tests and e2e-tests in parallel. E2E only runs on PRs to main.

- [x] GitHub Actions workflow: `quality-gate → unit-tests + e2e-tests → ci-passed`
- [x] Branch protection: require `ci-passed` before merge (rulesets)
- [x] Node version pinned via `.node-version` file
- [x] Coverage thresholds enforced (100% engine, ~96% global)
- [ ] Lighthouse CI for performance budgets (deferred — requires auth bypass)

### I2. Split `budget.ts` ✅

**Priority:** 🟡 Medium | **Effort:** L (half day) | **Completed:** 2026-02-13

Split the largest repo file into focused domain modules:

- [x] Extract `budget-rta.ts` — RTA calculation + breakdown queries
- [x] Extract `budget-cc.ts` — CC payment orchestration + overspending
- [x] Slim `budget.ts` — mutations, activity, inspector only
- [x] All consumers and tests updated — zero regressions

### I3. CHANGELOG

**Priority:** 🟢 Low | **Effort:** S (<30min)

Mentioned in 4 consecutive audits. Track releases for shared budget collaborators.

- [ ] Create `CHANGELOG.md` with retroactive entries for major milestones
- [ ] Adopt [Keep a Changelog](https://keepachangelog.com/) format

### I4. Resolve npm Cache Permissions ✅

**Priority:** 🟢 Low | **Effort:** S (<15min) | **Completed:** 2026-02-13

- [x] Updated `with-local-tmp.sh` to redirect npm cache to local `.tmp/npm-cache`
- [x] All npm/npx commands use the wrapper — no more `EPERM` errors
- [x] Updated rules, workflows, and skills to document the pattern

---

## 📊 Observability & Performance

### O1. Structured Logging

**Priority:** 🟡 Medium | **Effort:** M (1–3h)

`lib/logger.ts` exists but is basic (`console.log` wrapper). Production needs structured output.

- [ ] JSON log format with `timestamp`, `level`, `context`, `requestId`
- [ ] Request-scoped correlation IDs via middleware
- [ ] Log rotation / shipping strategy (stdout for Docker, or file + logrotate)

### O2. Error Tracking (Sentry) ✅ Partial

**Priority:** 🟡 Medium | **Effort:** M (1–3h) | **Partially completed:** 2026-02-13

Sentry is integrated with budget context tagging (`setBudgetContext` in Sidebar).

- [x] Install `@sentry/nextjs`
- [x] Basic client + server error boundaries
- [x] Custom context: `budgetId`, `budgetName`
- [ ] Source maps upload on build
- [ ] Full server-side instrumentation

### O3. Performance Monitoring

**Priority:** 🟢 Low | **Effort:** M (1–3h)

No benchmarks or performance budgets beyond the 2MB bundle check.

- [ ] Lighthouse CI in GitHub Actions (performance, a11y, best practices)
- [ ] Core Web Vitals tracking (LCP, FID, CLS) via `next/web-vitals`
- [ ] Bundle analysis with `@next/bundle-analyzer`
- [ ] Database query timing logs for slow queries (>100ms)

---

## ♿ Quality & Accessibility

### Q1. Accessibility Audit ✅

**Priority:** 🟡 Medium | **Effort:** M (1–3h) | **Completed**

axe-core E2E tests run on every PR to main. All WCAG 2.1 AA violations resolved (6/6 tests pass).

- [x] Run axe-core audit on all pages — `tests/accessibility.spec.ts`
- [x] Fix all WCAG AA violations (contrast, focus indicators, screen reader labels)
- [x] Add `aria-live` regions for RTA banner changes and toast notifications
- [x] Keyboard navigation audit: modal trapping, tab order, skip links

### Q2. API Documentation ✅

**Priority:** 🟢 Low | **Effort:** M (1–3h) | **Completed:** 2026-02-11

19 API routes documented with auto-generated OpenAPI 3.1 spec.

- [x] Auto-generate OpenAPI spec from Zod schemas (`@asteasolutions/zod-to-openapi` v8)
- [x] Swagger UI at `/api/docs` (dev only), raw spec at `/api/docs/spec`
- [x] Updated `docs/api-reference.md` to link to Swagger UI

---

## 🚀 Product Features (from features.md)

### F1. Goals / Targets

**Priority:** 🟡 Medium | **Effort:** L (1–2 days)

YNAB's core differentiator. Currently approximated in Budget Inspector.

- [ ] Schema: `category_targets` table (type, amount, target_date, cadence)
- [ ] Engine: `calculateTarget()` pure function in `lib/engine/targets.ts`
- [ ] Types: Needed for specific date, Monthly savings, Savings balance, Spending
- [ ] UI: Target indicator in budget row, progress bar, underfunded highlighting
- [ ] Auto-assign: "Underfunded" button fills to target

### F2. Reports

**Priority:** 🟡 Medium | **Effort:** L (1–2 days)

Visual spending analysis — the #2 most-requested YNAB feature.

- [ ] Spending by Category (bar chart, monthly/all-time)
- [ ] Spending Trends (line chart, month-over-month)
- [ ] Net Worth over time (area chart, accounts + liabilities)
- [ ] Income vs Expense (stacked bar)
- [ ] Page: `/budgets/[budgetId]/reports` with chart library (Recharts or Chart.js)

### F3. Transaction Search & Filter

**Priority:** 🟡 Medium | **Effort:** M (1–3h)

No way to search transactions beyond scrolling.

- [ ] Search bar in account views (payee, memo, amount)
- [ ] Filter by: date range, category, cleared status, amount range
- [ ] Server-side filtering in `getTransactions()` for performance
- [ ] URL query params for shareable filter state

### F4. Multi-Currency Support

**Priority:** 🟢 Low | **Effort:** M (1–3h)

Schema has `currency_code`, `currency_symbol`, `currency_decimals` on budgets but UI hardcodes COP formatting.

- [ ] Dynamic currency formatting in `lib/format.ts` based on budget settings
- [ ] Currency picker in budget create/edit
- [ ] Display correct symbol in all monetary displays

### F5. Email Service (Password Reset, Invitations)

**Priority:** 🟢 Low | **Effort:** L (half day)

Budget sharing works via direct link. No email notifications or password reset.

- [ ] Email provider integration (Resend, SendGrid, or SES)
- [ ] Password reset flow (token → email → reset page)
- [ ] Budget share invitations via email
- [ ] Email verification on registration

---

## 🔒 Security Hardening (from SaaS blueprint Fase 7)

### S1. Subscription / Billing

**Priority:** 🟢 Low (when going paid) | **Effort:** L (1 week)

- [ ] Stripe integration for subscriptions
- [ ] `subscriptions` table (plan, status, stripe_customer_id)
- [ ] Middleware to verify active subscription
- [ ] Pricing page and checkout flow

### S2. GDPR / Data Deletion

**Priority:** 🟢 Low (when going public) | **Effort:** M (1–3h)

- [ ] `DELETE /api/users/me` with cascade-delete of all user data
- [ ] Data export endpoint (download all data as JSON/CSV)
- [ ] Privacy policy page

### S3. Audit Logging

**Priority:** 🟢 Low | **Effort:** M (1–3h)

- [ ] `audit_log` table (who, what, when, budget_id)
- [ ] Log writes in repos for shared budgets (who changed what)

---

## Suggested Execution Order

| Phase           | Items                                               | Rationale                      |
| --------------- | --------------------------------------------------- | ------------------------------ |
| **Next**        | I3 (CHANGELOG), F3 (Search)                         | Track releases + usability     |
| **Soon**        | F1 (Goals), F2 (Reports)                            | Core product features          |
| **Mid-term**    | O1 (Logging), O2 (Sentry completion), F4 (Currency) | Production readiness + polish  |
| **Later**       | O3 (Performance), F5 (Email)                        | Observability + notifications  |
| **When needed** | S1 (Billing), S2 (GDPR), S3 (Audit log)             | Triggered by going public/paid |
