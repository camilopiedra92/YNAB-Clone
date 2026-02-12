---
name: create-feature
description: End-to-end guide for adding a new feature across all architectural layers (schema → repo → schema → DTO → route → hook → component → tests)
---

# Skill: Create Feature (End-to-End)

Use this skill when adding a **new domain entity or CRUD feature** that spans the full stack. Each feature follows a predictable 8-layer pipeline. See `examples/` for annotated reference implementations of every layer.

## Architecture

```
DB Schema → Repo → Zod Schema → DTO → API Route → Hook → Component → Tests
```

## Steps

### 1. DB Schema — `lib/db/schema.ts`

Add a new `pgTable` definition. See [examples/schema.ts](examples/schema.ts) for the pattern.

Then generate and apply the migration:

```bash
npm run db:generate
npm run db:migrate
```

### 2. Repo — `lib/repos/<domain>.ts`

Create a factory function: `createXFunctions(database: DrizzleDB)`. See [examples/repo.ts](examples/repo.ts).

Wire it in:

- Import in `lib/repos/client.ts` → add to `createDbFunctions()` return
- Export individual functions from `lib/repos/index.ts` barrel

### 3. Zod Schema — `lib/schemas/<domain>.ts`

Create validation schemas for API input. See [examples/schema.zod.ts](examples/schema.zod.ts).

Export from `lib/schemas/index.ts` barrel.

### 4. DTO — `lib/dtos/<domain>.dto.ts`

Create Row interface, DTO interface, and mapper function. See [examples/dto.ts](examples/dto.ts).

Export from `lib/dtos/index.ts` barrel.

### 5. API Route — `app/api/budgets/[budgetId]/<domain>/route.ts`

Create route handlers following the auth → validate → repo → DTO → respond pattern. See [examples/route.ts](examples/route.ts).

### 6. Hook — `hooks/use<Domain>.ts`

Create useQuery + useMutation hooks with optimistic updates. See [examples/hook.ts](examples/hook.ts).

### 7. Unit Test — `lib/__tests__/<domain>.test.ts`

Create tests using PGlite in-process DB. See [examples/unit-test.ts](examples/unit-test.ts).

### 8. Verify

```bash
npm run typecheck
npm run test
npm run lint
```

## Checklist

- [ ] `lib/db/schema.ts` — table defined
- [ ] `drizzle/` — migration generated and applied
- [ ] `lib/repos/<domain>.ts` — factory function
- [ ] `lib/repos/client.ts` — wired into `createDbFunctions`
- [ ] `lib/repos/index.ts` — barrel export
- [ ] `lib/schemas/<domain>.ts` — Zod schemas
- [ ] `lib/schemas/index.ts` — barrel export
- [ ] `lib/dtos/<domain>.dto.ts` — DTO + mapper
- [ ] `lib/dtos/index.ts` — barrel export
- [ ] `app/api/budgets/[budgetId]/<domain>/route.ts` — API route
- [ ] `hooks/use<Domain>.ts` — query + mutation hooks
- [ ] `lib/__tests__/<domain>.test.ts` — unit test
- [ ] All checks pass: `typecheck`, `test`, `lint`

## Key Rules

- **Monetary values** → `Milliunit` branded type (rule `05`)
- **API routes** → `withBudgetAccess()` wrapper (rule `11`, `12`)
- **Mutations** → optimistic updates with snapshot/rollback (rule `06`)
- **No inline SQL** in routes → use repo functions
- **No raw rows** in responses → use DTO mappers
- **Toasts** → via `meta` on mutations, not direct `toast()` calls

## Examples Directory

| File                                    | Layer                      |
| --------------------------------------- | -------------------------- |
| [schema.ts](examples/schema.ts)         | DB table definition        |
| [repo.ts](examples/repo.ts)             | Repository factory pattern |
| [schema.zod.ts](examples/schema.zod.ts) | Zod validation schemas     |
| [dto.ts](examples/dto.ts)               | Row → DTO mapper           |
| [route.ts](examples/route.ts)           | API route (GET/POST)       |
| [hook.ts](examples/hook.ts)             | useQuery + useMutation     |
| [unit-test.ts](examples/unit-test.ts)   | PGlite unit test           |
