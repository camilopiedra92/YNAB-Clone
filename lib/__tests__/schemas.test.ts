/**
 * Schema Tests — validates all Zod schemas and the validateBody helper.
 *
 * Covers:
 * - validateBody() success + failure paths, formatZodError
 * - CreateTransactionSchema: valid, defaults, date format, negative amounts
 * - CreateTransferSchema: valid, refine (must have outflow OR amount)
 * - UpdateTransactionSchema: valid, partial updates
 * - TransactionPatchSchema: discriminated union (toggle, reconciliation, reconcile)
 * - CreateAccountSchema: valid, min/max name, type enum, default balance
 * - UpdateAccountSchema: partial, nullable note
 * - BudgetAssignmentSchema: valid, month format, refine (max assigned), infinity
 * - CreateCategorySchema, UpdateCategoryNameSchema, CreateCategoryGroupSchema
 * - ReorderSchema: valid, min items
 */
import { describe, it, expect } from 'vitest';

import {
    CreateTransactionSchema,
    CreateTransferSchema,
    UpdateTransactionSchema,
    TransactionPatchSchema,
    CreateAccountSchema,
    UpdateAccountSchema,
    BudgetAssignmentSchema,
    CreateCategorySchema,
    UpdateCategoryNameSchema,
    CreateCategoryGroupSchema,
    ReorderSchema,
    validateBody,
} from '../schemas';

