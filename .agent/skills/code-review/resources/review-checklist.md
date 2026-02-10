# Code Review Checklist

Copy this checklist into your review report and check off each item.

## D1. Correctness

- [ ] Code implements the stated intent (PR description / ticket)
- [ ] Edge cases handled: empty arrays, zero values, null/undefined, negative amounts
- [ ] Async operations properly `await`ed (especially `await params` in Next.js 15)
- [ ] Early returns are correct and don't skip cleanup
- [ ] No off-by-one errors in loops, slices, or date ranges
- [ ] No floating-point arithmetic on monetary values (must use Milliunits)
- [ ] Conditional logic covers all branches (if/else, switch default)
- [ ] Error paths return appropriate HTTP status codes

## D2. Architecture Compliance

- [ ] No financial formulas outside `lib/engine/` (pure functions only)
- [ ] Engine functions have ZERO dependencies on DB, HTTP, React, env
- [ ] DB access only via `lib/repos/` (no inline SQL in routes or hooks)
- [ ] API responses use DTO transforms (no raw DB rows to client)
- [ ] New modules exported from barrel `index.ts` files
- [ ] Input/output types defined in `lib/engine/types.ts` for engine additions
- [ ] Repo functions follow query → engine → write pattern

## D3. Security

- [ ] Budget-scoped routes call `requireBudgetAccess(budgetId)` first
- [ ] Non-budget routes call `requireAuth()` first
- [ ] Write endpoints validate body with `validateBody()` + Zod schema
- [ ] Zod schemas use camelCase keys
- [ ] No passwords, tokens, or internal IDs leaked in responses
- [ ] `budgetId` used from `tenant.budgetId` (verified), not raw URL param
- [ ] No `dangerouslySetInnerHTML` or unescaped user input

## D4. Performance

- [ ] No N+1 queries (data fetched in batch, not in loops)
- [ ] `cancelQueries` called in `onMutate` before cache manipulation
- [ ] Balance/transaction queries use `AND date <= date('now')`
- [ ] React Query invalidation scopes are correct (not too broad/narrow)
- [ ] No unnecessary state in components (derived values not stored)
- [ ] Large lists use virtualization or pagination if applicable
- [ ] No synchronous heavy computation in render path

## D5. Financial Logic

- [ ] Monetary values use `Milliunit` branded type (never plain `number`)
- [ ] Production code uses `milliunit()` cast, test code uses `mu()` / `ZERO`
- [ ] Engine functions are pure: same input → same output, no side effects
- [ ] RTA formula terms correct: cash − available − futureAssigned − creditOverspending
- [ ] CC payment: funded spending correct, CC payments subtracted
- [ ] Carryforward: regular `max(0, prev)`, CC payment carries debt
- [ ] Ghost entry prevention: setting assigned=0 deletes row if all fields zero
- [ ] Overspending: credit (yellow) ≠ RTA impact; cash (red) → deducts next month
- [ ] `HAVING COUNT(*) >= 10` safety net in latest-month query

## D6. Testing

- [ ] New logic has unit tests in `lib/__tests__/`
- [ ] Bug fixes include a regression test that reproduces the original bug
- [ ] Engine functions have ≥100% branch coverage
- [ ] E2E tests updated if UI flows or selectors changed
- [ ] No skipped, disabled, or commented-out tests
- [ ] Test values use `mu()` / `ZERO` helpers, never `as Milliunit`
- [ ] Tests pass: `npm run test` and `npm run test:e2e`

## D7. Style & Conventions

- [ ] API payloads use camelCase; DB columns use snake_case
- [ ] Mutations have `mutationKey` and `meta` (errorMessage, successMessage)
- [ ] Optimistic updates use snapshot/rollback pattern (onMutate/onError/onSettled)
- [ ] No direct `toast()` calls in hooks — toasts via `meta`
- [ ] Text/numeric inputs use `useDebouncedMutation` (300-500ms)
- [ ] User-facing strings are in Spanish
- [ ] File naming follows conventions: `use*.ts`, `*.dto.ts`, `lib/repos/*.ts`
- [ ] `console.error` with context in catch blocks (never silent catches)

## D8. UX & Accessibility

- [ ] Every user-visible mutation has optimistic updates
- [ ] Loading states present (skeleton, spinner, or placeholder)
- [ ] Error states handled gracefully (not blank screens)
- [ ] Interactive elements have `data-testid` attributes
- [ ] Keyboard navigation: Enter submits, Escape cancels, Tab order logical
- [ ] Mobile/responsive behavior considered
- [ ] Animations/transitions are smooth (no layout shifts)
