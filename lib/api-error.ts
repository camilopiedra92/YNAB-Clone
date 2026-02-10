import { NextResponse } from 'next/server';

/**
 * Standardized API error response.
 *
 * Every error returned from an API route MUST use this helper
 * to ensure a consistent shape:
 *
 * ```json
 * { "error": "Human-readable message", "status": 400 }
 * ```
 *
 * Optional `details` field for validation errors:
 *
 * ```json
 * { "error": "Validation failed", "status": 400, "details": { "name": ["required"] } }
 * ```
 */
export function apiError(
    message: string,
    status: number,
    details?: Record<string, string[]>,
): NextResponse {
    const body: { error: string; status: number; details?: Record<string, string[]> } = {
        error: message,
        status,
    };
    if (details) body.details = details;
    return NextResponse.json(body, { status });
}
