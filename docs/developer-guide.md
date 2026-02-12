# Developer Guide

This guide provides instructions for setting up the development environment and managing the YNAB Clone application.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher.
- **npm / yarn**: For dependency management.

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

To start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Database Management

The application uses a **PostgreSQL** database. Connection details are defined in the `.env` file via `DATABASE_URL`.

### Resetting the Database

If you need a clean start with fresh test data, use the reset workflow:

```bash
/reset-db
```

This script will clear all existing data in the database and re-import the standard YNAB export data for testing.

### Manual Schema Initialization

When you start the application (`npm run dev` or `npm start`), it will automatically apply any pending Drizzle schema migrations.

## Monetary Values & Milliunits (Strict Typing)

We use a **branded type** called `Milliunit` for all monetary values to prevent accidental mixing of currency amounts with other numbers (counters, IDs, percentages).

- **Type**: `Milliunit` (branded `number` type)
- **Unit**: 1/1000th of a currency unit (e.g., $1.00 = 1000 milliunits).

### Usage in Production Code

ALWAYS cast raw numbers or SQL results to `Milliunit` using the `milliunit()` helper from `lib/engine/primitives`.

```typescript
import { milliunit } from "@/lib/engine/primitives";

// ✅ CORRECT
const amount = milliunit(5000); // 5.00
const total = milliunit(row.balance);

// ❌ INCORRECT (TypeScript Error)
const amount: Milliunit = 5000;
```

### Usage in Tests

Do NOT manually cast every number. Use the standardized test helpers:

1.  **Imports**:
    ```typescript
    import { mu, ZERO } from "./test-helpers";
    ```
2.  **Helpers**:
    - `mu(n)`: Shorthand for `n as Milliunit`. Use for literals like `mu(500)`.
    - `ZERO`: Constant for `0 as Milliunit`. Use for default values.

```typescript
// Example Test
await fns.updateBudgetAssignment(categoryId, month, mu(500));
await db.insert(budgetMonths).values({
  assigned: ZERO,
  activity: mu(-100),
  available: mu(-100),
});
```

**Why?** This enforces strict type safety at the compile level. If you pass a plain number to a function expecting money, the build will fail.

## Agent Workflows

The project includes specialized workflows for common tasks:

- **`/start`**: Installs dependencies and launches the Next.js dev server.
- **`/cleanup`**: Stops all running application processes.
- **`/reset-db`**: Performs a full database reset and data re-import.

## Directory Structure

- `/app`: Next.js App Router pages and API routes.
- `/components`: Shared React components.
- `/components/budget`: Budget-specific components (rows, inspector, etc.).
- `/hooks`: Custom React hooks for data fetching and state.
- `/lib`: Server-side libraries.
  - `/lib/repos`: Repository pattern — database queries + orchestration.
  - `/lib/engine`: Pure financial logic (zero DB dependencies).
  - `/lib/db`: Drizzle schema + SQL helpers.
  - `/lib/dtos`: API contract mappers.
  - `/lib/with-budget-access.ts`: Transaction-per-request wrapper for all budget API routes.
- `/drizzle`: Auto-generated Drizzle migrations.
- `/scripts`: Utility scripts for data migration and debugging.
- `/docs`: Project documentation.

## Git Hooks (Local Quality Gates)

Git hooks run automatically to catch issues before they reach CI:

| Hook         | Trigger            | What it runs                                   | ~Time  |
| ------------ | ------------------ | ---------------------------------------------- | ------ |
| `pre-commit` | Every `git commit` | ESLint (staged files) + TypeScript typecheck   | ~5–8s  |
| `pre-push`   | Every `git push`   | Branch protection (blocks `main`) + Unit tests | ~5–10s |

Hooks are installed automatically on `npm install` (via the `prepare` script). To manually reinstall:

```bash
npm run git:install-hooks
```

**Bypass** (emergencies only):

```bash
git commit --no-verify    # skip pre-commit
git push --no-verify      # skip pre-push
SKIP_HOOKS=1 git commit   # alternative via env var
```

## Testing & Debugging

- **Debugging RTA**: Use `scripts/debug-rta.ts` to inspect the calculations for "Ready to Assign".
- **Logs**: API request and database query errors are logged to the console during development.
