import { z } from 'zod';

export const CreateCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required').max(100),
    categoryGroupId: z.number().int().positive('categoryGroupId is required'),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategoryNameSchema = z.object({
    id: z.number().int().positive('Category ID is required'),
    name: z.string().min(1, 'Category name is required').max(100),
});

export type UpdateCategoryNameInput = z.infer<typeof UpdateCategoryNameSchema>;

export const CreateCategoryGroupSchema = z.object({
    name: z.string().min(1, 'Group name is required').max(100),
});

export type CreateCategoryGroupInput = z.infer<typeof CreateCategoryGroupSchema>;

const ReorderItemSchema = z.object({
    id: z.number().int().positive(),
    sortOrder: z.number().int().min(0),
    categoryGroupId: z.number().int().positive().optional(),
});

export const ReorderSchema = z.object({
    type: z.enum(['group', 'category'] as const),
    items: z.array(ReorderItemSchema).min(1, 'At least one item is required'),
});

export type ReorderInput = z.infer<typeof ReorderSchema>;