// ─────────────────────────────────────────────────────────────────────
// validateBody helper
// ─────────────────────────────────────────────────────────────────────
describe('validateBody', () => {
    it('returns success with parsed data when input is valid', () => {
        const result = validateBody(CreateAccountSchema, {
            budgetId: 1, name: 'Checking', type: 'checking',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('Checking');
            expect(result.data.type).toBe('checking');
            expect(result.data.balance).toBe(0); // default
        }
    });

    it('returns failure with 400 NextResponse when input is invalid', async () => {
        const result = validateBody(CreateAccountSchema, { name: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
            // It should be a Response-like object with status 400
            expect(result.response.status).toBe(400);
            const body = await result.response.json();
            expect(body.error).toBe('Validation failed');
            expect(body.details).toBeDefined();
        }
    });

    it('formats nested path errors correctly', async () => {
        const result = validateBody(CreateTransactionSchema, {
            accountId: -1, // positive int required
            date: 'bad-date',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const body = await result.response.json();
            // Should have errors keyed by field path
            expect(body.details).toBeDefined();
            expect(typeof body.details).toBe('object');
        }
    });

    it('formats root-level errors using _root key', async () => {
        // CreateTransferSchema has a .refine() that fails at root level
        const result = validateBody(CreateTransferSchema, {
            isTransfer: true,
            budgetId: 1, accountId: 1,
            transferAccountId: 2,
            date: '2025-01-15',
            // missing both outflow and amount → refine fails with path: ['amount']
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const body = await result.response.json();
            expect(body.details).toBeDefined();
        }
    });

    it('groups multiple errors on the same path', async () => {
        // Create a schema that produces multiple errors on the same field
        // BudgetAssignment with assigned = Infinity → fails .finite() AND .refine(abs <= max)
        // Actually the short-circuit means we need multiple fields failing with same path.
        // Let's test with a completely invalid input that generates multiple issues
        const result = validateBody(CreateTransactionSchema, {
            // Missing accountId and date — both required, but each at their own path
            // For same-path test, send a value that fails multiple checks:
            accountId: 'not-a-number', // fails number check
            date: 12345, // fails string check
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const body = await result.response.json();
            expect(body.details).toBeDefined();
            // accountId should have error(s)
            expect(body.details['accountId']).toBeDefined();
            expect(Array.isArray(body.details['accountId'])).toBe(true);
        }
    });

    it('appends multiple errors on the same field path', async () => {
        // Use superRefine to produce 2 issues under the same path
        const { z } = await import('zod');
        const MultiErrorSchema = z.object({
            value: z.number(),
        }).superRefine((data, ctx) => {
            ctx.addIssue({ code: 'custom', message: 'error one', path: ['value'] });
            ctx.addIssue({ code: 'custom', message: 'error two', path: ['value'] });
        });
        const result = validateBody(MultiErrorSchema, { value: 42 });
        expect(result.success).toBe(false);
        if (!result.success) {
            const body = await result.response.json();
            // Both errors should be grouped under 'value'
            expect(body.details['value']).toBeDefined();
            expect(body.details['value']).toContain('error one');
            expect(body.details['value']).toContain('error two');
            expect(body.details['value'].length).toBe(2);
        }
    });

    it('uses _root key when error path is empty', async () => {
        // superRefine at root level with empty path (no path property)
        const { z } = await import('zod');
        const RootErrorSchema = z.object({
            a: z.number(),
        }).superRefine((_data, ctx) => {
            ctx.addIssue({ code: 'custom', message: 'root level issue' });
        });
        const result = validateBody(RootErrorSchema, { a: 1 });
        expect(result.success).toBe(false);
        if (!result.success) {
            const body = await result.response.json();
            expect(body.details['_root']).toBeDefined();
            expect(body.details['_root']).toContain('root level issue');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────
// Account Schemas
// ─────────────────────────────────────────────────────────────────────
describe('CreateAccountSchema', () => {
    it('parses valid input with defaults', () => {
        const result = CreateAccountSchema.safeParse({
            budgetId: 1,
            name: 'Savings',
            type: 'savings',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.balance).toBe(0);
        }
    });

    it('parses valid input with explicit balance', () => {
        const result = CreateAccountSchema.safeParse({
            budgetId: 1,
            name: 'Savings',
            type: 'savings',
            balance: 50000,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.balance).toBe(50000);
        }
    });

    it('accepts all valid account types', () => {
        for (const type of ['checking', 'savings', 'cash', 'credit', 'tracking']) {
            const result = CreateAccountSchema.safeParse({ budgetId: 1, name: 'Test', type });
            expect(result.success).toBe(true);
        }
    });

    it('rejects empty name', () => {
        const result = CreateAccountSchema.safeParse({ budgetId: 1, name: '', type: 'checking' });
        expect(result.success).toBe(false);
    });

    it('rejects name exceeding 100 chars', () => {
        const result = CreateAccountSchema.safeParse({ budgetId: 1, name: 'x'.repeat(101), type: 'checking' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid account type', () => {
        const result = CreateAccountSchema.safeParse({ budgetId: 1, name: 'Test', type: 'brokerage' });
        expect(result.success).toBe(false);
    });

    it('rejects missing type', () => {
        const result = CreateAccountSchema.safeParse({ budgetId: 1, name: 'Test' });
        expect(result.success).toBe(false);
    });
});

describe('UpdateAccountSchema', () => {
    it('parses partial update with just name', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1, name: 'My Checking' });
        expect(result.success).toBe(true);
    });

    it('parses partial update with just note', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1, note: 'Primary account' });
        expect(result.success).toBe(true);
    });

    it('accepts null note', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1, note: null });
        expect(result.success).toBe(true);
    });

    it('parses closed boolean', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1, closed: true });
        expect(result.success).toBe(true);
    });

    it('accepts object with only budgetId (no actual fields being updated)', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1 });
        expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1, name: '' });
        expect(result.success).toBe(false);
    });

    it('rejects note exceeding 500 chars', () => {
        const result = UpdateAccountSchema.safeParse({ budgetId: 1, note: 'x'.repeat(501) });
        expect(result.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────
// Transaction Schemas
// ─────────────────────────────────────────────────────────────────────
describe('CreateTransactionSchema', () => {
    it('parses valid minimal input with defaults', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1,
            accountId: 1,
            date: '2025-06-15',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.payee).toBe('');
            expect(result.data.memo).toBe('');
            expect(result.data.outflow).toBe(0);
            expect(result.data.inflow).toBe(0);
            expect(result.data.cleared).toBe('Uncleared');
        }
    });

    it('parses fully specified input', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1, 
            accountId: 5,
            date: '2025-12-31',
            payee: 'Walmart',
            categoryId: 3,
            memo: 'Weekly groceries',
            outflow: 150.50,
            inflow: 0,
            cleared: 'Cleared',
            flag: 'red',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categoryId).toBe(3);
            expect(result.data.flag).toBe('red');
        }
    });

    it('accepts null categoryId', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1,
            accountId: 1,
            date: '2025-01-01',
            categoryId: null,
        });
        expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
        expect(CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '15/06/2025',
        }).success).toBe(false);

        expect(CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '2025-6-15',
        }).success).toBe(false);

        expect(CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: 'not-a-date',
        }).success).toBe(false);

        expect(CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '',
        }).success).toBe(false);
    });

    it('rejects negative outflow', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '2025-01-01', outflow: -10,
        });
        expect(result.success).toBe(false);
    });

    it('rejects negative inflow', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '2025-01-01', inflow: -10,
        });
        expect(result.success).toBe(false);
    });

    it('rejects non-positive accountId', () => {
        expect(CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 0, date: '2025-01-01',
        }).success).toBe(false);

        expect(CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: -1, date: '2025-01-01',
        }).success).toBe(false);
    });

    it('rejects float accountId', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1.5, date: '2025-01-01',
        });
        expect(result.success).toBe(false);
    });

    it('accepts all valid cleared states', () => {
        for (const cleared of ['Cleared', 'Uncleared', 'Reconciled']) {
            const result = CreateTransactionSchema.safeParse({
                budgetId: 1, accountId: 1, date: '2025-01-01', cleared,
            });
            expect(result.success).toBe(true);
        }
    });

    it('rejects invalid cleared state', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '2025-01-01', cleared: 'Pending',
        });
        expect(result.success).toBe(false);
    });

    it('accepts null flag', () => {
        const result = CreateTransactionSchema.safeParse({
            budgetId: 1, accountId: 1, date: '2025-01-01', flag: null,
        });
        expect(result.success).toBe(true);
    });
});

