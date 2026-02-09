# World-Class Architecture Upgrade Plan 🚀

**Target Architecture:** "Offline-First, Type-Safe, Domain-Driven Financial Application"

This document outlines the roadmap to elevate the project's architecture from "Production-Ready" to "World-Class". The focus is on **Reliability**, **Maintainability**, and **Developer Experience (DX)**.

---

## 🏗️ 1. Type-Safe Validation Layer (Zod Integration)

**Current State:**
Validation is manual, scattered across API routes (e.g., `if (!body.month) ...`). Types are defined manually in TypeScript interfaces which can drift from runtime checks.

**The Upgrade:**
Implement **Zod** schema validation at the system boundaries (API Inputs). This guarantees that _no invalid data_ ever enters the Domain or Persistence layers.

### ✅ Implementation Strategy

1.  **Define Schemas:** Create `lib/schemas/budget.ts`, `lib/schemas/transactions.ts`.
2.  **Inference:** Export TypeScript types _from_ the Zod schemas (`Type.infer<typeof Schema>`).
3.  **Middleware/Helper:** specific wrapper for API routes to parse and validate bodies automatically.

### 📝 Example

```typescript
// lib/schemas/transaction.ts
import { z } from "zod";

export const TransactionSchema = z.object({
  accountId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().max(1_000_000_000), // Max 1B safety cap
  payee: z.string().min(1).max(100),
  categoryId: z.number().nullable().optional(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

// app/api/transactions/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const result = TransactionSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.format() }, { status: 400 });
  }
  // Safe to proceed with result.data
}
```

---

## 🧪 2. The Testing Pyramid (E2E with Playwright)

**Current State:**
Strong Unit Testing (Vitest) for `lib/engine`. **Zero** Integration or End-to-End (E2E) confidence.

**The Upgrade:**
Add **Playwright** to test the _application_ as a user sees it. Financial apps require absolute trust; E2E tests verify the database, API, and UI integration.

### ✅ Implementation Strategy

1.  **Setup:** Install Playwright (`npm init playwright@latest`).
2.  **Core Flows:**
    - **Budget Flow:** Assign funds → Check RTA → Refresh page (Persistence check).
    - **Transaction Flow:** Create Transaction → Verify Category Available updates.
    - **Mobile View:** Verify UI responsiveness.
3.  **CI/CD:** Run tests on every PR.

### 📝 Example Scenario

```typescript
// tests/budget-flow.spec.ts
test("assigning money updates RTA", async ({ page }) => {
  await page.goto("/budget");
  await expect(page.getByTestId("rta-amount")).toHaveText("$0.00");

  // Assign $500 to Groceries
  await page.getByTestId("category-groceries-assigned").fill("500");
  await page.keyboard.press("Enter");

  // Verify RTA decreases
  await expect(page.getByTestId("rta-amount")).toHaveText("-$500.00");

  // Verify persistence
  await page.reload();
  await expect(page.getByTestId("category-groceries-assigned")).toHaveValue(
    "500.00",
  );
});
```

---

## 📦 3. Modular Repository Pattern

**Current State:**
`lib/db.ts` is a monolithic ~1300 line file. It mixes Transaction logic, Budget logic, and pure SQL.

**The Upgrade:**
Split the database layer into domain-specific **Repositories**. This enforces "Separation of Concerns" and makes code easier to navigate and review.

### ✅ Implementation Strategy

Create a `lib/repos/` directory:

- `lib/repos/budget.ts` (Budget Months, Categories)
- `lib/repos/transactions.ts` (Transactions, Transfers)
- `lib/repos/accounts.ts` (Accounts, Balance Calculations)
- `lib/db/client.ts` (Shared Database instance)

### 📝 Architecture

`API Route` → `Repository` → `Engine (Pure Math)` → `Repository (Write)`

```typescript
// lib/repos/budget.ts
export const BudgetRepo = {
  getForMonth: (month: string) => {
    /* SQL query */
  },
  updateAssignment: (id: number, month: string, amount: number) => {
    // 1. Get current state
    // 2. Call Engine: calculateAssignment()
    // 3. Write updates
  },
};
```

---

