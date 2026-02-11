# API Reference

> **Interactive Documentation:** Start the dev server (`npm run dev`) and visit [`/api-docs`](http://localhost:3000/api-docs) for the full Swagger UI explorer.
>
> **Raw Spec:** [`GET /api/docs`](http://localhost:3000/api/docs) returns the OpenAPI 3.1 JSON document.

## 📡 General Standards

- **Content-Type**: `application/json` (except file uploads: `multipart/form-data`)
- **Authentication**: Session-based via NextAuth.js (cookie-managed by browser)
- **Monetary Values**: All amounts are **milliunits** (value × 1000). Example: $10.50 = `10500`
- **Error Format**: `{ "error": "message", "details": { "field": ["error1", "error2"] } }`

## Endpoint Groups

| Tag                 | Base Path                                 | Description                                |
| ------------------- | ----------------------------------------- | ------------------------------------------ |
| **Auth**            | `/api/auth/register`                      | User registration                          |
| **User**            | `/api/user/profile`, `/api/user/password` | Profile & password management              |
| **Budgets**         | `/api/budgets`                            | Budget CRUD (owner operations)             |
| **Accounts**        | `/api/budgets/:budgetId/accounts`         | Financial accounts + reconciliation        |
| **Budget Planning** | `/api/budgets/:budgetId/budget`           | Category assignments & RTA calculation     |
| **Transactions**    | `/api/budgets/:budgetId/transactions`     | CRUD, transfers, toggle-cleared, reconcile |
| **Categories**      | `/api/budgets/:budgetId/categories`       | Categories, groups, reordering             |
| **Payees**          | `/api/budgets/:budgetId/payees`           | Payee autocomplete                         |
| **Sharing**         | `/api/budgets/:budgetId/shares`           | Multi-user budget sharing                  |
| **Data Import**     | `/api/budgets/:budgetId/import`           | YNAB CSV import (rate limited)             |

## Auto-Generation

The OpenAPI spec is auto-generated from existing Zod validation schemas using [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi).

- **Registry**: [`lib/openapi/registry.ts`](../lib/openapi/registry.ts) — all routes & schemas
- **Generator**: [`lib/openapi/generator.ts`](../lib/openapi/generator.ts) — produces the OpenAPI 3.1 document
- **Swagger UI**: [`app/(app)/api-docs/page.tsx`](<../app/(app)/api-docs/page.tsx>) — interactive explorer

> [!NOTE]
> API docs are **dev-only**. The `/api/docs` endpoint returns 404 in production.