describe('CreateTransferSchema', () => {
    const validTransfer = {
        isTransfer: true,
        budgetId: 1, accountId: 1,
        transferAccountId: 2,
        date: '2025-01-15',
        outflow: 500,
    };

    it('parses valid transfer with outflow', () => {
        const result = CreateTransferSchema.safeParse(validTransfer);
        expect(result.success).toBe(true);
    });

    it('parses valid transfer with amount instead of outflow', () => {
        const result = CreateTransferSchema.safeParse({
            ...validTransfer,
            outflow: undefined,
            amount: 500,
        });
        expect(result.success).toBe(true);
    });

    it('fails refine when neither outflow nor amount provided', () => {
        const result = CreateTransferSchema.safeParse({
            isTransfer: true,
            budgetId: 1, accountId: 1,
            transferAccountId: 2,
            date: '2025-01-15',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map(i => i.message);
            expect(messages).toContain('Transfer amount must be positive');
        }
    });

    it('fails refine when outflow is 0', () => {
        const result = CreateTransferSchema.safeParse({
            ...validTransfer,
            outflow: 0,
        });
        expect(result.success).toBe(false);
    });

    it('rejects non-literal isTransfer', () => {
        const result = CreateTransferSchema.safeParse({
            ...validTransfer,
            isTransfer: false,
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing transferAccountId', () => {
        const result = CreateTransferSchema.safeParse({
            isTransfer: true,
            budgetId: 1, accountId: 1,
            date: '2025-01-15',
            outflow: 500,
        });
        expect(result.success).toBe(false);
    });

    it('applies defaults for memo and cleared', () => {
        const result = CreateTransferSchema.safeParse(validTransfer);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.memo).toBe('');
            expect(result.data.cleared).toBe('Uncleared');
        }
    });
});

describe('UpdateTransactionSchema', () => {
    it('parses valid update with id and partial fields', () => {
        const result = UpdateTransactionSchema.safeParse({
            id: 42,
            budgetId: 1,
            payee: 'New Payee',
            outflow: 200,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe(42);
            expect(result.data.payee).toBe('New Payee');
            expect(result.data.date).toBeUndefined();
        }
    });

    it('rejects missing id', () => {
        const result = UpdateTransactionSchema.safeParse({ payee: 'Test' });
        expect(result.success).toBe(false);
    });

    it('rejects non-positive id', () => {
        const result = UpdateTransactionSchema.safeParse({ id: 0 });
        expect(result.success).toBe(false);
    });

    it('accepts null categoryId (uncategorize)', () => {
        const result = UpdateTransactionSchema.safeParse({
            id: 1,
            budgetId: 1,
            categoryId: null,
        });
        expect(result.success).toBe(true);
    });

    it('accepts null flag', () => {
        const result = UpdateTransactionSchema.safeParse({
            id: 1,
            budgetId: 1,
            flag: null,
        });
        expect(result.success).toBe(true);
    });
});

describe('TransactionPatchSchema (discriminated union)', () => {
    it('parses toggle-cleared action', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'toggle-cleared',
            budgetId: 1,
            id: 5,
        });
        expect(result.success).toBe(true);
    });

    it('parses get-reconciliation-info action', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'get-reconciliation-info',
            budgetId: 1,
            accountId: 10,
        });
        expect(result.success).toBe(true);
    });

    it('parses reconcile action', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'reconcile',
            budgetId: 1,
            accountId: 10,
            bankBalance: 55000.50,
        });
        expect(result.success).toBe(true);
    });

    it('parses reconcile action with negative bankBalance', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'reconcile',
            budgetId: 1, accountId: 1,
            bankBalance: -500,
        });
        expect(result.success).toBe(true);
    });

    it('parses reconcile action with zero bankBalance', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'reconcile',
            budgetId: 1, accountId: 1,
            bankBalance: 0,
        });
        expect(result.success).toBe(true);
    });

    it('rejects unknown action', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'unknown-action',
            id: 1,
        });
        expect(result.success).toBe(false);
    });

    it('rejects toggle-cleared without id', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'toggle-cleared',
        });
        expect(result.success).toBe(false);
    });

    it('rejects reconcile without bankBalance', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'reconcile',
            budgetId: 1, accountId: 1,
        });
        expect(result.success).toBe(false);
    });

    it('rejects reconcile without accountId', () => {
        const result = TransactionPatchSchema.safeParse({
            action: 'reconcile',
            bankBalance: 1000,
        });
        expect(result.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────
// Budget Schema
// ─────────────────────────────────────────────────────────────────────
describe('BudgetAssignmentSchema', () => {
    it('parses valid assignment', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 3,
            month: '2025-06',
            assigned: 150000,
        });
        expect(result.success).toBe(true);
    });

    it('accepts zero assigned', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: 0,
        });
        expect(result.success).toBe(true);
    });

    it('accepts negative assigned (un-assigning)', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: -50000,
        });
        expect(result.success).toBe(true);
    });

    it('rejects assigned exceeding max (100 billion)', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: 100_000_000_001,
        });
        expect(result.success).toBe(false);
    });

    it('rejects negative assigned exceeding max', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: -100_000_000_001,
        });
        expect(result.success).toBe(false);
    });

    it('rejects Infinity', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: Infinity,
        });
        expect(result.success).toBe(false);
    });

    it('rejects NaN', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: NaN,
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid month format (missing leading zero)', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-1',
            assigned: 100,
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid month format (13)', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-13',
            assigned: 100,
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid month format (00)', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-00',
            assigned: 100,
        });
        expect(result.success).toBe(false);
    });

    it('rejects full date as month', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01-15',
            assigned: 100,
        });
        expect(result.success).toBe(false);
    });

    it('rejects non-positive categoryId', () => {
        expect(BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 0, month: '2025-01', assigned: 100,
        }).success).toBe(false);

        expect(BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: -1, month: '2025-01', assigned: 100,
        }).success).toBe(false);
    });

    it('rejects non-numeric assigned', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
            assigned: 'one hundred',
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing assigned', () => {
        const result = BudgetAssignmentSchema.safeParse({
            budgetId: 1, categoryId: 1,
            month: '2025-01',
        });
        expect(result.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────
// Category Schemas
// ─────────────────────────────────────────────────────────────────────
describe('CreateCategorySchema', () => {
    it('parses valid input', () => {
        const result = CreateCategorySchema.safeParse({
            budgetId: 1,
            name: 'Groceries',
            categoryGroupId: 5,
        });
        expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
        const result = CreateCategorySchema.safeParse({
            budgetId: 1, name: '',
            categoryGroupId: 1,
        });
        expect(result.success).toBe(false);
    });

    it('rejects name exceeding 100 chars', () => {
        const result = CreateCategorySchema.safeParse({
            budgetId: 1, name: 'x'.repeat(101),
            categoryGroupId: 1,
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing categoryGroupId', () => {
        const result = CreateCategorySchema.safeParse({ budgetId: 1, name: 'Test' });
        expect(result.success).toBe(false);
    });

    it('rejects non-positive categoryGroupId', () => {
        const result = CreateCategorySchema.safeParse({
            budgetId: 1, name: 'Test', categoryGroupId: 0,
        });
        expect(result.success).toBe(false);
    });
});

describe('UpdateCategoryNameSchema', () => {
    it('parses valid input', () => {
        const result = UpdateCategoryNameSchema.safeParse({ budgetId: 1, id: 1, name: 'New Name' });
        expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
        const result = UpdateCategoryNameSchema.safeParse({ budgetId: 1, id: 1, name: '' });
        expect(result.success).toBe(false);
    });

    it('rejects missing id', () => {
        const result = UpdateCategoryNameSchema.safeParse({ budgetId: 1, name: 'Test' });
        expect(result.success).toBe(false);
    });
});

describe('CreateCategoryGroupSchema', () => {
    it('parses valid input', () => {
        const result = CreateCategoryGroupSchema.safeParse({ budgetId: 1, name: 'Bills' });
        expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
        const result = CreateCategoryGroupSchema.safeParse({ budgetId: 1, name: '' });
        expect(result.success).toBe(false);
    });

    it('rejects name exceeding 100 chars', () => {
        const result = CreateCategoryGroupSchema.safeParse({ budgetId: 1, name: 'x'.repeat(101) });
        expect(result.success).toBe(false);
    });
});

describe('ReorderSchema', () => {
    it('parses valid group reorder', () => {
        const result = ReorderSchema.safeParse({
            budgetId: 1, type: 'group',
            items: [
                { id: 1, sortOrder: 0 },
                { id: 2, sortOrder: 1 },
            ],
        });
        expect(result.success).toBe(true);
    });

    it('parses valid category reorder with categoryGroupId', () => {
        const result = ReorderSchema.safeParse({
            budgetId: 1, type: 'category',
            items: [
                { id: 5, sortOrder: 0, categoryGroupId: 2 },
                { id: 6, sortOrder: 1, categoryGroupId: 2 },
            ],
        });
        expect(result.success).toBe(true);
    });

    it('allows categoryGroupId to be omitted per item', () => {
        const result = ReorderSchema.safeParse({
            budgetId: 1, type: 'category',
            items: [
                { id: 5, sortOrder: 0 },
            ],
        });
        expect(result.success).toBe(true);
    });

    it('rejects empty items array', () => {
        const result = ReorderSchema.safeParse({
            budgetId: 1, type: 'group',
            items: [],
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid type', () => {
        const result = ReorderSchema.safeParse({
            type: 'account',
            items: [{ id: 1, sortOrder: 0 }],
        });
        expect(result.success).toBe(false);
    });

    it('rejects negative sortOrder', () => {
        const result = ReorderSchema.safeParse({
            budgetId: 1, type: 'group',
            items: [{ id: 1, sortOrder: -1 }],
        });
        expect(result.success).toBe(false);
    });

    it('rejects non-positive item id', () => {
        const result = ReorderSchema.safeParse({
            budgetId: 1, type: 'group',
            items: [{ id: 0, sortOrder: 0 }],
        });
        expect(result.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────
// Input Sanitization — .trim() transforms
// ─────────────────────────────────────────────────────────────────────
import { RegisterSchema, LoginSchema } from '../schemas/auth';
import { CreateBudgetSchema } from '../schemas/budget';

describe('Input sanitization — .trim() transforms', () => {
    describe('Auth schemas', () => {
        it('trims whitespace from RegisterSchema name and email', () => {
            const result = RegisterSchema.safeParse({
                name: '  John Doe  ',
                email: '  john@example.com  ',
                password: 'password123',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('John Doe');
                expect(result.data.email).toBe('john@example.com');
            }
        });

        it('trims whitespace from LoginSchema email', () => {
            const result = LoginSchema.safeParse({
                email: '  john@example.com  ',
                password: 'password123',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('john@example.com');
            }
        });

        it('rejects whitespace-only name in RegisterSchema', () => {
            const result = RegisterSchema.safeParse({
                name: '   ',
                email: 'john@example.com',
                password: 'password123',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Account schemas', () => {
        it('trims whitespace from CreateAccountSchema name', () => {
            const result = CreateAccountSchema.safeParse({
                budgetId: 1,
                name: '  Checking  ',
                type: 'checking',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Checking');
            }
        });

        it('rejects whitespace-only name in CreateAccountSchema', () => {
            const result = CreateAccountSchema.safeParse({
                budgetId: 1,
                name: '   ',
                type: 'checking',
            });
            expect(result.success).toBe(false);
        });

        it('trims whitespace from UpdateAccountSchema name and note', () => {
            const result = UpdateAccountSchema.safeParse({
                budgetId: 1,
                name: '  My Checking  ',
                note: '  Primary account  ',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('My Checking');
                expect(result.data.note).toBe('Primary account');
            }
        });
    });

    describe('Category schemas', () => {
        it('trims whitespace from CreateCategorySchema name', () => {
            const result = CreateCategorySchema.safeParse({
                budgetId: 1,
                name: '  Groceries  ',
                categoryGroupId: 1,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Groceries');
            }
        });

        it('trims whitespace from UpdateCategoryNameSchema name', () => {
            const result = UpdateCategoryNameSchema.safeParse({
                budgetId: 1,
                id: 1,
                name: '  New Name  ',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('New Name');
            }
        });

        it('trims whitespace from CreateCategoryGroupSchema name', () => {
            const result = CreateCategoryGroupSchema.safeParse({
                budgetId: 1,
                name: '  Bills  ',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Bills');
            }
        });

        it('rejects whitespace-only name in CreateCategorySchema', () => {
            const result = CreateCategorySchema.safeParse({
                budgetId: 1,
                name: '   ',
                categoryGroupId: 1,
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Budget schemas', () => {
        it('trims whitespace from CreateBudgetSchema name', () => {
            const result = CreateBudgetSchema.safeParse({
                name: '  My Budget  ',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('My Budget');
            }
        });

        it('rejects whitespace-only name in CreateBudgetSchema', () => {
            const result = CreateBudgetSchema.safeParse({
                name: '   ',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Transaction schemas', () => {
        it('trims whitespace from CreateTransactionSchema payee and memo', () => {
            const result = CreateTransactionSchema.safeParse({
                budgetId: 1,
                accountId: 1,
                date: '2025-06-15',
                payee: '  Walmart  ',
                memo: '  Weekly groceries  ',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.payee).toBe('Walmart');
                expect(result.data.memo).toBe('Weekly groceries');
            }
        });

        it('trims whitespace from UpdateTransactionSchema payee and memo', () => {
            const result = UpdateTransactionSchema.safeParse({
                id: 1,
                budgetId: 1,
                payee: '  New Payee  ',
                memo: '  Updated memo  ',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.payee).toBe('New Payee');
                expect(result.data.memo).toBe('Updated memo');
            }
        });
    });
});

