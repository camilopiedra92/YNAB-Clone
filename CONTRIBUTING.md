# Contributing Guide

Welcome to the YNAB Clone project. To maintain high architectural standards and data integrity, please follow these strict protocols.

## 🛑 The Golden Rule: Commit Protocol

**NEVER** run `git commit` or `git push` manually.

We use a unified synchronization script that handles linting, type-checking, testing, and commit message formatting in one atomic operation.

```bash
# Sincronizar cambios (Stage + Validate + Commit + Push)
npm run git:sync -- "type(scope): message"
```

If the script fails, **FIX THE ERRORS**. Do not bypass the hooks.

## 🏗 Architectural Pillars

### 1. Financial Engine (Pure Logic) - `lib/engine/`

All financial math (RTA, currency conversion, overspending) lives here as **pure functions**. logic is **never** implemented in UI components or API routes.

- 📖 [Read more about the Engine](./docs/architecture.md)

### 2. Database Integrity

We enforce strict data validity. "Ghost entries" (0-value rows in `budget_months`) can corrupt the Ready to Assign calculation.

**Run the audit script before major releases:**

```bash
npm run db:audit
```

### 3. Branching Strategy

- `main`: **PROTECTED**. Production-ready code only. No direct pushes.
- `staging`: Integration branch. Deployments happen here.
- `feat/*`: Feature branches.

**Workflow:**

1. Create `feat/my-feature` from `staging`.
2. Work and commit using `npm run git:sync`.
3. Push to `staging` (via PR or direct push if trivial).
4. **Create PR from `staging` to `main`** to release.

## 📚 Documentation Map

- **[RTA Logic](./docs/business-rules.md)**: How the "Ready to Assign" number is calculated.
- **[Audits](./docs/audits/)**: History of architectural audits.
