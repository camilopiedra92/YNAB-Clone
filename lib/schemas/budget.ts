import { z } from 'zod';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_ASSIGNED = 100_000_000_000; // 100 billion safety cap

export const BudgetAssignmentSchema = z.object({
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
