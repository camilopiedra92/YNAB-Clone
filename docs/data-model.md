# Data Engineering & Schema Specification

This document provides a deep-dive into the PostgreSQL schema designed for high-performance financial tracking and integrity.

## 🏛 Database Blueprint (ERD)

```mermaid
erDiagram
    ACCOUNTS {
        INTEGER id PK
        TEXT name "Display name"
        TEXT type "checking, savings, credit, cash, investment"
        BIGINT balance "Current working balance (Milliunits)"
        BIGINT cleared_balance "Verified by bank (Milliunits)"
        BIGINT uncleared_balance "Pending transactions (Milliunits)"
        TEXT note "User annotation"
        BOOLEAN closed "True if account is archived"
        DATETIME created_at
    }

    CATEGORY_GROUPS {
        INTEGER id PK
        TEXT name "e.g., Variable Expenses"
        INTEGER sort_order "DND sorting priority"
        BOOLEAN hidden "UI visibility flag"
        BOOLEAN is_income "System special group"
    }

    CATEGORIES {
        INTEGER id PK
        INTEGER category_group_id FK
        TEXT name
        INTEGER sort_order
        BOOLEAN hidden
        INTEGER linked_account_id FK "Links CC Payment cat to Account"
    }

    BUDGET_MONTHS {
        INTEGER id PK
        INTEGER category_id FK
        TEXT month "FORMAT: YYYY-MM"
        BIGINT assigned "Budgeted by user (Milliunits)"
        BIGINT activity "Net spending/refunds (Milliunits)"
        BIGINT available "Cumulative balance (Milliunits)"
    }

    TRANSACTIONS {
        INTEGER id PK
        INTEGER account_id FK
        TEXT date "FORMAT: YYYY-MM-DD"
        TEXT payee
        INTEGER category_id FK
        TEXT memo
        BIGINT outflow "(Milliunits)"
        BIGINT inflow "(Milliunits)"
        TEXT cleared "Cleared, Uncleared, Reconciled"
        TEXT flag "Color coding/priority"
    }

    TRANSFERS {
        INTEGER id PK
        INTEGER from_transaction_id FK
        INTEGER to_transaction_id FK
    }

    ACCOUNTS ||--o{ TRANSACTIONS : "holds"
    CATEGORY_GROUPS ||--o{ CATEGORIES : "contains"
    CATEGORIES ||--o{ BUDGET_MONTHS : "has history"
    CATEGORIES ||--o{ TRANSACTIONS : "categorizes"
    TRANSACTIONS ||--o| TRANSFERS : "is source of"
    TRANSACTIONS ||--o| TRANSFERS : "is dest of"
    ACCOUNTS ||--o| CATEGORIES : "has dedicated payment"
```

## 🔍 Schema Optimization

The database includes critical indexes and constraints to ensure sub-millisecond query performance on thousands of rows:

### Performance Indexes

- **`idx_transactions_date`**: Essential for filtering transactions by month and the "Exclusion of Future" rule.
- **`idx_budget_months_month_category`**: Optimizes the RTA and Category Activity lookups which are called millions of times in a busy app.
- **`idx_transactions_account`**: Accelerates individual account views.

### Integrity Constraints

- **Foreign Keys**: Enforced natively by PostgreSQL. Deleting an account or category leverages `ON DELETE CASCADE` or `SET NULL`.
- **Unique Budget Logic**: `UNIQUE(category_id, month)` prevents duplicate budget entries for the same month/category pair.

## 📈 Field-Level Specification

### The `budget_months` Table (The Engine Room)

This table acts as a time-series record of the budget's state.

- **`assigned`**: The raw amount entered by the user.
- **`activity`**: Calculated dynamically during transaction entry. Inflow - Outflow in a specific month for a specific category.
- **`available`**: **CUMULATIVE**. Unlike other fields, `available` reflects the entire history of that category. When `assigned` changes in Month M, the system propagates the delta to all months M+1, M+2, etc.

### The `cleared` Enum

Used in the `transactions` table to facilitate reconciliation:

1. **Uncleared (White)**: Transaction reported by user but not yet seen on bank statement.
2. **Cleared (Green 'C')**: Transaction verified on bank statement.
3. **Reconciled (Lock icon)**: Transaction locked in a past reconciliation period; cannot be easily edited.

## 💾 Initialization Lifecycle

The database schema is defined in TypeScript at `lib/db/schema.ts` using Drizzle ORM. On startup, `lib/repos/client.ts` runs Drizzle's `migrate()` to apply any pending migrations from the `drizzle/` directory. This ensures a predictable state for new developers or users.

### Precision & Money Handling

The application uses **BIGINT** columns to store monetary values in **Milliunits** (1/1000th of a currency unit). This eliminates all floating-point rounding errors.

- **Storage**: `BIGINT` in PostgreSQL.
- **Helper**: A custom `money` type is defined in `lib/db/schema.ts` using Drizzle's `customType`.
- **Coercion**: The PostgreSQL driver returns `BIGINT` as strings. The `fromDriver` mapper in the schema automatically coerces these to JavaScript `Numbers` (since we are well within safe integer range).

See `architecture.md` for more details on the financial engine.

- **Database**: `category_group_id` (snake_case)
- **API DTO**: `categoryGroupId` (camelCase)

See `api-reference.md` for the public contract.
