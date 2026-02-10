import { z } from 'zod';

export const CreateAccountSchema = z.object({
    budgetId: z.number().int().positive('budgetId is required'),
    name: z.string().trim().min(1, 'Account name is required').max(100),
    type: z.enum(['checking', 'savings', 'cash', 'credit', 'tracking'] as const, {
        message: 'Account type is required',
    }),
    balance: z.number().optional().default(0),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = z.object({
    budgetId: z.number().int().positive('budgetId is required'),
    name: z.string().trim().min(1).max(100).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    closed: z.boolean().optional(),
});

export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

