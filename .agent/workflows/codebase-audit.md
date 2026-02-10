---
description: Full architectural audit of the codebase — find tech debt, anti-patterns, hardcoded values, workarounds, and architecture violations. Produces a prioritized implementation plan.
---

# Codebase Audit: World-Class Architecture Assessment

Act as a **world-class software architect**. Exhaustively audit the entire codebase for technical debt, workarounds, hardcoded values, anti-patterns, and architecture violations. Produce a **versioned audit report** — do NOT implement changes.

### Versioned Output

1. Create `docs/audits/` if missing. Name file: `audit-YYYY-MM-DD.md` (today's date). If exists, append `-2`.
2. Compare with most recent previous audit: ✅ fixed, 🔴 regressed, ⚠️ new findings, 📊 metrics trend.
3. Update `docs/audits/README.md` index (create if missing) with date, score, finding counts, one-line summary. Most recent row first.
4. Never overwrite previous audits — they are the permanent health record.

---

## Phase 1 — Automated Checks

Run and record pass/fail + all warnings:

```bash
npm run lint && npm run typecheck && NEXT_TEST_BUILD=1 NODE_ENV=production npm run build && npm run test:coverage && npm run test:e2e
```

## Phase 2 — Anti-Pattern Scan

```bash
bash .agent/skills/code-review/scripts/scan-antipatterns.sh
```

## Phase 3 — Layer-by-Layer Review

### 3.1 Engine (`lib/engine/`)

- [ ] Pure functions only (zero DB/HTTP/React/env deps), `Milliunit` branded types everywhere
- [ ] Types in `types.ts`, exports via `index.ts`, 100% branch coverage

### 3.2 Repos (`lib/repos/`)

- [ ] query→engine→write pattern, no inline math, `AND date <= date('now')` on all date queries
- [ ] No N+1, parameterized SQL only, ghost entry prevention, carryforward on inserts

### 3.3 API Routes (`app/api/`)

- [ ] `requireBudgetAccess`/`requireAuth` first, `validateBody()` + Zod on writes, `await params`
- [ ] `apiError()` helper, DTO transforms (no raw rows), correct HTTP status codes, no inline DB

### 3.4 Schemas & DTOs (`lib/schemas/`, `lib/dtos/`)

- [ ] camelCase API / snake_case DB, DTO mappers for all responses, no `any`, no duplication

### 3.5 Hooks (`hooks/`)

- [ ] `useMutation` only (no raw fetch), `mutationKey` + `meta`, snapshot/rollback optimistic updates
- [ ] `cancelQueries`→`onMutate`, `invalidateQueries`→`onSettled`, cross-domain invalidation
- [ ] No `toast()` (use meta), debounced inputs, engine imports for financial math, `useQuery` for reads

### 3.6 Components (`components/`)

- [ ] No business logic, `data-testid` on interactives, loading/error states, keyboard nav
- [ ] Responsive, ARIA labels, no hardcoded colors/strings, Spanish UI strings

### 3.7 Database (`drizzle/`)

- [ ] `schema.ts`→`db:generate`→`db:migrate`, indexes on hot columns, FKs defined, no magic strings

### 3.8 Config & Environment

- [ ] No hardcoded secrets, `.env.example` current, portable scripts, `NODE_ENV` not in `.env`

## Phase 4 — Cross-Cutting Concerns

### 4.1 Tech Debt

- [ ] TODO/FIXME/HACK comments, `@ts-ignore`/`eslint-disable`, `as any`, dead/commented code, duplication, magic numbers

### 4.2 Error Handling

- [ ] No silent catches, contextual error messages, React error boundaries, consistent API error format

### 4.3 Performance

- [ ] No unnecessary re-renders, memoize expensive computations, bounded queries (LIMIT), indexes, tree-shaking

### 4.4 Security

- [ ] Rate limiting on auth endpoints, CSRF, input sanitization, session security, strong hashing, no stack traces leaked

### 4.5 Testing

- [ ] No untested files, no flaky tests, test isolation, regression tests for bugs, E2E covers critical flows

## Phase 5 — Dependencies

```bash
npm audit --audit-level=moderate && npm outdated && npx -y depcheck --ignores="@types/*,eslint-*,prettier,typescript,postcss,autoprefixer,tailwindcss" && npx -y license-checker --summary
```

- [ ] No high vulnerabilities, no unused/phantom deps, permissive licenses only (MIT/BSD/Apache/ISC)

## Phase 6 — Bundle & Performance

```bash
du -sh .next/static 2>/dev/null || du -sh .next-test/static
```

- [ ] No server code in client bundles, no heavy full-library imports, route-level code splitting
- [ ] Lazy-load heavy components/modals, `next/image` not raw `<img>`, `next/font` for fonts
- [ ] `useMemo`/`useCallback` where warranted, CSS animations use `transform`/`opacity`

## Phase 7 — Race Conditions & Concurrency

- [ ] `useEffect` cleanup cancels async ops, no stale closures, `AbortController` for fetch
- [ ] Optimistic updates: cancel→snapshot→mutate→rollback ordering correct, no double-submit
- [ ] Server: read-then-write uses transactions, bulk ops atomic, handlers idempotent
- [ ] Debounced mutations flush on blur/Enter, don't fire after unmount

## Phase 8 — Memory Leaks

- [ ] Effects return cleanup (listeners, intervals, observers, subscriptions)
- [ ] No module-level growing arrays/maps, no `setState` after unmount
- [ ] Server: DB connections pooled, streams closed, rate limiter cleanup, bounded caches

## Phase 9 — Documentation

- [ ] README current (setup, arch, testing), `.env.example` complete, CHANGELOG maintained
- [ ] JSDoc on public engine functions, SQL comments on complex queries, business rule doc refs
- [ ] **Rules vs Reality:** cross-check all `.agent/rules/*.md` against actual code — flag drift
- [ ] All common dev tasks have workflows, workflows are current

## Phase 10 — Complexity

```bash
find . -name '*.ts' -o -name '*.tsx' | grep -v node_modules | grep -v .next | grep -v .test. | xargs wc -l | sort -rn | head -30
npx -y madge --circular --extensions ts,tsx lib/ hooks/ components/ app/ 2>/dev/null
```

- [ ] No file >500 lines, no function >50 lines, no >4 nesting levels, no >5 params (use object)
- [ ] No circular deps, clear dep direction (components→hooks→repos→engine), no god files

## Phase 11 — Consistency

- [ ] Files: consistent casing. Components: PascalCase. Hooks: `use*`. DTOs: `*.dto.ts`. Repos: `lib/repos/*`
- [ ] All routes same structure (auth→validate→execute→respond), all mutations same pattern
- [ ] Import ordering consistent, no orphan files, no mixed server/client in same dir
- [ ] UI: consistent colors/spacing/typography/buttons/modals/tables/empty states

## Phase 12 — Grep Hunts

```bash
rg --pcre2 'localhost|127\.0\.0\.1|:3000|:5432' --glob '!*.md' --glob '!.env*' --glob '!next.config*' --glob '!playwright*' --glob '!package.json' --glob '!*.lock'
rg 'as any|@ts-ignore|@ts-expect-error' --glob '*.ts' --glob '*.tsx' --glob '!*.test.*'
rg 'TODO|FIXME|HACK|WORKAROUND|XXX' --glob '*.ts' --glob '*.tsx'
rg 'console\.(log|warn|info|debug)' --glob '*.ts' --glob '*.tsx' --glob '!*.test.*' --glob '!scripts/*'
rg "fetch\(" --glob 'components/**/*.ts' --glob 'components/**/*.tsx' --glob 'hooks/**/*.ts'
rg 'eslint-disable' --glob '*.ts' --glob '*.tsx'
rg '^\s*//\s*(import|const|let|var|function|return|if|for|while|export|await|try)' --glob '*.ts' --glob '*.tsx' --glob '!*.test.*'
rg 'NextResponse.json.*error' --glob 'app/api/**/*.ts' | grep -v 'apiError'
rg '\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)' --pcre2 --glob 'lib/**/*.ts'
```

## Phase 13 — Write Versioned Report

Save to `docs/audits/audit-YYYY-MM-DD.md`:

```markdown
# Codebase Audit — YYYY-MM-DD

> Generated: YYYY-MM-DD HH:MM | Previous: [link or "First audit"]

## Executive Summary

**Overall Health Score: X/10** — [top-5 findings, strategic recommendations]

## Delta from Previous Audit (skip if first)

### ✅ Fixed | 🔴 Regressions | ⚠️ New Findings

| Metric | Previous | Current | Trend |

## Metrics Dashboard

| Metric | Value | Target | Status | (18 metrics: lint, types, build, coverage, vulns, as-any, todos, eslint-disable, outdated deps, circular deps, file size, unused deps, console.log, commented code...)

## Findings by Severity (P0→P3)

## Findings by Layer (Engine, Repos, API, Frontend, Schema, Config, Deps)

## Proposed Fix Order (S/M/L effort per fix)

## Architecture Health Score (12 dimensions, 1-10 each with justification)
```

Update `docs/audits/README.md` index: `| Date | Score | P0 | P1 | P2 | P3 | Total | Summary |`

### Rules for Findings

1. **Specific:** file path + line number + code snippet
2. **Why:** impact explanation
3. **Fix:** concrete change (not "improve this")
4. **Effort:** S (<30min), M (1-3h), L (half day+)
5. **No false positives** — skip intentional patterns
6. **Reference rules** (e.g., "Violates Rule 05 §3")
7. **Group related** — same issue in N files = 1 finding with file list

> **Do NOT implement changes.** Deliver the versioned audit report for review.
