# API Reference

> **Interactive Documentation:** Start the dev server (`npm run dev`) and visit [`/api/docs`](http://localhost:3000/api/docs) for the full Swagger UI explorer.
>
> **Raw Spec:** [`GET /api/docs/spec`](http://localhost:3000/api/docs/spec) returns the OpenAPI 3.1 JSON document.

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

| File                                                          | Purpose                        |
| ------------------------------------------------------------- | ------------------------------ |
| [`lib/openapi/registry.ts`](../lib/openapi/registry.ts)       | All routes & response schemas  |
| [`lib/openapi/generator.ts`](../lib/openapi/generator.ts)     | OpenAPI 3.1 document generator |
| [`app/api/docs/route.ts`](../app/api/docs/route.ts)           | Swagger UI HTML (dev only)     |
| [`app/api/docs/spec/route.ts`](../app/api/docs/spec/route.ts) | JSON spec endpoint (dev only)  |

> [!NOTE]
> API docs are **dev-only**. Both `/api/docs` and `/api/docs/spec` return 404 in production.
