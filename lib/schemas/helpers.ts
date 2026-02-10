import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { apiError } from '@/lib/api-error';

/**
 * Validate a request body against a Zod schema.
 * Returns `{ success: true, data }` on valid input,
 * or `{ success: false, response }` with a 400 NextResponse on failure.
 */
export function validateBody<T>(
    schema: ZodSchema<T>,
    body: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
    const result = schema.safeParse(body);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        response: apiError('Validation failed', 400, formatZodError(result.error)),
    };
}

function formatZodError(error: ZodError): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};
    for (const issue of error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!formatted[path]) formatted[path] = [];
        formatted[path].push(issue.message);
    }
    return formatted;
}
