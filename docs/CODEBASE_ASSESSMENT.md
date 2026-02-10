# CODEBASE ASSESSMENT — Production Readiness Audit

**Application:** YNAB Clone (Zero-Based Budgeting SaaS)  
**Stack:** Next.js 16 · React 19 · Drizzle ORM · PostgreSQL · Auth.js v5  
**Date:** 2026-02-10  
**Auditor Role:** Principal Software Architect & Lead SRE Auditor  
**Target Scale:** 10M+ concurrent users, global deployment

---

## Executive Summary

| Dimension                        | Score (1–10) | Verdict                                                                       |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| **Domain Logic Accuracy**        | 8            | Strong. Engine is well-isolated, milliunit arithmetic is correct.             |
| **Mathematical Precision**       | 9            | Excellent. BIGINT storage, branded types, banker's rounding.                  |
| **High-Scale Architecture**      | 2            | **Critical failure.** Single-connection DB, N+1 queries, in-memory state.     |
| **Resilience & Observability**   | 2            | **Critical failure.** No logging, no metrics, no health endpoints beyond dev. |
| **Security & Compliance**        | 5            | Decent baseline (RLS, lockout, CSP). Gaps in encryption, IDOR, PII.           |
| **DevOps & CI/CD**               | 3            | No CI pipeline, no Docker, no IaC, no rollback strategy.                      |
| **Overall Production Readiness** | **3 / 10**   | A well-architected MVP with zero production infrastructure.                   |

> [!CAUTION]
> This codebase is an **excellent single-user/small-team MVP** with unusually strong domain logic. However, it would **catastrophically fail** under production load at any meaningful scale. Every infrastructure layer is absent. Deploying this as-is would be reckless.

---

## 1. Critical Architectural Risks (Showstoppers)

### 🔴 SHOWSTOPPER 1: Single Database Connection, No Pooling

```typescript
// lib/repos/client.ts:60-61
const client = postgres(connectionString);
const db: DrizzleDB = drizzle(client, { schema });
```

- [ ] **Single `postgres()` connection** — no connection pool. At 100 concurrent users, the DB will queue or reject connections.
- [ ] **No `max`, `idle_timeout`, or `connection_timeout`** configured on the postgres client.
- [ ] **Module-level singleton** — shared across all serverless invocations in the same process, but creates a new connection per cold start in serverless environments.
- [ ] **No connection health checks** — a broken connection stays cached until process restart.

**Impact at scale:** Complete service outage under any concurrent load. PostgreSQL default `max_connections = 100` will be exhausted by ~50 concurrent API requests.

---

### 🔴 SHOWSTOPPER 2: Non-Atomic Financial Operations

```typescript
// lib/repos/transactions.ts:374 — createTransactionAtomic
// "Sequential execution — no transaction wrapper to avoid PGlite deadlock"
const result = await createTransaction({...});
await deps.updateAccountBalances(budgetId, data.accountId);  // SEPARATE query
await deps.updateBudgetActivity(budgetId, data.categoryId, month);  // SEPARATE query
```

- [ ] **Transaction creation, balance update, and budget activity are NOT wrapped in a single DB transaction.** A crash between `createTransaction` and `updateAccountBalances` leaves the system in an inconsistent state.
- [ ] Every "atomic" composite operation (`createTransactionAtomic`, `updateTransactionAtomic`, `deleteTransactionAtomic`, `toggleClearedAtomic`) explicitly avoids wrapping in `database.transaction()` "to avoid PGlite deadlock."
- [ ] **PGlite is a dev/test dependency** — the production driver (`postgres.js`) supports concurrent transactions. This PGlite workaround has been accidentally shipped to production architecture.
- [ ] **No compensating transactions or saga pattern** — if the second or third step fails, there is no rollback or retry.

**Impact at scale:** Data corruption. Account balances will drift from actual transaction sums. Budget activity will become stale. Two concurrent transactions on the same account will produce incorrect balances (lost update problem).

---

### 🔴 SHOWSTOPPER 3: In-Memory Rate Limiter

