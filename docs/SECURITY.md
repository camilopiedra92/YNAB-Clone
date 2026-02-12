# Security Vulnerability & Hardening Tracker

> **Last Updated:** 2026-02-11 · **Status:** All Known Vulnerabilities Resolved  
> **Maintained by:** Engineering Team · **Review Cadence:** Monthly

---

## Quick Status

| Category                | Status | Details                                                        |
| ----------------------- | ------ | -------------------------------------------------------------- |
| npm Dependencies        | ✅     | 0 vulnerabilities / 591 packages                               |
| Authentication          | ✅     | Bcrypt + account lockout + rate limiting                       |
| Authorization           | ✅     | `withBudgetAccess()` on all budget routes (transaction-scoped) |
| SQL Injection           | ✅     | Parameterized queries (Drizzle ORM)                            |
| XSS                     | ✅     | CSP + React auto-escaping                                      |
| CSRF                    | ✅     | Auth.js built-in CSRF tokens                                   |
| Clickjacking            | ✅     | `X-Frame-Options: DENY` + `frame-ancestors 'none'`             |
| Transport Security      | ✅     | HSTS with preload (2 years)                                    |
| Secrets Management      | ✅     | Zod-validated, no hardcoded secrets                            |
| Rate Limiting           | ✅     | 3 tiers: auth, API, import                                     |
| Multi-Tenancy Isolation | ✅     | Transaction-scoped RLS + NULLIF-protected policies             |

---

## Table of Contents

