# Good Commit Message Examples

Real-world examples tailored to the YNAB codebase.

## Simple Headers (No Body Needed)

```
feat(engine): add calculateCCPaymentAvailable function
```

```
fix(rta): exclude ghost entries from latest month selection
```

```
refactor(api): extract DTO mappers from route handlers
```

```
test(e2e): add CC payment flow test
```

```
docs(rules): add credit card RTA interaction rules
```

```
style(budget): fix indentation in budget table component
```

```
perf(db): add composite index on transactions(account_id, date)
```

```
chore: update .gitignore for .tmp directory
```

```
build: upgrade next.js to 15.1 with turbopack support
```

## With Body (Explaining Why)

```
fix(rta): correct carryforward for categories without budget_months row

Categories without a budget_months entry for the latest complete month
were returning available=0, losing all carried-forward value. Now falls
back to computeCarryforward() from the latest prior month.

Refs: #42
```

```
feat(hooks): add useDebouncedMutation wrapper for text inputs

Budget assignment inputs were firing a mutation on every keystroke,
causing race conditions and excessive server load. The wrapper debounces
at 400ms and provides a flush() for onBlur/Enter.
```

```
refactor(repo): split budget.ts into domain-specific repo modules

budget.ts grew to 800+ lines mixing RTA, CC payment, assignment, and
activity logic. Split into:
- rta.ts — Ready to Assign queries
- cc-payment.ts — credit card payment orchestration
- assignment.ts — budget assignment CRUD
- activity.ts — transaction activity aggregation
```

## With Breaking Change

```
feat(api)!: change budget response to include category groups

Migrate from flat category list to nested category groups structure.
This matches YNAB's data model more closely and simplifies UI rendering.

BREAKING CHANGE: GET /api/budgets/:id response shape changed.
Old: { categories: [...] }
New: { categoryGroups: [{ id, name, categories: [...] }] }
```

## Multi-Scope Feature (Single Logical Change)

```
feat(cc-payment): implement funded spending calculation

Add the full CC payment flow:
- Engine: calculateFundedAmount, calculateTotalFundedSpending
- Repo: updateCreditCardPaymentBudget orchestration
- Hook: optimistic update in useBudgetMutations

Per rule 05, all financial math lives in lib/engine/cc-payment.ts.
The repo layer queries data and delegates to engine functions.
```

## Agent and Scripting (DX)

```
feat(skills): add code-review skill with scan-antipatterns script

Provide a framework for comprehensive PR reviews. Includes:
- SKILL.md with checklist and architecture rules
- scripts/scan-antipatterns.sh to automate common rule checks
```

```
chore(dx): implement with-local-tmp.sh helper for macOS permission issues

Wrapper script to set TMPDIR=.tmp and ensure directory exists.
Prevents vitest/tsx failures due to /var/folders EPERM on macOS.
```

```
feat(workflows): add factory-reset and project-health-check

Enable one-command environment setup and QA smoke testing for developers.
```

## Revert

```
revert: revert "feat(auth): implement login with google"

This reverts commit abc1234def5678.
Reason: OAuth provider rate limiting causing login failures in prod.
Will re-implement with exponential backoff in a follow-up PR.
```