```typescript
// lib/rate-limit.ts:9
// "In-memory only — resets on server restart."
// "For multi-instance deployments, replace with Redis-backed."
```

- [ ] Rate limiting state is stored in a `Map()` — evaporates on deploy/restart.
- [ ] **Useless in multi-instance deployment** — each serverless function/container has its own Map. An attacker can bypass rate limiting by simply hitting different instances.
- [ ] No distributed rate limiting solution (Redis, DynamoDB, Cloudflare rate limiting).

**Impact at scale:** Rate limiting provides zero protection. Brute-force login attacks, API abuse, and DDoS amplification are unmitigated.

---

### 🔴 SHOWSTOPPER 4: N+1 Query Epidemic in Core Financial Paths

```typescript
// lib/repos/budget.ts:597-618 — getCashOverspendingForMonth
for (const cat of overspentCategories) {
  const cashActivityRows = await queryRows<{ total: number }>(
    database,
    sql`...`,
  );
  // Query per overspent category
}
```

- [ ] `getCashOverspendingForMonth`: 1 query to get overspent categories + 1 query **per category** to check cash activity. With 50 overspent categories → 51 queries.
- [ ] `getOverspendingTypes`: Same N+1 pattern — 1 query + 1 per overspent category.
- [ ] `updateCreditCardPaymentBudget`: 1 query per spending category to get `available`. With 30 categories used on a CC → 31 queries.
- [ ] `refreshAllBudgetActivity`: 1 query per distinct category + 1 per CC account. Iterates sequentially with `for...of` + `await`.
- [ ] `getBudgetForMonth`: Calls `computeCarryforward` for each category without a budget_months row — each carryforward requires 2 queries (prev available + isCCPayment check).

**Impact at scale:** A single budget page load for a user with 50 categories could execute 100+ SQL queries. At 10M users, this is catastrophic for DB load.

---

## 2. Core Domain Logic (The Financial Engine)

### ✅ Strengths (Genuinely Well-Done)

- **Milliunit branded type** (`lib/engine/primitives.ts`): Prevents accidental mixing of raw numbers and monetary values at compile time. Runtime validation for NaN, Infinity, and MAX_SAFE_INTEGER. This is production-grade.
- **BIGINT storage** (`lib/db/schema.ts`): Money columns use a custom `money` Drizzle type backed by PostgreSQL `BIGINT`. Eliminates floating-point errors at the storage layer. Driver-level validation on read and write.
- **Banker's rounding** (`divideMilliunits`): Uses round-half-to-even for division, eliminating systematic bias. Correct implementation.
- **Pure engine functions** (`lib/engine/`): All financial math is in pure, dependency-free functions. The engine has zero imports from DB, HTTP, or React. This is textbook separation of concerns.
- **Credit overspending correction** in RTA: Correctly accounts for the difference between cash and credit overspending to prevent RTA inflation.

### ⚠️ Gaps

- [ ] **No audit log / event sourcing.** Transactions can be mutated (`UPDATE`, `DELETE`) with no history trail. For a financial application, this is a compliance gap. YNAB stores the full history of every change.
- [ ] **No immutability of historical transactions.** The `updateTransaction` function applies partial updates to any transaction regardless of date. There's no concept of a "closed period" where historical data becomes read-only.
- [ ] **Reconciled transactions can be modified** at the repo layer — only the PATCH API route blocks this, not the core repo. The defense is insufficient (should be enforced at the data layer).
- [ ] **`Math.abs(decimal - 0.5) > Number.EPSILON`** in banker's rounding: This epsilon check may fail for very large milliunits where floating-point representation loses precision in the decimal portion. Consider using an integer modulo approach instead.
- [ ] **No currency-aware arithmetic.** The engine assumes a single currency. Multi-currency budgets (a YNAB feature) are not supported and the architecture makes this difficult to add.

---

## 3. High-Scale Architecture

### 3a. Data Access Layer

