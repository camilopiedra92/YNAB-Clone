# Scope Map — Directory to Conventional Scope

Use this table to determine the correct scope for a commit based on which files changed.

## Primary Scopes

| Directory / Pattern                                      | Scope         | Notes                                    |
| -------------------------------------------------------- | ------------- | ---------------------------------------- |
| `ynab-app/lib/engine/*.ts`                               | **engine**    | Pure financial calculation functions     |
| `ynab-app/lib/repos/*.ts`                                | **repo**      | Orchestration layer (query→engine→write) |
| `ynab-app/lib/dtos/*.ts`                                 | **dto**       | Data transfer object mappers             |
| `ynab-app/lib/db.ts`, `ynab-app/lib/db/*`                | **db**        | Database connection, raw SQL helpers     |
| `ynab-app/db/schema.ts`                                  | **schema**    | Drizzle schema definitions               |
| `ynab-app/db/migrations/*`                               | **db**        | Database migrations                      |
| `ynab-app/app/api/**/*.ts`                               | **api**       | API route handlers                       |
| `ynab-app/hooks/*.ts`                                    | **hooks**     | React Query hooks and mutations          |
| `ynab-app/components/*.tsx`                              | **ui**        | Reusable UI components                   |
| `ynab-app/app/**/page.tsx`, `ynab-app/app/**/layout.tsx` | **ui**        | Page and layout components               |
| `ynab-app/e2e/**/*.spec.ts`                              | **e2e**       | Playwright end-to-end tests              |
| `ynab-app/lib/__tests__/*.test.ts`                       | **test**      | Unit tests                               |
| `.agent/skills/*`                                        | **skills**    | Antigravity agent skills                 |
| `.agent/rules/*`                                         | **rules**     | Agent memory/rules                       |
| `.agent/workflows/*`                                     | **workflows** | Agent workflows                          |
| `ynab-app/scripts/*`, `scripts/*`                        | **scripts**   | Project utility scripts                  |
| `docs/*.md`                                              | **docs**      | Project documentation                    |
| `.github/workflows/*`                                    | **ci**        | GitHub Actions CI/CD workflows           |

## Common Special Scopes

| Category             | Scope             | Notes                                           |
| -------------------- | ----------------- | ----------------------------------------------- |
| Technical Audit      | **audit**         | Codebase assessments, quality reports           |
| Developer Experience | **dx**            | Improvements to tooling, scripts, environments  |
| Data Migration       | **migration**     | One-time scripts, schema migrations             |
| Multi-tenancy        | **multi-tenancy** | Changes spanning across tenant isolation layers |

## Feature-Based Scopes

When changes span multiple directories but belong to **one feature**, use the feature name:

| Feature Domain       | Scope            | Typical Files                                      |
| -------------------- | ---------------- | -------------------------------------------------- |
| Ready to Assign      | **rta**          | engine/rta.ts, repos/budget.ts, hooks/useBudget.ts |
| Credit Card Payments | **cc-payment**   | engine/cc-payment.ts, repos/budget.ts              |
| Budget Assignments   | **budget**       | engine/assignment.ts, repos/budget.ts, BudgetTable |
| Transactions         | **transactions** | repos/transactions.ts, hooks, TransactionTable     |
| Accounts             | **accounts**     | repos/accounts.ts, hooks, AccountSidebar           |
| Authentication       | **auth**         | app/api/auth/\*, middleware.ts, hooks/useAuth      |
| Overspending         | **overspending** | engine/overspending.ts, carryforward.ts            |
| Import/Export        | **import**       | Import-related components and API routes           |

## Decision Rules

1. **Root ynab-app prefix** → The prefix should be ignored when naming the scope (e.g., `ynab-app/hooks/` → `hooks`).
2. **Single directory** → use the primary scope from the table.
3. **Multiple directories, one feature** → use the feature scope.
4. **Root config files** (`next.config.ts`, `tsconfig.json`, `package.json`) → scope: omit or use `build`.
5. **Mixed test + implementation** → use the feature scope (tests support the feature).
6. **Only `.md` files** → scope: `docs` type, specific scope if targeted (e.g., `docs(rules)`).
7. **Unknown** → use the most specific scope that captures the change.
