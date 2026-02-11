import { z } from 'zod';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_ASSIGNED = 100_000_000_000; // 100 billion safety cap

export const BudgetAssignmentSchema = z.object({
    budgetId: z.number().int().positive('budgetId must be a positive integer'),
    categoryId: z.number().int().positive('categoryId must be a positive integer'),
    month: z.string().regex(MONTH_REGEX, 'month must be in YYYY-MM format'),
    assigned: z
        .number({ message: 'assigned is required and must be a number' })
        .finite('assigned must be a finite number')
        .refine((v) => Math.abs(v) <= MAX_ASSIGNED, {
            message: `assigned value exceeds maximum allowed (${MAX_ASSIGNED})`,
        }),
});

export type BudgetAssignmentInput = z.infer<typeof BudgetAssignmentSchema>;

export const CreateBudgetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  currencyCode: z.string().min(1).max(10).default('COP'),
  currencySymbol: z.string().min(1).max(5).default('$'),
  currencyDecimals: z.number().int().min(0).max(5).default(0),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;

export const AddShareSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  role: z.enum(['editor', 'viewer']).default('editor'),
});

export type AddShareInput = z.infer<typeof AddShareSchema>;

export const UpdateShareRoleSchema = z.object({
  role: z.enum(['editor', 'viewer']),
});

export type UpdateShareRoleInput = z.infer<typeof UpdateShareRoleSchema>;