- [ ] **No connection pooling** (see Showstopper 1).
- [ ] **N+1 queries in hot paths** (see Showstopper 4).
- [ ] **No query caching** — every page load re-executes the full RTA calculation (~10 SQL queries minimum, plus N+1s).
- [ ] **No read replicas** — all queries hit the primary.
- [ ] **No database indexes on compound keys used in WHERE clauses**: Budget queries filter on `budget_id` through JOINs (e.g., `category_groups.budget_id`) but there are no composite indexes on `(category_group_id, month)` for `budget_months` or `(account_id, date)` for `transactions` — these are the most common compound filters.
- [ ] **No pagination with cursors** — `getTransactions` supports `LIMIT` but no cursor/offset. Loading 10K+ transactions will transfer megabytes per request.
- [ ] **String-based month comparison** (`bm.month > ?`): Month columns use `TEXT` type. While lexicographic comparison works for `YYYY-MM`, it prevents PostgreSQL from using date-specific optimizations and range partitioning.
- [ ] **No sharding readiness.** The schema uses `serial` (auto-increment) primary keys, which don't support horizontal sharding. No UUIDs on tenant data, no shard key patterns.

### 3b. State Management

- [ ] **Full budget data loaded on every month navigation.** `useBudget(month)` invalidates and refetches all categories + budget data on month change.
- [ ] **No virtual scrolling for category list** — the budget page renders all categories. With 200+ categories, this causes layout thrashing.
- [ ] **React Query cache invalidation is aggressive** — `onSettled` invalidates `['transactions']`, `['accounts']`, AND `['budget']` for every single mutation, causing waterfall refetches.
- [ ] **`VirtualTransactionTable.tsx` is 20KB** — a single 500-line component handling virtualization, filtering, editing, selection, and keyboard navigation. No code splitting.

### 3c. Concurrency and Race Conditions

- [ ] **No optimistic concurrency control.** No `version` column, no `updatedAt` check, no ETags. Two users editing the same budget simultaneously will silently overwrite each other's changes (last-write-wins).
- [ ] **`updateBudgetAssignment` reads-then-writes without locking.** The existing check (`SELECT assigned, available ... WHERE`) and the subsequent `UPDATE` are not atomic — a concurrent assignment to the same category in the same month will produce incorrect `available` values.
- [ ] **Non-atomic composite operations** (see Showstopper 2) — sequential queries without transaction wrapper.
- [ ] **No idempotency keys** on any API endpoint. Retrying a failed `POST /transactions` will create duplicate transactions.

---

## 4. Resilience & Observability

### 4a. Error Handling

- [ ] **Error swallowing in `setTenantContext`** (`lib/auth-helpers.ts:68`): RLS session variable assignment silently catches and ignores all errors. If the database connection is broken, the app continues serving data without tenant isolation.
  ```typescript
  try {
    await database.execute(sql`SELECT set_config(...)`);
  } catch {
    /* Silently ignore */
  }
  ```
- [ ] **Generic 500 responses.** All API routes catch errors and return `{ error: 'Failed to ...' }` with `status: 500`. No error codes, no correlation IDs, no structured error payloads. Clients cannot distinguish between "DB is down" and "invalid data caused a crash."
- [ ] **`console.error` is the only logging.** No structured logging (JSON format), no log levels, no logger library. In production, `console.error` goes to stdout where it's mixed with Next.js framework noise.
- [ ] **No error boundaries in React** beyond `app/global-error.tsx`. Component-level errors crash the entire page.

### 4b. Telemetry & Monitoring

- [ ] **Zero application metrics.** No request latency histograms, no query timing, no cache hit rates, no active user counts.
- [ ] **No distributed tracing.** No OpenTelemetry, no correlation IDs between client requests and server operations.
- [ ] **No alerting integration.** No Sentry, Datadog, PagerDuty, or equivalent.
- [ ] **No health check endpoint for load balancers.** The `scripts/health-check.ts` is a CLI script, not an HTTP endpoint (`/api/health`). Load balancers and container orchestrators have no way to verify the service is healthy.
- [ ] **No readiness/liveness probes.** Kubernetes, ECS, or any container runtime cannot detect a stalled or degraded instance.

