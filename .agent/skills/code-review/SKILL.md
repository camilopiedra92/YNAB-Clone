---
name: code-review
description: Comprehensive code review framework for pull requests and ad-hoc quality checks. Covers correctness, architecture compliance, security, performance, financial logic, testing, and style. Use when reviewing PRs, auditing changes, or checking code quality before merge.
---

# Skill: Code Review

Use this skill when **reviewing a PR, auditing recent changes, or checking code quality** before merge. The review covers 8 dimensions and produces a structured report.

## Workflow

### 1. Gather the Diff

Determine what changed. Use one of:

```bash
git diff main..HEAD --stat           # file list
git diff main..HEAD                   # full diff
git log --oneline main..HEAD          # commit messages
```

For ad-hoc reviews, the user may point to specific files instead.

### 2. Run Automated Checks

Before any manual review, run the project's automated gatekeepers:

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test          # Vitest unit tests
npm run build         # Next.js production build
```

If any fail, note them as **P0** findings — blocking issues that must be fixed.

### 3. Manual Review — 8 Dimensions

Walk through every changed file and evaluate against the checklist in [resources/review-checklist.md](resources/review-checklist.md). The 8 dimensions are:

| #   | Dimension                   | Key Question                                                         |
| --- | --------------------------- | -------------------------------------------------------------------- |
| 1   | **Correctness**             | Does the code do what it claims? Are edge cases handled?             |
| 2   | **Architecture Compliance** | Does it follow the 3-layer pattern (engine → repo → UI)?             |
| 3   | **Security**                | Auth checks present? Inputs validated? No data leaks?                |
| 4   | **Performance**             | Obvious N+1 queries? Missing indexes? Unnecessary re-renders?        |
| 5   | **Financial Logic**         | Milliunits correct? Engine purity preserved? RTA invariants hold?    |
| 6   | **Testing**                 | New logic has tests? Coverage maintained? Regression tests for bugs? |
| 7   | **Style & Conventions**     | Naming, DTO transforms, camelCase API, Spanish UI strings?           |
| 8   | **UX & Accessibility**      | Optimistic updates? Loading/error states? Keyboard navigation?       |

### 4. Produce the Report

Structure findings using the template in [resources/report-template.md](resources/report-template.md). Classify each finding:

| Severity | Meaning                                      | Blocks Merge? |
| -------- | -------------------------------------------- | ------------- |
| **P0**   | Bug, security flaw, data corruption risk     | ✅ Yes        |
| **P1**   | Architecture violation, missing test, debt   | ✅ Yes        |
| **P2**   | Style nit, minor performance, readability    | ❌ No         |
| **P3**   | Suggestion, future improvement, nice-to-have | ❌ No         |

### 5. Run the Diagnostic Script (Optional)

For a quick automated scan of common anti-patterns:

```bash
# View usage
bash .agent/skills/code-review/scripts/scan-antipatterns.sh --help

