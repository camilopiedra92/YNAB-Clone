---
description: Mandatory tech stack and project goals.
---

# Tech Stack & Project Goals

This file defines the **MANDATORY** technology stack and high-level goals for the project. Deviating from this stack requires explicit user approval and a compelling reason.

## 1. Core Technology Stack

| Layer          | Technology     | Version | Notes                                                               |
| :------------- | :------------- | :------ | :------------------------------------------------------------------ |
| **Framework**  | Next.js        | 16.1.6  | App Router, Server Actions/API Routes                               |
| **Language**   | TypeScript     | 5+      | Strict mode enabled                                                 |
| **UI Library** | React          | 19.2.3  | Server Components (RSC) where possible                              |
| **Styling**    | Tailwind CSS   | 4.x     | Utility-first, strict tokens                                        |
| **Database**   | PostgreSQL     | 16+     | via `postgres` driver. **MUST** use `bigint` (Milliunits) for money |
| **ORM**        | Drizzle ORM    | Latest  | Schema-as-code, type-safe queries                                   |
| **State**      | TanStack Query | v5      | Caching, optimistic updates                                         |
| **Icons**      | Lucide React   | Latest  | Consistent icon set                                                 |
| **Validation** | Zod            | Latest  | Runtime schema validation                                           |

## 2. Testing Stack

| Type                 | Tool       | Command            |
| :------------------- | :--------- | :----------------- |
| **Unit/Integration** | Vitest     | `npm run test`     |
| **End-to-End (E2E)** | Playwright | `npm run test:e2e` |

## 2b. DevOps & CLI Tools

| Tool         | Purpose                                     | Install                |
| :----------- | :------------------------------------------ | :--------------------- |
| **gh** (CLI) | PR creation, CI status, merge from terminal | `brew install gh`      |
| **git**      | Version control                             | Pre-installed on macOS |

`gh` is authenticated as `camilopiedra92`. See `15-git-branching-strategy.md` §7 for usage.

## 3. High-Level Goals

### A. "Zero Regressions"

- Existing functionality must logically **NEVER** break.
- Tests (Unit & E2E) must match or exceed current coverage before any merge/commit.
- **Verification:** Mandatory "7-layer" QA suite (Environment, Security, Lint, Types, Build, Unit, E2E).

### B. Single Source of Truth

- **Financial Logic:** Lives ONLY in `lib/engine/`.
- **Database Schema:** Lives ONLY in `lib/db/schema.ts`.
- **API Contract:** Defined by Zod schemas in `lib/schemas/`.

### C. Type Safety

- **Full Stack Types:** DTOs (Data Transfer Objects) must share types between Frontend and Backend.
- **CamelCase:** JSON APIs must use `camelCase` for keys (enforced by Zod). Database uses `snake_case`.

### D. Performance

- **Optimistic Updates:** all user actions must feel instant. Use React Query `onMutate` with **pure calculations from the financial engine** (`lib/engine/`) to ensure exact optimistic results.
- **Offline First:** Mutations queue when offline (via `mutation-queue` pattern).
