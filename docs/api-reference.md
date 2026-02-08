# API Reference & Technical Contract

This document provides a formal specification of the internal API endpoints used by the YNAB Clone. These routes facilitate the communication between the React frontend and the SQLite business engine.

## 📡 General Standards
- **Content-Type**: `application/json`
- **Method Standards**:
    - `GET`: Idempotent data retrieval.
    - `POST`: Create a new resource.
    - `PUT`/`PATCH`: Update existing records.
    - `DELETE`: Remove records.
- **Error Propagation**: Errors are returned as JSON objects with a `message` field and appropriate HTTP status codes (400, 404, 500).

---

## 🏦 Accounts API

### `GET /api/accounts`
Retrieves a list of all accounts including their current working balances.
- **Response**: `Array<Account>`

### `POST /api/accounts`
Creates a new financial account.
- **Body**: `{ name: string, type: string, balance: number }`
- **Logic**: Automatically initializes a starting balance transaction.

### `PATCH /api/accounts/[id]`
Updates account metadata (name, note, closed status).
- **Body**: `{ name?: string, note?: string, closed?: boolean }`

---

## 📈 Budget & Planning API

### `GET /api/budget?month=YYYY-MM`
Returns the complete budget state for the specified month.
- **Response**: `{ categories: Array<BudgetItem>, rta: number }`
- **Internal Logic**: Calculates the global RTA and aggregates category activity in real-time.

### `POST /api/budget`
Updates the amount assigned to a specific category.
- **Body**: `{ categoryId: number, month: string, assigned: number }`
- **Side Effects**: Triggers cumulative `available` propagation to all future months.

---

## 💸 Transactions API

### `GET /api/transactions`
Query transactions with multi-dimensional filters.
- **Query Params**:
    - `accountId`: Filter by specific account.
    - `categoryId`: Filter by budget category.
    - `startDate/endDate`: Time-range filtering.
    - `limit`: Pagination limit.

### `POST /api/transactions`
Registers a new financial movement.
- **Body**: `{ accountId, date, payee, categoryId, outflow, inflow, memo, cleared, flag }`
- **Side Effects**: 
    1. Updates `accounts.balance`.
    2. Updates `budget_months.activity`.
    3. Triggers `updateCreditCardPaymentBudget` if on a CC account.

---

## 🏗 Categories & Groups API

### `GET /api/categories`
Returns the complete category hierarchy.

### `POST /api/category-groups/reorder`
Updates the sort order of category groups.
- **Body**: `Array<{ id: number, sort_order: number }>`

### `POST /api/categories/reorder`
Allows moving categories between groups or reordering within a group.
- **Body**: `Array<{ id: number, sort_order: number, category_group_id?: number }>`

---

## 🧮 Summary & Metadata API

### `GET /api/budget/inspector?month=YYYY-MM`
Technical endpoint powering the right-side inspector panel.
- **Returns**:
    - `summary`: { assigned, activity, available }
    - `autoAssign`: { underfunded, avgSpent, etc. }
    - `futureAssigned`: Total money assigned in subsequent months.

---

## 🛡 Fault Tolerance & Feedback
The API layer incorporates **Sonner** feedback on the client side. Every failed request will trigger a toast notification, while successful mutations with optimistic side-effects will be "silently synchronized" to maintain UI fluidity.
