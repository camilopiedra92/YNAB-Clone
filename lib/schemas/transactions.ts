import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Create Transaction ─────────────────────────────────────────────
export const CreateTransactionSchema = z.object({
    accountId: z.number().int().positive(),
    date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format'),
    payee: z.string().optional().default(''),
    categoryId: z.number().int().positive().nullable().optional(),
    memo: z.string().optional().default(''),
    outflow: z.number().min(0).optional().default(0),
    inflow: z.number().min(0).optional().default(0),
    cleared: z.enum(['Cleared', 'Uncleared', 'Reconciled'] as const).optional().default('Uncleared'),
    flag: z.string().nullable().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

// ─── Create Transfer ─────────────────────────────────────────────────
export const CreateTransferSchema = z.object({
    isTransfer: z.literal(true),
    accountId: z.number().int().positive(),
    transferAccountId: z.number().int().positive('Transfer destination account is required'),
    date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format'),
    outflow: z.number().positive('Transfer amount must be positive').optional(),
    amount: z.number().positive('Transfer amount must be positive').optional(),
    memo: z.string().optional().default(''),
    cleared: z.enum(['Cleared', 'Uncleared', 'Reconciled'] as const).optional().default('Uncleared'),
}).refine(
    (data) => (data.outflow && data.outflow > 0) || (data.amount && data.amount > 0),
    { message: 'Transfer amount must be positive', path: ['amount'] }
);

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;

// ─── Update Transaction ──────────────────────────────────────────────
export const UpdateTransactionSchema = z.object({
    id: z.number().int().positive('Transaction ID is required'),
    date: z.string().regex(DATE_REGEX).optional(),
    payee: z.string().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    memo: z.string().optional(),
    outflow: z.number().min(0).optional(),
    inflow: z.number().min(0).optional(),
    cleared: z.enum(['Cleared', 'Uncleared', 'Reconciled'] as const).optional(),
    flag: z.string().nullable().optional(),
});

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

// ─── PATCH actions ───────────────────────────────────────────────────
export const ToggleClearedSchema = z.object({
    action: z.literal('toggle-cleared'),
    id: z.number().int().positive('Transaction ID is required'),
});

export const ReconciliationInfoSchema = z.object({
    action: z.literal('get-reconciliation-info'),
    accountId: z.number().int().positive('Account ID is required'),
});

export const ReconcileSchema = z.object({
    action: z.literal('reconcile'),
    accountId: z.number().int().positive('Account ID is required'),
    bankBalance: z.number({ message: 'Bank balance is required' }),
});

// Discriminated union for PATCH body
export const TransactionPatchSchema = z.discriminatedUnion('action', [
    ToggleClearedSchema,
    ReconciliationInfoSchema,
    ReconcileSchema,
]);

export type TransactionPatchInput = z.infer<typeof TransactionPatchSchema>;