# Scan all changed files vs main
bash .agent/skills/code-review/scripts/scan-antipatterns.sh
```

The script checks for inline financial math, raw `fetch()` in components, missing `withBudgetAccess()`, `toast()` in hooks, and more.

## Dimension Details

### D1. Correctness

- Does the code actually implement the stated intent?
- Are there **off-by-one** errors, **null/undefined** derefs, or **type coercion** traps?
- Are async operations properly **awaited**? (Common: `await params` in Next.js 15)
- Are **early returns** correct? (`if (!access.ok) return access.response`)
- Edge cases: empty arrays, zero values, negative amounts, `null` category IDs (transfers)

### D2. Architecture Compliance (Rules 05, 11)

- **Engine boundary:** No financial math outside `lib/engine/`. See rule `05`.
- **3-layer pattern:** Engine (pure) → Repo (orchestration) → Hook/Route (consumer)
- **No inline SQL in routes:** All DB access via `lib/repos/`
- **No raw DB rows in responses:** Always use DTO mappers from `lib/dtos/`
- **Barrel exports:** New modules exported from their `index.ts`

### D3. Security (Rule 12)

- **Every budget-scoped route** uses `withBudgetAccess(budgetId, handler)`
- **Every non-budget route** calls `requireAuth()`
- **Input validation:** All write endpoints use `validateBody()` with Zod schemas
- **No credential leaks:** No passwords, tokens, or internal IDs in responses
- **`await params`** in Next.js route handlers (not direct access)
- **RLS session vars** set via `withBudgetAccess()` (transaction-scoped)

### D4. Performance

- **N+1 queries:** Is data fetched in a loop instead of a batch query?
- **Missing `cancelQueries`** in `onMutate` can cause stale refetch races
- **Unnecessary re-renders:** Large objects in context, unstable references
- **Future date filter:** Balance queries MUST use `AND date <= date('now')` (rule `02` §4D)
- **React Query keys:** Are invalidation scopes too broad or too narrow?

### D5. Financial Logic (Rules 02, 03, 04, 05, 07)

- **Milliunit types:** All monetary values use `Milliunit` branded type, never plain `number`
- **Test helpers:** Tests use `mu()` and `ZERO`, never `as Milliunit`
- **Engine purity:** Engine functions have ZERO dependencies on DB/HTTP/React
- **RTA formula:** Cash − Available − FutureAssigned − CreditOverspending
- **CC Payment:** Funded spending calculation correct? Payments subtracted?
- **Carryforward:** Regular categories `max(0, prev)`, CC payment categories carry debt
- **Ghost entries:** Assignment of 0 deletes the `budget_months` row, not creates one
- **Overspending:** Credit (yellow) never reduces RTA; cash (red) deducts next month

### D6. Testing (Rule 08)

- **New logic has unit tests** in `lib/__tests__/`
- **Bug fixes include regression test** that reproduces the bug
- **Engine coverage:** 100% branch coverage target
- **E2E tests** updated if UI flows changed
- **No skipped, disabled, or commented-out tests**
- **Test helpers:** `mu()`, `ZERO` from `./test-helpers` (not manual casts)

### D7. Style & Conventions (Rules 00, 06, 09)

- **API payloads:** camelCase (Zod schemas), DB columns: snake_case
- **Mutation hooks:** Have `mutationKey`, `meta`, optimistic updates with snapshot/rollback
- **No direct `toast()`** in mutation hooks — use `meta.errorMessage`
- **Debounced inputs:** Text/numeric fields use `useDebouncedMutation`
- **UI language:** Spanish for user-facing strings
- **File naming:** `use*.ts` for hooks, `*.dto.ts` for DTOs, `lib/repos/*.ts` for repos
- **Schema changes:** `schema.ts` → `db:generate` → `db:migrate` (rule `09`)

### D8. UX & Accessibility

- **Optimistic updates** for every user-visible mutation
- **Loading states:** Skeleton/spinner while data fetches
- **Error states:** Graceful degradation, not blank screens
- **`data-testid`** on interactive elements (for E2E)
- **Keyboard navigation:** Focus management, Enter to submit, Escape to cancel

## Key Rules Reference

| Rule File                             | Scope                          |
| ------------------------------------- | ------------------------------ |
| `00-tech-stack-and-goals.md`          | Stack, zero-regression policy  |
| `04-logic-invariants.md`              | Zero-based budgeting, envelope |
| `05-financial-engine-architecture.md` | Engine boundary, Milliunit     |
| `06-frontend-mutation-patterns.md`    | Mutations, optimistic, toasts  |
| `08-test-after-changes.md`            | Testing standards              |
| `09-database-schema-management.md`    | Drizzle migrations             |
| `11-api-route-patterns.md`            | Route handler structure        |
| `12-auth-and-security.md`             | Auth, RLS, rate limiting       |
| `13-error-handling.md`                | Error conventions              |

## Resources & Scripts

| File                                                           | Purpose                           |
| -------------------------------------------------------------- | --------------------------------- |
| [resources/review-checklist.md](resources/review-checklist.md) | Copyable per-dimension checklist  |
| [resources/report-template.md](resources/report-template.md)   | Structured review report template |
| [scripts/scan-antipatterns.sh](scripts/scan-antipatterns.sh)   | Automated anti-pattern scanner    |
