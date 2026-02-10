/**
 * Example: Zod validation schemas for API input.
 *
 * - Use camelCase keys (matching the API contract)
 * - Export both the schema and the inferred type
 * - Re-export from lib/schemas/index.ts barrel
 */
import { z } from 'zod';

export const CreateGoalSchema = z.object({
  categoryId: z.number().int().positive('categoryId is required'),
  targetAmount: z.number().min(0, 'Target amount must be non-negative'),
  targetDate: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format').optional(),
});

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = z.object({
  id: z.number().int().positive(),
  targetAmount: z.number().min(0).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
});

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;
