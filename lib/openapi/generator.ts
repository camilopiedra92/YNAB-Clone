/**
 * OpenAPI Document Generator — produces the final OpenAPI 3.1 JSON spec.
 *
 * Uses the registry from ./registry.ts to generate the complete document.
 */
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';

export function getOpenAPIDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'YNAB Clone API',
      version: '1.0.0',
      description: [
        'RESTful API for the YNAB Clone personal finance application.',
        '',
        '## Key Concepts',
        '- **Monetary Values**: All amounts are in **milliunits** (value × 1000). Example: $10.50 = 10,500.',
        '- **Authentication**: Session-based via NextAuth.js. The browser manages cookies automatically.',
        '- **Multi-tenancy**: All budget resources are scoped by `budgetId`. Access is enforced via RLS.',
        '- **Optimistic Updates**: The frontend uses React Query with snapshot/rollback for instant UI updates.',
      ].join('\n'),
      contact: {
        name: 'YNAB Clone',
        url: 'https://github.com/camilopiedra92/YNAB-Clone',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
    ],
    tags: [
      { name: 'Auth', description: 'Registration and authentication' },
      { name: 'User', description: 'User profile and password management' },
      { name: 'Budgets', description: 'Budget CRUD operations' },
      { name: 'Accounts', description: 'Financial account management' },
      { name: 'Budget Planning', description: 'Category assignments and RTA calculation' },
      { name: 'Transactions', description: 'Transaction CRUD, transfers, and reconciliation' },
      { name: 'Categories', description: 'Category and category group management' },
      { name: 'Payees', description: 'Payee autocomplete' },
      { name: 'Sharing', description: 'Multi-user budget sharing' },
      { name: 'Data Import', description: 'YNAB CSV data import' },
    ],
    security: [{ BearerAuth: [] }],
  });
}
