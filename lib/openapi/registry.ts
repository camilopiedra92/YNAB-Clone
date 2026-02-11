/**
 * OpenAPI Registry — registers all API routes and Zod schemas for documentation.
 *
 * This file wraps existing Zod schemas with OpenAPI metadata without modifying them.
 * Uses @asteasolutions/zod-to-openapi v8 with Zod v4 support.
 */
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  CreateAccountSchema,
  UpdateAccountSchema,
  CreateTransactionSchema,
  CreateTransferSchema,
  UpdateTransactionSchema,
  TransactionPatchSchema,
  BudgetAssignmentSchema,
  CreateBudgetSchema,
  UpdateBudgetSchema,
  AddShareSchema,
  UpdateShareRoleSchema,
  CreateCategorySchema,
  UpdateCategoryNameSchema,
  CreateCategoryGroupSchema,
  ReorderSchema,
} from '@/lib/schemas';
import { RegisterSchema, LoginSchema, UpdateProfileSchema, ChangePasswordSchema } from '@/lib/schemas/auth';

// Extend Zod with OpenAPI support (required once)
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ═══════════════════════════════════════════════════════════════════════
// Common Schemas
// ═══════════════════════════════════════════════════════════════════════

const ErrorResponse = registry.register(
  'ErrorResponse',
  z.object({
    error: z.string().openapi({ example: 'Validation failed' }),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
);

const SuccessResponse = registry.register(
  'SuccessResponse',
  z.object({
    success: z.boolean().openapi({ example: true }),
  })
);

// Path parameters
const budgetIdParam = registry.registerParameter(
  'BudgetId',
  z.number().int().positive().openapi({
    param: { name: 'budgetId', in: 'path' },
    example: 1,
  })
);

const accountIdParam = registry.registerParameter(
  'AccountId',
  z.number().int().positive().openapi({
    param: { name: 'id', in: 'path' },
    example: 5,
  })
);

const shareIdParam = registry.registerParameter(
  'ShareId',
  z.number().int().positive().openapi({
    param: { name: 'shareId', in: 'path' },
    example: 3,
  })
);

// ═══════════════════════════════════════════════════════════════════════
// Response Schemas (from DTOs)
// ═══════════════════════════════════════════════════════════════════════

const AccountDTO = registry.register(
  'Account',
  z.object({
    id: z.number().openapi({ example: 1 }),
    budgetId: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Bancolombia Checking' }),
    type: z.string().openapi({ example: 'checking' }),
    balance: z.number().openapi({ example: 5000000, description: 'Working balance in milliunits' }),
    clearedBalance: z.number().openapi({ example: 4800000 }),
    unclearedBalance: z.number().openapi({ example: 200000 }),
    note: z.string().nullable().openapi({ example: 'Primary checking account' }),
    closed: z.boolean().openapi({ example: false }),
  })
);

const TransactionDTO = registry.register(
  'Transaction',
  z.object({
    id: z.number().openapi({ example: 42 }),
    budgetId: z.number().openapi({ example: 1 }),
    accountId: z.number().openapi({ example: 5 }),
    accountName: z.string().openapi({ example: 'Bancolombia Checking' }),
    date: z.string().openapi({ example: '2025-06-15' }),
    payee: z.string().openapi({ example: 'Éxito Supermercado' }),
    categoryId: z.number().nullable().openapi({ example: 3 }),
    categoryName: z.string().nullable().openapi({ example: 'Groceries' }),
    memo: z.string().openapi({ example: 'Weekly groceries' }),
    outflow: z.number().openapi({ example: 150500, description: 'Milliunits' }),
    inflow: z.number().openapi({ example: 0 }),
    cleared: z.enum(['Cleared', 'Uncleared', 'Reconciled']).openapi({ example: 'Cleared' }),
    transferId: z.number().nullable().openapi({ example: null }),
    transferAccountId: z.number().nullable().openapi({ example: null }),
    transferAccountName: z.string().nullable().openapi({ example: null }),
    isFuture: z.boolean().openapi({ example: false }),
    flag: z.string().nullable().openapi({ example: null }),
  })
);

const BudgetItemDTO = registry.register(
  'BudgetItem',
  z.object({
    id: z.number().nullable(),
    categoryId: z.number().nullable(),
    categoryName: z.string().nullable().openapi({ example: 'Groceries' }),
    groupName: z.string().openapi({ example: 'Everyday Expenses' }),
    categoryGroupId: z.number().openapi({ example: 2 }),
    groupHidden: z.boolean().openapi({ example: false }),
    month: z.string().openapi({ example: '2025-06' }),
    assigned: z.number().openapi({ example: 500000, description: 'Milliunits' }),
    activity: z.number().openapi({ example: -150500 }),
    available: z.number().openapi({ example: 349500 }),
    linkedAccountId: z.number().nullable(),
    overspendingType: z.enum(['cash', 'credit']).nullable().optional(),
  })
);

const RTABreakdownDTO = registry.register(
  'RTABreakdown',
  z.object({
    leftOverFromLastMonth: z.number(),
    inflowThisMonth: z.number(),
    positiveCCBalances: z.number(),
    assignedThisMonth: z.number(),
    cashOverspendingLastMonth: z.number(),
    assignedInFuture: z.number(),
  })
);

const BudgetResponseDTO = registry.register(
  'BudgetResponse',
  z.object({
    budget: z.array(BudgetItemDTO),
    readyToAssign: z.number().openapi({ example: 2500000, description: 'RTA in milliunits' }),
    rtaBreakdown: RTABreakdownDTO,
    overspendingTypes: z.record(z.string(), z.enum(['cash', 'credit']).nullable()),
    inspectorData: z.object({
      summary: z.object({
        leftOverFromLastMonth: z.number(),
        assignedThisMonth: z.number(),
        activity: z.number(),
        available: z.number(),
      }),
      costToBeMe: z.object({
        targets: z.number(),
        expectedIncome: z.number(),
      }),
      autoAssign: z.object({
        underfunded: z.number(),
        assignedLastMonth: z.number(),
        spentLastMonth: z.number(),
        averageAssigned: z.number(),
        averageSpent: z.number(),
        reduceOverfunding: z.number(),
        resetAvailableAmounts: z.number(),
        resetAssignedAmounts: z.number(),
      }),
      futureAssignments: z.object({
        total: z.number(),
        months: z.array(z.object({ month: z.string(), amount: z.number() })),
      }),
    }),
  })
);

const CategoryDTO = registry.register(
  'Category',
  z.object({
    id: z.number(),
    budgetId: z.number(),
    name: z.string().openapi({ example: 'Groceries' }),
    groupName: z.string().openapi({ example: 'Everyday Expenses' }),
    categoryGroupId: z.number(),
    sortOrder: z.number(),
    linkedAccountId: z.number().nullable(),
  })
);

const ShareInfoDTO = registry.register(
  'ShareInfo',
  z.object({
    id: z.number(),
    budgetId: z.number(),
    userId: z.string(),
    userName: z.string().openapi({ example: 'Jane Doe' }),
    userEmail: z.string().openapi({ example: 'jane@example.com' }),
    role: z.string().openapi({ example: 'editor' }),
    createdAt: z.string().nullable(),
  })
);

const ShareDTO = registry.register(
  'Share',
  z.object({
    id: z.number(),
    budgetId: z.number(),
    userId: z.string(),
    role: z.string().openapi({ example: 'editor' }),
    createdAt: z.string().nullable(),
  })
);

const ReconciliationInfoDTO = registry.register(
  'ReconciliationInfo',
  z.object({
    clearedBalance: z.number(),
    reconciledBalance: z.number(),
    pendingClearedBalance: z.number(),
    pendingClearedCount: z.number(),
  })
);

const BudgetSummary = registry.register(
  'BudgetSummary',
  z.object({
    id: z.number(),
    name: z.string().openapi({ example: 'My Budget' }),
    currencyCode: z.string().openapi({ example: 'COP' }),
    currencySymbol: z.string().openapi({ example: '$' }),
    currencyDecimals: z.number().openapi({ example: 0 }),
    role: z.string().openapi({ example: 'owner' }),
    isOwner: z.boolean().openapi({ example: true }),
  })
);

const UserProfile = registry.register(
  'UserProfile',
  z.object({
    id: z.string(),
    name: z.string().openapi({ example: 'John Doe' }),
    email: z.string().openapi({ example: 'john@example.com' }),
  })
);

// Note: Existing Zod schemas (CreateAccountSchema, etc.) are referenced inline
// in route definitions below. They are NOT registered as named components because
// they were created before extendZodWithOpenApi() — the library handles inline
// schemas correctly in route definitions.

// ═══════════════════════════════════════════════════════════════════════
// Security Scheme
// ═══════════════════════════════════════════════════════════════════════

registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'NextAuth.js session cookie (automatically managed by browser)',
});