### 4c. Idempotency

- [ ] **No idempotency keys on write endpoints.** `POST /api/budgets/:id/transactions` creates a new transaction on every call. Mobile clients with poor connectivity will create duplicate transactions on retry.
- [ ] **No `If-Match` / `If-None-Match` headers.** No ETag support for optimistic concurrency.
- [ ] **DELETE operations are not idempotent in the expected sense.** Deleting a non-existent transaction returns 404, which is correct, but concurrent deletes of the same transaction could race with `getTransferByTransactionId` checks.

---

## 5. Security & Compliance

### 5a. What's Done Well

- **Security headers** (`next.config.ts`): CSP, HSTS (2 years + preload), X-Frame-Options DENY, Permissions-Policy. Solid baseline.
- **Zod input validation** on all API routes — inputs are validated before reaching the data layer.
- **Account lockout** (5 attempts, 15-minute window) with failed attempt counter stored in DB.
- **RLS policies** as defense-in-depth for multi-tenancy.
- **`requireBudgetAccess()`** on every API route with budgetId.
- **bcrypt** password hashing with proper compare.

### 5b. Gaps

- [ ] **RLS is not enforced in development/production with superuser.** The migration comment states: "RLS does NOT apply to the database superuser/owner role." If the production connection string uses the DB owner role (likely, given the simple `DATABASE_URL`), RLS provides **zero actual protection.**
- [ ] **No separate DB role for the application.** The app connects as the default user (likely `postgres` superuser), bypassing all RLS policies.
- [ ] **AUTH_SECRET is committed to `.env`** (not `.env.example`): `e85857dc9d84fc869c866398a5ee5685a2076302da309d2eb8ca54bc1f45a50e`. This should NEVER be in version control.
- [ ] **No data-at-rest encryption.** Database connection has no `?sslmode=require` parameter. No column-level encryption for PII.
- [ ] **No data-in-transit enforcement at DB level.** `DATABASE_URL=postgresql://localhost:5432/ynab_dev` — no SSL/TLS parameters.
- [ ] **IDOR vulnerability in `getAccountType`** (`lib/repos/accounts.ts:67-72`): Queries account type by `accountId` without `budgetId` filter. A user can probe any account's type across tenants.
  ```typescript
  async function getAccountType(accountId: number): Promise<string | null> {
    const rows = await database
      .select({ type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, accountId)); // ← No budgetId check
    return rows[0]?.type || null;
  }
  ```
- [ ] **IDOR in `isCreditCardAccount`** — delegates to `getAccountType`, inheriting the vulnerability.
- [ ] **Password stored alongside user data** — `users` table has `password` next to `email` and `name`. A single query leak (error message, debug log) could expose hashes.
- [ ] **No password complexity requirements.** `RegisterSchema` likely has minimal validation.
- [ ] **`X-Forwarded-For` trusted without validation** (`getClientIP`): An attacker can set arbitrary IPs to bypass rate limiting, even in the in-memory implementation.
- [ ] **CSP allows `unsafe-inline` and `unsafe-eval`** — significantly weakens XSS protection. Necessary for Next.js, but should use nonces in production.
- [ ] **No CSRF protection beyond same-origin headers.** While CSP `form-action 'self'` helps, there's no explicit CSRF token for state-changing operations.

### 5c. PII Handling

- [ ] **No PII inventory.** Emails and names are stored in plaintext in the `users` table. Transaction payees and memos may contain PII (names, addresses).
- [ ] **No data retention policy.** No mechanism to delete user data (GDPR right to erasure).
- [ ] **No data export capability** (GDPR right to portability) beyond the CLI import script.
- [ ] **Backup file committed to repo:** `backup_pre_multitenancy.sql` (749KB) may contain user data.

---

## 6. Functional Gap Analysis vs. YNAB Core