1. [Dependency Vulnerabilities](#1-dependency-vulnerabilities)
2. [Authentication & Session Security](#2-authentication--session-security)
3. [Authorization & Multi-Tenancy](#3-authorization--multi-tenancy)
4. [Injection Attacks](#4-injection-attacks)
5. [Cross-Site Scripting (XSS)](#5-cross-site-scripting-xss)
6. [Cross-Site Request Forgery (CSRF)](#6-cross-site-request-forgery-csrf)
7. [Security Headers](#7-security-headers)
8. [Rate Limiting & Abuse Prevention](#8-rate-limiting--abuse-prevention)
9. [Secrets & Environment Management](#9-secrets--environment-management)
10. [Known Limitations & Future Work](#10-known-limitations--future-work)
11. [Security Test Coverage](#11-security-test-coverage)
12. [Audit Decision Log](#12-audit-decision-log)

---

## Risk Scale

| Level       | CVSS    | Color  | Meaning                                             |
| ----------- | ------- | ------ | --------------------------------------------------- |
| 🔴 Critical | 9.0+    | Red    | Immediate exploitation risk, data breach possible   |
| 🟠 High     | 7.0–8.9 | Orange | Significant risk, exploit requires low complexity   |
| 🟡 Medium   | 4.0–6.9 | Yellow | Moderate risk, exploit requires specific conditions |
| 🟢 Low      | 0.1–3.9 | Green  | Minimal risk, informational or defense-in-depth gap |
| ⚪ Info     | 0.0     | Grey   | No direct risk, best-practice recommendation        |

---

## 1. Dependency Vulnerabilities

### Current State: ✅ 0 vulnerabilities

```
$ npm audit
found 0 vulnerabilities (591 packages audited)
```

---

### VULN-001: esbuild Dev Server Cross-Origin Read

- [x] **Resolved** — 2026-02-10

| Field         | Value                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| **Advisory**  | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)          |
| **Severity**  | 🟡 Medium (CVSS 5.3)                                                              |
| **Package**   | `esbuild@0.18.20`                                                                 |
| **Dep Chain** | `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild` |
| **Type**      | Dev dependency only — NOT in production bundle                                    |

#### Description

The esbuild dev server allowed any website to send requests and read responses, enabling cross-origin data exfiltration when running `esbuild serve`. This affects local development environments where a malicious website could read files from the dev server.

#### Risk Assessment

- **Production Impact:** NONE — esbuild is a dev/build-time dependency, never deployed.
- **Dev Impact:** LOW — requires a developer to visit a malicious website while running `drizzle-kit studio`.
- **Exploitability:** Requires LAN access + social engineering. No known active exploitation.

#### Fix Applied

Added npm `overrides` in [package.json](file:///Users/camilopiedra/Documents/YNAB/ynab-app/package.json) to force all transitive `esbuild` instances to `>=0.25.0`:

```json
"overrides": {
  "esbuild": ">=0.25.0"
}
```

**Result:** Vulnerable `esbuild@0.18.20` replaced by `esbuild@0.27.3` (deduped). `npm audit` reports 0 vulnerabilities.

#### Affected Files

- [package.json](file:///Users/camilopiedra/Documents/YNAB/ynab-app/package.json) — `overrides` field added
- [package-lock.json](file:///Users/camilopiedra/Documents/YNAB/ynab-app/package-lock.json) — regenerated

#### Alternative Considered

| Option                      | Verdict     | Reason                                              |
| --------------------------- | ----------- | --------------------------------------------------- |
| Wait for drizzle-kit update | Rejected    | `@esbuild-kit/*` is deprecated (merged into `tsx`)  |
| Nested override (scoped)    | Rejected    | npm doesn't enforce scoped overrides on locked deps |
| **Flat override (global)**  | ✅ Accepted | Forces all esbuild to safe version, no side effects |

---

## 2. Authentication & Session Security

### 2.1 Password Security

- [x] **Bcrypt hashing** — passwords stored as bcrypt hashes via `bcryptjs`
- [x] **No plaintext passwords** — verified via grep, no `password` in logs or responses
- [x] **Zod validation** — login inputs validated with `LoginSchema` before DB query

| Control             | Implementation                      | File                                                                                    |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| Hash algorithm      | bcrypt (via `bcryptjs`)             | [auth.ts:63](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/auth.ts#L63)        |
| Input validation    | Zod `LoginSchema.safeParse()`       | [auth.ts:44](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/auth.ts#L44)        |
| Email normalization | `email.toLowerCase()` before lookup | [auth.ts:52](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/auth.ts#L52)        |
| Schema constraint   | `password: text().notNull()`        | [schema.ts:84](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/db/schema.ts#L84) |

### 2.2 Account Lockout (Brute Force Protection)

- [x] **5-attempt lockout** — DB-level, survives server restarts
- [x] **15-minute lockout window** — auto-unlock after expiry
- [x] **Counter reset on success** — failed attempts reset to 0 on valid login
- [x] **E2E tested** — see [security.spec.ts:49](file:///Users/camilopiedra/Documents/YNAB/ynab-app/tests/security.spec.ts#L49)

| Parameter             | Value           | File                                                                             |
| --------------------- | --------------- | -------------------------------------------------------------------------------- |
| `MAX_LOGIN_ATTEMPTS`  | 5               | [auth.ts:29](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/auth.ts#L29) |
| `LOCKOUT_DURATION_MS` | 900,000 (15min) | [auth.ts:31](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/auth.ts#L31) |

### 2.3 Session Management

- [x] **Auth.js v5** — JWT-based sessions with `AUTH_SECRET` signing
- [x] **Secret validation** — `AUTH_SECRET` requires `.min(32)` via Zod at startup
- [x] **Edge/Node split** — `auth.config.ts` (edge proxy) vs `auth.ts` (Node runtime)

> [!NOTE]
> Auth.js handles session token rotation, cookie security flags (`HttpOnly`, `Secure`, `SameSite`), and CSRF automatically.

---

## 3. Authorization & Multi-Tenancy

### 3.1 Budget Access Control

- [x] **All 14 budget API routes** use `withBudgetAccess()` wrapper
- [x] **Transaction-per-request** — all DB queries in a request share one connection
- [x] **Ownership verification** — checks user is owner OR has shared access
- [x] **Consistent error shape** — returns `apiError('Budget not found or access denied', 403)`

| Route                                                           | Guard Present         |
| --------------------------------------------------------------- | --------------------- |
| `budgets/route.ts` (GET, POST)                                  | ✅ `withUserContext`  |
| `budgets/[budgetId]/route.ts` (GET, PATCH, DELETE)              | ✅ `withBudgetAccess` |
| `budgets/[budgetId]/budget/route.ts`                            | ✅                    |
| `budgets/[budgetId]/accounts/route.ts`                          | ✅                    |
| `budgets/[budgetId]/accounts/[id]/route.ts`                     | ✅                    |
| `budgets/[budgetId]/accounts/[id]/reconciliation-info/route.ts` | ✅                    |
| `budgets/[budgetId]/categories/route.ts`                        | ✅                    |
| `budgets/[budgetId]/categories/reorder/route.ts`                | ✅                    |
| `budgets/[budgetId]/category-groups/route.ts`                   | ✅                    |
| `budgets/[budgetId]/import/route.ts`                            | ✅                    |
| `budgets/[budgetId]/payees/route.ts`                            | ✅                    |
| `budgets/[budgetId]/shares/route.ts`                            | ✅                    |
| `budgets/[budgetId]/shares/[shareId]/route.ts`                  | ✅                    |
| `budgets/[budgetId]/transactions/route.ts`                      | ✅                    |

#### Implementation

```
withBudgetAccess(budgetId, handler)
  └─ auth()                           → 401 if no session
  └─ validate budgetId                → 400 if invalid
  └─ db.transaction(tx =>
       ├─ set_config('app.user_id')   → RLS context (transaction-local)
       ├─ set_config('app.budget_id') → RLS context (transaction-local)
       ├─ verify ownership/share      → 403 if no access
       ├─ createDbFunctions(tx)       → transaction-scoped repos
       └─ handler(tenant, repos, tx)  → business logic
     )
```

**File:** [with-budget-access.ts](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/with-budget-access.ts)

### 3.2 Row-Level Security (Defense in Depth)

- [x] **PostgreSQL RLS** — `set_config('app.budget_id', ...)` set inside transactions
- [x] **NULLIF protection** — all policies handle empty strings from connection pooling
- [x] **Transaction-scoped** — `set_config(..., ..., true)` resets per-transaction
- [x] **Graceful degradation** — silently ignored in PGlite (unit tests)

#### RLS Policy Design

All policies use `NULLIF` to prevent empty-string-to-integer cast errors:

```sql
-- Applied via drizzle/0007_fix_rls_nullif.sql
CREATE POLICY accounts_budget_isolation ON accounts
  USING (budget_id = NULLIF(current_setting('app.budget_id', true), '')::int);
```

**Why NULLIF?** With connection pooling, `current_setting()` may return `''` instead of `NULL` if a previous request set the variable to empty string on the same pooled connection. `''::integer` crashes; `NULLIF('', '')` returns `NULL`, and `budget_id = NULL` evaluates to `FALSE` (safe deny).

> [!IMPORTANT]
> RLS is a **safety net**, not the primary defense. `withBudgetAccess()` is the enforcement layer — it verifies ownership AND sets RLS context inside a transaction. RLS prevents data leaks if a query accidentally omits the budget filter.

---

## 4. Injection Attacks

### 4.1 SQL Injection

- [x] **Parameterized queries** — all SQL via Drizzle ORM template literals
- [x] **No string interpolation** — verified via grep, 0 instances of raw SQL concatenation
- [x] **ID parsing** — `parseId()` validates all route params as positive integers

> [!NOTE]
> Drizzle ORM uses tagged template literals (`sql\`...\``) which automatically parameterize values. Manual `${value}`inside`sql`tags are safe — Drizzle converts them to`$1, $2, ...` bind parameters.

### 4.2 NoSQL Injection

Not applicable — application uses PostgreSQL exclusively.

---

## 5. Cross-Site Scripting (XSS)

### Defenses Active

- [x] **React auto-escaping** — JSX expressions are escaped by default
- [x] **CSP header** — `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- [x] **No `dangerouslySetInnerHTML`** — verified via grep, 0 instances

> [!WARNING]
> CSP allows `'unsafe-inline'` and `'unsafe-eval'` because Next.js requires them for hot-reload and CSS-in-JS. This is a known Next.js limitation. The risk is mitigated by React's auto-escaping and the absence of `dangerouslySetInnerHTML`.

---

## 6. Cross-Site Request Forgery (CSRF)

- [x] **Auth.js built-in CSRF** — token-based protection for all auth endpoints
- [x] **`SameSite` cookies** — Auth.js sets `SameSite=Lax` on session cookies
- [x] **E2E tested** — CSRF token flow validated in [security.spec.ts:62](file:///Users/camilopiedra/Documents/YNAB/ynab-app/tests/security.spec.ts#L62)

---

## 7. Security Headers

All headers configured in [next.config.ts](file:///Users/camilopiedra/Documents/YNAB/ynab-app/next.config.ts) and applied to all routes via `/(.*)`pattern.

| Header                      | Value                                                          | Purpose                       | Verified |
| --------------------------- | -------------------------------------------------------------- | ----------------------------- | -------- |
| `X-Content-Type-Options`    | `nosniff`                                                      | Prevent MIME sniffing         | ✅ E2E   |
| `X-Frame-Options`           | `DENY`                                                         | Prevent clickjacking          | ✅ E2E   |
| `X-XSS-Protection`          | `1; mode=block`                                                | Legacy XSS filter             | ✅ E2E   |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                              | Control referrer leakage      | ✅ E2E   |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Disable unused APIs           | ✅       |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`                 | Force HTTPS (2 years)         | ✅       |
| `Content-Security-Policy`   | See below                                                      | Resource loading restrictions | ✅       |

### CSP Directives

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

### CORS

- **Dev:** Same-origin only (no `CORS_ORIGIN` set)
- **Production:** Configurable via `CORS_ORIGIN` env var, restrict to specific domain

---

## 8. Rate Limiting & Abuse Prevention

### Implementation

In-memory sliding window counter in [rate-limit.ts](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/rate-limit.ts). Per-IP tracking with auto-cleanup.

| Tier   | Limit      | Routes Protected                         | File                                                                                                                                                                                                          |
| ------ | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth   | 5 req/min  | `/api/auth/*` (login, register)          | [auth route](file:///Users/camilopiedra/Documents/YNAB/ynab-app/app/api/auth/%5B...nextauth%5D/route.ts), [register route](file:///Users/camilopiedra/Documents/YNAB/ynab-app/app/api/auth/register/route.ts) |
| Import | 3 req/5min | `/api/budgets/[id]/import`               | [import route](file:///Users/camilopiedra/Documents/YNAB/ynab-app/app/api/budgets/%5BbudgetId%5D/import/route.ts)                                                                                             |
| API    | 60 req/min | General API (available, not yet applied) | —                                                                                                                                                                                                             |

### Test Coverage

- [x] **Unit tests** — `lib/__tests__/rate-limit.test.ts` (sliding window, cleanup, edge cases)
- [x] **E2E test** — `security.spec.ts` validates 429 response after limit exceeded

> [!NOTE]
> Rate limiter is **in-memory** — resets on server restart. For multi-instance (horizontal scaling), replace `MemoryStore` with Redis-backed store via the `RateLimitStore` interface.

---

## 9. Secrets & Environment Management

### Secret Handling

- [x] **No hardcoded secrets** — verified via grep (0 API keys, tokens, passwords in source)
- [x] **Zod validation at startup** — app crashes immediately if `AUTH_SECRET` is missing or < 32 chars
- [x] **`.env.example` up to date** — documents all required vars with generation instructions
- [x] **`.gitignore` covers `.env`** — verified, `.env` and `.env.local` are excluded

**Env schema:** [env.ts](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/env.ts)

| Variable       | Required | Validation                       | Sensitive |
| -------------- | -------- | -------------------------------- | --------- |
| `DATABASE_URL` | Yes      | `.string().url().min(1)`         | 🔴 Yes    |
| `AUTH_SECRET`  | Yes      | `.string().min(32)`              | 🔴 Yes    |
| `AUTH_URL`     | No       | `.string().url().optional()`     | No        |
| `NODE_ENV`     | No       | `.string().default('dev')`       | No        |
| `PORT`         | No       | `.coerce.number().default(3000)` | No        |
| `CORS_ORIGIN`  | No       | runtime only                     | No        |

---

## 10. Known Limitations & Future Work

### Open Items

- [ ] **SEC-FUTURE-001:** `apiLimiter` (60 req/min) is defined but **not applied** to standard budget CRUD routes. Currently only auth and import routes are rate-limited.
  - **Risk:** 🟢 Low — requires authenticated session, and DB queries are parameterized.
  - **Recommendation:** Apply `apiLimiter` to all budget API routes.

- [ ] **SEC-FUTURE-002:** CSP allows `'unsafe-inline'` and `'unsafe-eval'` for Next.js compatibility.
  - **Risk:** 🟡 Medium — weakens XSS protection via CSP bypass.
  - **Recommendation:** Migrate to nonce-based CSP when Next.js supports it natively. Track [Next.js RFC #16042](https://github.com/vercel/next.js/discussions/16042).

- [ ] **SEC-FUTURE-003:** Rate limiter uses in-memory store — resets on deploy/restart.
  - **Risk:** 🟢 Low — only matters for multi-instance deployments.
  - **Recommendation:** Swap `MemoryStore` for Redis when scaling horizontally. The `RateLimitStore` interface is already abstracted for this.

- [ ] **SEC-FUTURE-004:** No request body size limits on API routes.
  - **Risk:** 🟢 Low — Next.js has a default 1MB limit. Explicit limits would add defense in depth.
  - **Recommendation:** Add `bodyParser: { sizeLimit: '512kb' }` to route configs.

- [ ] **SEC-FUTURE-005:** No audit logging for sensitive operations (login, share changes, data import).
  - **Risk:** ⚪ Info — no compliance requirement yet.
  - **Recommendation:** Add structured audit trail when compliance requirements emerge.

---

## 11. Security Test Coverage

### E2E Security Tests

**File:** [security.spec.ts](file:///Users/camilopiedra/Documents/YNAB/ynab-app/tests/security.spec.ts)

| Test                                             | Validates                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `page responses include security headers`        | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy |
| `API responses include security headers`         | Security headers on `/api/*` routes                                        |
| `locks account after 5 failed login attempts`    | DB-level lockout with correct password rejection                           |
| `rate limiter returns 429 after exceeding limit` | In-memory rate limiting with proper 429 response                           |

### Unit Tests

| Module       | File                                                                                                      | Tests |
| ------------ | --------------------------------------------------------------------------------------------------------- | ----- |
| Rate Limiter | [rate-limit.test.ts](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/__tests__/rate-limit.test.ts) | 15+   |
| Auth helpers | Covered via E2E (DB-dependent)                                                                            | —     |

---

## 12. Audit Decision Log

Chronological record of every security decision — accepted risks, rejected fixes, and workarounds.

| Date       | ID        | Decision                                        | Rationale                                                                           |
| ---------- | --------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2026-02-10 | VULN-001  | ✅ Fixed: npm override for esbuild              | Flat override forces safe version; no side effects observed                         |
| 2026-02-10 | VULN-001  | ❌ Rejected: wait for drizzle-kit               | `@esbuild-kit/*` is deprecated, unlikely to release fix                             |
| 2026-02-10 | VULN-001  | ❌ Rejected: nested npm override                | npm doesn't enforce scoped overrides on locked transitive deps                      |
| 2026-02-10 | SEC-F-001 | ⏳ Deferred: API rate limiting on budget routes | Auth required; low risk without it. Will revisit on public API release              |
| 2026-02-10 | SEC-F-002 | ⏳ Accepted Risk: CSP unsafe-inline/eval        | Next.js requirement; mitigated by React auto-escaping                               |
| 2026-02-10 | SEC-F-003 | ⏳ Deferred: Redis rate limit store             | Single-instance deployment for now; `RateLimitStore` interface ready                |
| 2026-02-11 | RLS-001   | ✅ Fixed: Transaction-per-request for RLS       | All routes use `withBudgetAccess()` — `set_config` + queries share one connection   |
| 2026-02-11 | RLS-002   | ✅ Fixed: NULLIF in RLS policies                | `drizzle/0007_fix_rls_nullif.sql` — prevents `''::integer` cast errors from pooling |

---

## Appendix: How to Run Security Checks

```bash
# Dependency audit
npm audit

# Dependency tree for a specific package
npm ls <package-name>

# Anti-pattern scanner (custom)
bash .agent/skills/code-review/scripts/scan-antipatterns.sh --all

# E2E security tests
npm run test:e2e -- --grep "Security|Lockout|Rate Limiting"

# Full test suite (includes security)
npm run test:e2e
```