// ═══════════════════════════════════════════════════════════════════════
// Auth Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  request: {
    body: {
      content: { 'application/json': { schema: RegisterSchema } },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: { 'application/json': { schema: UserProfile } },
    },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    409: { description: 'Email already exists' },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// User Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/user/profile',
  tags: ['User'],
  summary: 'Get current user profile',
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'User profile', content: { 'application/json': { schema: UserProfile } } },
    401: { description: 'Unauthorized' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/user/profile',
  tags: ['User'],
  summary: 'Update current user profile',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: UpdateProfileSchema } } },
  },
  responses: {
    200: { description: 'Updated profile', content: { 'application/json': { schema: UserProfile } } },
    400: { description: 'Validation error' },
    409: { description: 'Email already exists' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/user/password',
  tags: ['User'],
  summary: 'Change password',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: ChangePasswordSchema } } },
  },
  responses: {
    200: { description: 'Password changed', content: { 'application/json': { schema: SuccessResponse } } },
    400: { description: 'Current password incorrect' },
    401: { description: 'Unauthorized' },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Budget Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets',
  tags: ['Budgets'],
  summary: 'List all budgets for current user',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Array of budgets (owned + shared)',
      content: { 'application/json': { schema: z.array(BudgetSummary) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets',
  tags: ['Budgets'],
  summary: 'Create a new budget',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateBudgetSchema } } },
  },
  responses: {
    201: { description: 'Budget created', content: { 'application/json': { schema: BudgetSummary } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}',
  tags: ['Budgets'],
  summary: 'Get a single budget',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string() }) },
  responses: {
    200: { description: 'Budget details', content: { 'application/json': { schema: BudgetSummary } } },
    404: { description: 'Budget not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/budgets/{budgetId}',
  tags: ['Budgets'],
  summary: 'Update budget settings (owner only)',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: UpdateBudgetSchema } } },
  },
  responses: {
    200: { description: 'Updated budget', content: { 'application/json': { schema: BudgetSummary } } },
    403: { description: 'Not the budget owner' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/budgets/{budgetId}',
  tags: ['Budgets'],
  summary: 'Delete a budget (owner only)',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string() }) },
  responses: {
    200: { description: 'Budget deleted', content: { 'application/json': { schema: SuccessResponse } } },
    403: { description: 'Not the budget owner' },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Account Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/accounts',
  tags: ['Accounts'],
  summary: 'List all accounts in a budget',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string() }) },
  responses: {
    200: { description: 'Array of accounts', content: { 'application/json': { schema: z.array(AccountDTO) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/accounts',
  tags: ['Accounts'],
  summary: 'Create a new account',
  description: 'Creates a financial account. Credit card accounts auto-create a CC Payment category.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: CreateAccountSchema } } },
  },
  responses: {
    201: { description: 'Account created', content: { 'application/json': { schema: AccountDTO } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/accounts/{id}',
  tags: ['Accounts'],
  summary: 'Get a single account',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string(), id: z.string() }) },
  responses: {
    200: { description: 'Account details', content: { 'application/json': { schema: AccountDTO } } },
    404: { description: 'Account not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/budgets/{budgetId}/accounts/{id}',
  tags: ['Accounts'],
  summary: 'Update account metadata',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string(), id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateAccountSchema } } },
  },
  responses: {
    200: { description: 'Updated account', content: { 'application/json': { schema: AccountDTO } } },
    404: { description: 'Account not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/accounts/{id}/reconciliation-info',
  tags: ['Accounts'],
  summary: 'Get reconciliation info for an account',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string(), id: z.string() }) },
  responses: {
    200: { description: 'Reconciliation details', content: { 'application/json': { schema: ReconciliationInfoDTO } } },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Budget Planning Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/budget',
  tags: ['Budget Planning'],
  summary: 'Get complete budget state for a month',
  description: 'Returns all categories with assigned/activity/available, RTA, RTA breakdown, overspending types, and inspector data.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    query: z.object({
      month: z.string().optional().openapi({
        example: '2025-06',
        description: 'Month in YYYY-MM format. Defaults to current month.',
      }),
    }),
  },
  responses: {
    200: { description: 'Complete budget state', content: { 'application/json': { schema: BudgetResponseDTO } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/budget',
  tags: ['Budget Planning'],
  summary: 'Update category assignment',
  description: 'Sets the assigned amount for a category in a given month. Triggers cumulative available propagation to future months.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: BudgetAssignmentSchema } } },
  },
  responses: {
    200: { description: 'Updated budget state', content: { 'application/json': { schema: BudgetResponseDTO } } },
    400: { description: 'Validation error' },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Transaction Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/transactions',
  tags: ['Transactions'],
  summary: 'List transactions',
  description: 'Returns all transactions, optionally filtered by account.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    query: z.object({
      accountId: z.string().optional().openapi({
        description: 'Filter by account ID',
        example: '5',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Array of transactions',
      content: { 'application/json': { schema: z.array(TransactionDTO) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/transactions',
  tags: ['Transactions'],
  summary: 'Create a transaction or transfer',
  description: 'Creates a regular transaction or an inter-account transfer. Transfers use the `isTransfer` discriminator. Side effects: updates account balances, budget activity, and CC payment categories.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.union([CreateTransactionSchema, CreateTransferSchema]),
        },
      },
    },
  },
  responses: {
    201: { description: 'Transaction created', content: { 'application/json': { schema: TransactionDTO } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/budgets/{budgetId}/transactions',
  tags: ['Transactions'],
  summary: 'Update a transaction',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: UpdateTransactionSchema } } },
  },
  responses: {
    200: { description: 'Updated transaction', content: { 'application/json': { schema: TransactionDTO } } },
    404: { description: 'Transaction not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/budgets/{budgetId}/transactions',
  tags: ['Transactions'],
  summary: 'Delete a transaction',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.number().int().positive().openapi({ example: 42 }),
            budgetId: z.number().int().positive().openapi({ example: 1 }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Transaction deleted', content: { 'application/json': { schema: SuccessResponse } } },
    404: { description: 'Transaction not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/budgets/{budgetId}/transactions',
  tags: ['Transactions'],
  summary: 'Toggle cleared or reconcile',
  description: 'Discriminated action: `toggle-cleared` toggles a transaction\'s cleared state; `reconcile` reconciles an account to a bank balance.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: TransactionPatchSchema } } },
  },
  responses: {
    200: { description: 'Action completed', content: { 'application/json': { schema: SuccessResponse } } },
    400: { description: 'Validation error' },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Category Routes
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/categories',
  tags: ['Categories'],
  summary: 'List all categories with groups',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string() }) },
  responses: {
    200: { description: 'Array of categories', content: { 'application/json': { schema: z.array(CategoryDTO) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/categories',
  tags: ['Categories'],
  summary: 'Create a category',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: CreateCategorySchema } } },
  },
  responses: {
    200: { description: 'Category created', content: { 'application/json': { schema: z.object({ success: z.boolean(), id: z.number() }) } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/budgets/{budgetId}/categories',
  tags: ['Categories'],
  summary: 'Rename a category',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: UpdateCategoryNameSchema } } },
  },
  responses: {
    200: { description: 'Category renamed', content: { 'application/json': { schema: SuccessResponse } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/category-groups',
  tags: ['Categories'],
  summary: 'Create a category group',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: CreateCategoryGroupSchema } } },
  },
  responses: {
    200: { description: 'Group created', content: { 'application/json': { schema: z.object({ success: z.boolean(), id: z.number() }) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/categories/reorder',
  tags: ['Categories'],
  summary: 'Reorder categories or category groups',
  description: 'Updates sort order. Use type `group` for groups, `category` for categories.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: ReorderSchema } } },
  },
  responses: {
    200: { description: 'Reorder successful', content: { 'application/json': { schema: SuccessResponse } } },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Payees
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/payees',
  tags: ['Payees'],
  summary: 'List distinct payees for autocomplete',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string() }) },
  responses: {
    200: {
      description: 'Array of payee strings',
      content: { 'application/json': { schema: z.array(z.string().openapi({ example: 'Éxito Supermercado' })) } },
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Shares
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'get',
  path: '/api/budgets/{budgetId}/shares',
  tags: ['Sharing'],
  summary: 'List all shared members',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string() }) },
  responses: {
    200: { description: 'Array of shares', content: { 'application/json': { schema: z.array(ShareInfoDTO) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/shares',
  tags: ['Sharing'],
  summary: 'Invite a user by email (owner only)',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: { content: { 'application/json': { schema: AddShareSchema } } },
  },
  responses: {
    201: { description: 'Share added', content: { 'application/json': { schema: ShareDTO } } },
    404: { description: 'User not found' },
    409: { description: 'User already has access' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/budgets/{budgetId}/shares/{shareId}',
  tags: ['Sharing'],
  summary: 'Update a share role (owner only)',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string(), shareId: z.string() }),
    body: { content: { 'application/json': { schema: UpdateShareRoleSchema } } },
  },
  responses: {
    200: { description: 'Role updated', content: { 'application/json': { schema: ShareDTO } } },
    403: { description: 'Not the budget owner' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/budgets/{budgetId}/shares/{shareId}',
  tags: ['Sharing'],
  summary: 'Remove a share (owner removes member, member leaves)',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ budgetId: z.string(), shareId: z.string() }) },
  responses: {
    200: { description: 'Share removed', content: { 'application/json': { schema: SuccessResponse } } },
    404: { description: 'Share not found' },
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Data Import
// ═══════════════════════════════════════════════════════════════════════

registry.registerPath({
  method: 'post',
  path: '/api/budgets/{budgetId}/import',
  tags: ['Data Import'],
  summary: 'Import YNAB CSV data',
  description: 'Uploads register and plan CSV files to import transactions and budget data. Rate limited. Max 10MB per file.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ budgetId: z.string() }),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            register: z.string().openapi({ description: 'Register CSV file', format: 'binary' }),
            plan: z.string().openapi({ description: 'Plan CSV file', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Import statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            stats: z.object({
              accounts: z.number(),
              transactions: z.number(),
              categories: z.number(),
              budgetMonths: z.number(),
            }),
          }),
        },
      },
    },
    400: { description: 'Missing files or file too large' },
    429: { description: 'Rate limit exceeded' },
  },
});