| Feature                          | Status         | Notes                                                      |
| -------------------------------- | -------------- | ---------------------------------------------------------- |
| Zero-based budgeting             | ✅ Complete    | RTA formula matches YNAB specs                             |
| Multi-month budget view          | ✅ Complete    | Per-month navigation with correct scoping                  |
| Credit card management           | ✅ Complete    | Funded spending, CC payment available                      |
| Overspending (cash vs credit)    | ✅ Complete    | Correct classification and rollover                        |
| Account reconciliation           | ✅ Complete    | Cleared → Reconciled, balance verification                 |
| Transfers between accounts       | ✅ Complete    | Bi-directional transaction linking                         |
| Budget sharing                   | ⚠️ Schema only | `budget_shares` table exists but no invite/accept flow     |
| Goals / Targets                  | ❌ Missing     | No savings goals, target dates, or monthly funding targets |
| Scheduled/recurring transactions | ❌ Missing     | No future transaction auto-creation                        |
| Reports & Analytics              | ❌ Missing     | No spending reports, income vs expense, net worth          |
| Multi-currency                   | ❌ Missing     | Single currency per budget (COP default)                   |
| Age of Money                     | ❌ Missing     | Key YNAB metric not implemented                            |
| Mobile responsiveness            | ⚠️ Partial     | Desktop-focused layout with basic responsive CSS           |
| Undo/Redo                        | ❌ Missing     | No action history                                          |
| Import from banks                | ❌ Missing     | Only CSV import from YNAB export                           |

---

## 7. DevOps & Infrastructure

- [ ] **No Dockerfile or docker-compose.yml.** The app can only be run with manually installed Node.js and PostgreSQL.
- [ ] **No CI/CD pipeline.** No GitHub Actions, no Jenkins, no GitLab CI. Tests are run manually.
- [ ] **No infrastructure-as-code.** No Terraform, Pulumi, CDK, or equivalent.
- [ ] **No deployment configuration.** No Vercel project config, no Kubernetes manifests, no ECS task definitions.
- [ ] **No environment parity.** `.env` contains literal local paths to CSV files. No staging or production environment support.
- [ ] **Migration safety is manual.** `npm run db:migrate` runs on `npm start`, meaning a bad migration will crash the production server on deploy.
- [ ] **No migration rollback strategy.** Drizzle Kit generates forward-only SQL migrations. No `down` migrations.
- [ ] **No blue-green or canary deployment support.** Schema migrations are coupled to app startup.
- [ ] **No backup/restore automation.** The `backup_pre_multitenancy.sql` file was manually dumped.
- [ ] **No secrets management.** `AUTH_SECRET` is in `.env` with a hardcoded value.

---

## 8. The Scalability Roadmap ("Sanas Path")

### Phase 1: Immediate Critical Fixes (Security & Data Integrity) — Week 1–2

> Must fix before ANY production deployment, even for 100 users.

- [ ] **Create a non-superuser PostgreSQL role** for the application with RLS enforcement. Revoke superuser access from `DATABASE_URL`.
- [ ] **Remove `AUTH_SECRET` from `.env`** — rotate the secret, use environment variable injection from secrets manager (e.g., AWS Secrets Manager, Vault).
- [ ] **Delete `backup_pre_multitenancy.sql`** from the repository and scrub from git history.
- [ ] **Add `budgetId` check to `getAccountType` and `isCreditCardAccount`** — fix the IDOR vulnerability.
- [ ] **Wrap composite operations in DB transactions** — `createTransactionAtomic`, `updateTransactionAtomic`, `deleteTransactionAtomic` must use `database.transaction()` with the production driver. Add a runtime check: if PGlite, use sequential; if postgres.js, use transaction.
- [ ] **Add `sslmode=require` to production `DATABASE_URL`**.
- [ ] **Add idempotency key** to `POST /transactions` (accept `Idempotency-Key` header, store in DB, deduplicate within 24h window).
- [ ] **Remove `backup_pre_multitenancy.sql`** from the repository.
- [ ] **Add password complexity requirements** to `RegisterSchema` (min 8 chars, mixed case, number).

### Phase 2: Structural Refactoring (Performance & Scaling) — Week 3–8