## 💾 4. True Offline Persistence (IndexedDB)

**Current State:**
`networkMode: 'offlineFirst'` is enabled in React Query, but the cache is in-memory only. If the user refreshes while offline, **data is lost**.

**The Upgrade:**
Implement **Persistent Query Client** using **IndexedDB**. This creates a true "Local-First" experience where the app works identically online or offline and survives browser restarts.

### ✅ Implementation Strategy

1.  **Storage Engine:** Use `idb-keyval` (tiny IndexedDB wrapper).
2.  **Persister:** Configure `PersistQueryClientProvider`.
3.  **Sync Queue:** Visualize pending mutations (already in `SyncStatus`, but ensure robustness).

### 🎓 "World-Class" nuance

When coming back online, handle **Conflict Resolution** (Server wins vs Client wins strategies).

---

## 🛠️ 5. Standardized DTOs (Data Transfer Objects)

**Current State:**
API returns raw Database rows. If we rename a DB column (`category_group_id` → `groupId`), the frontend breaks.

**The Upgrade:**
Decouple the DB schema from the API contract. Return **DTOs** that transform internal data shapes into stable API responses.

### ✅ Implementation Strategy

Define return types for every Repo method:

```typescript
interface BudgetViewDTO {
  month: string;
  categories: {
    id: number;
    name: string;
    assigned: number;
    activity: number;
    available: number;
  }[];
  // ...
}
```

**Benefit:** You can refactor the database (e.g., move to PostgreSQL) without changing a single line of Frontend code.

---

## 🔄 6. Input DTOs (camelCase API Inputs)

**Current State:**
Phase V introduced **Output DTOs** — API responses are now camelCase. However, API **inputs** (request bodies) still use snake_case (`account_id`, `category_id`) because the Zod schemas validate those field names. This creates an asymmetry: the frontend reads camelCase but writes snake_case.

**The Upgrade:**
Unify the API contract so both inputs and outputs use **camelCase**. The frontend will send `accountId` instead of `account_id`, and the Zod schemas + API routes will be updated to match.

### ✅ Implementation Strategy

1. **Update Zod Schemas** — Change field names to camelCase (`account_id → accountId`, `category_id → categoryId`).
2. **Update API Routes** — Map camelCase input fields to snake_case before passing to repos/DB layer.
3. **Update Frontend Form State** — `TransactionModal.FormState`, mutation payloads in `useTransactionMutations.ts`, etc. switch from snake_case to camelCase.
4. **Remove the dual-shape pattern** — Components like `TransactionModal` currently maintain separate `Transaction` (camelCase, for reading) and `FormState` (snake_case, for writing) types. After this phase, a single camelCase type works for both.

### 📝 Scope

| File                               | Change                                         |
| ---------------------------------- | ---------------------------------------------- |
| `lib/schemas/*.ts`                 | Rename fields to camelCase                     |
| `app/api/transactions/route.ts`    | Map `accountId → account_id` before DB calls   |
| `app/api/budget/route.ts`          | Map `categoryId → category_id` before DB calls |
| `components/TransactionModal.tsx`  | Unify `FormState` to camelCase                 |
| `hooks/useTransactionMutations.ts` | Send camelCase payloads                        |

**Benefit:** The full API contract (input + output) is camelCase. Frontend code no longer needs to context-switch between naming conventions.

---

## 📉 Summary of Phases

| Phase   | Focus          | Deliverables             | Impact                       | Status  |
| :------ | :------------- | :----------------------- | :--------------------------- | :------ |
| **I**   | **Robustness** | Zod Schemas + Validation | Zero runtime type errors.    | ✅ Done |
| **II**  | **Confidence** | Playwright E2E Tests     | Deploy without fear.         | ✅ Done |
| **III** | **Structure**  | Repository Pattern       | Scalable codebase for teams. | ✅ Done |
| **IV**  | **Resilience** | IndexedDB Persistence    | True offline-capable app.    | ✅ Done |
| **V**   | **Contract**   | Output DTOs              | DB decoupled from frontend.  | ✅ Done |
| **VI**  | **Symmetry**   | Input DTOs               | Unified camelCase API.       | ✅ Done |
