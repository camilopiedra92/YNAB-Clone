---
description: Standard workflow for database schema changes using Drizzle ORM
---

# Database Schema Management

We use **Drizzle ORM** with **PostgreSQL** to manage the database schema. This file defines the strict workflow for making schema changes.

## 1. The Golden Rule

**NEVER** modify the database manually. The `lib/db/schema.ts` file is the **ONLY** source of truth for the database structure.

## 2. Schema Change Workflow

To add tables, modify columns, or change relationships:

### Step 1: Modify Schema Definition

Edit `lib/db/schema.ts`. Define tables using Drizzle's PostgreSQL builder (`pgTable`).

```typescript
// Example: lib/db/schema.ts (PostgreSQL)
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { money } from "./helpers"; // Custom helper for Milliunits

export const newTable = pgTable("new_table", {
  id: serial("id").primaryKey(),
  balance: money("balance").notNull().default(0),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Step 2: Generate Migration

Run the generator to create a SQL migration file based on your changes.

```bash
npm run db:generate
```

_Output: `drizzle/00xx_migration_name.sql`_

### Step 3: Apply Migration (Migrate)

Apply the generated SQL to the local database.

```bash
# Runs migrate-db.ts script
npm run db:migrate
```

### Step 4: Verify

Inspect the database using Drizzle Studio (optional but recommended for complex changes).

```bash
npm run db:studio
```

## 3. Atomic Transactions

**ALL** multi-write operations must be wrapped in a transaction to ensure data integrity.

```typescript
import { db } from '@/lib/repos/client';

await db.transaction(async (tx) => {
  await tx.insert(users).values({...});
  await tx.insert(accounts).values({...});
  // If any error occurs here, BOTH inserts are rolled back.
});
```

## 4. Type Safety & Queries

- **Repository Pattern:** Do not use `db` directly in API routes. Use function exports from `lib/repos/`.
- **Numeric Coercion (CRITICAL):** PostgreSQL `bigint` columns return **STRINGS** when using `sql` template queries. The `money()` custom type in the schema handles this automatically for ORM lookups. For raw SQL, always wrap output in `Number()`. All monetary values are **Milliunits** (integer × 1000).
- **Branded Types:** Use `Milliunit` type from `lib/engine/primitives.ts` for all money variables.

## 5. Seeds & Test Data

- **Import Generic Data:** Use `scripts/import-ynab-data.ts` (see workflows).
- **Test Database Isolation:** E2E tests run against an isolated **`ynab_test`** database. The `tests/global-setup.ts` script automatically recreates the database, runs migrations, and **re-seeds it from the canonical CSV data** before tests run. This ensures deterministic results.
- **Unit Testing:** Unit tests use **PGlite** (in-process) which is completely isolated and resets for every test.