> Required to serve 1K–100K users reliably.

- [ ] **Implement connection pooling** — configure `postgres({ max: 20, idle_timeout: 30, ... })` or use PgBouncer externally.
- [ ] **Eliminate N+1 queries** — rewrite `getCashOverspendingForMonth`, `getOverspendingTypes`, and `updateCreditCardPaymentBudget` to use batch queries or `JOIN`/subquery patterns.
- [ ] **Add composite indexes**: `(category_id, month)` on `budget_months`, `(account_id, date)` on `transactions`, `(budget_id, type)` on `accounts`.
- [ ] **Implement cursor-based pagination** for `getTransactions` — replace `LIMIT` with `WHERE id < cursor ORDER BY id DESC LIMIT N`.
- [ ] **Add optimistic concurrency control** — `version` column on `budget_months`, `accounts`. Return 409 on conflict.
- [ ] **Replace in-memory rate limiter** with Redis-backed implementation (or use Cloudflare/AWS WAF rate limiting).
- [ ] **Create `/api/health` endpoint** returning DB connectivity, cache status, and dependency health.
- [ ] **Add structured logging** — use Pino or Winston with JSON output, log levels, and request correlation IDs.
- [ ] **Dockerize the application** — multi-stage build (deps → build → runtime), separate containers for app and DB.
- [ ] **Create CI/CD pipeline** — lint → type-check → unit tests → build → E2E tests → deploy.
- [ ] **Add `down` migration strategy** — either Drizzle Kit custom scripts or manual SQL rollback files.

### Phase 3: Polish & Observability (Production Excellence) — Week 9–16

> Required to serve 100K–10M+ users with SLA guarantees.

- [ ] **Implement OpenTelemetry** — traces for every API request, DB query spans, custom metrics (RTA calculation time, cache hit rate).
- [ ] **Add Sentry or equivalent** error tracking with source maps, release tracking, and user context.
- [ ] **Implement read replicas** — route read-heavy queries (getTransactions, getBudgetForMonth) to replicas.
- [ ] **Add Redis caching layer** — cache RTA calculations, budget data per user+month with TTL invalidation on writes.
- [ ] **Implement event sourcing for transactions** — append-only log + materialized views, enabling full audit trails and GDPR compliance.
- [ ] **Add data retention and export APIs** for GDPR compliance.
- [ ] **Implement CSP nonces** — replace `unsafe-inline` / `unsafe-eval` with per-request nonces.
- [ ] **Add rate limiting per user** (not just IP) — authenticated rate limits using user ID as key.
- [ ] **Implement horizontal scaling** — stateless app layer, external session store, database connection pooling via PgBouncer.
- [ ] **Add canary/blue-green deployment** — decouple migration from app startup, run migrations as a separate step.
- [ ] **Implement WebSocket/SSE** for real-time multi-user budget collaboration (budget_shares feature).
- [ ] **Load testing** — establish baselines with k6 or Artillery, define SLOs (p99 < 200ms for budget page, p99 < 500ms for transaction list).

---

## Appendix: Test Coverage Summary

| Test Type                          | Count         | Coverage Assessment                                              |
| ---------------------------------- | ------------- | ---------------------------------------------------------------- |
| Unit tests (Vitest)                | 19 files      | Engine functions well-tested. Repos tested via PGlite.           |
| E2E tests (Playwright)             | 15 specs      | Auth, CRUD, navigation, tenant isolation, security headers.      |
| Schema validation tests            | 1 file (36KB) | Comprehensive Zod schema edge cases.                             |
| Rate limit tests                   | 1 file        | Sliding window logic verified.                                   |
| **Missing:** Load tests            | 0             | No performance benchmarks exist.                                 |
| **Missing:** Integration tests     | 0             | No tests for the full API→DB→Response cycle outside E2E.         |
| **Missing:** Chaos/fault injection | 0             | No tests for DB failure, network partition, or partial failures. |

---

_Assessment performed by forensic analysis of source code, schema, migrations, tests, and configuration. No code was executed during this audit._
