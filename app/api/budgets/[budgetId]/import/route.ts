import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { withBudgetAccess } from '@/lib/with-budget-access';
import { importDataFromCSV } from '@/lib/data-import';
import { importLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ budgetId: string }> };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
    request: Request,
    { params }: RouteContext
) {
    try {
        // Rate limiting — imports are expensive operations
        const ip = getClientIP(request);
        const limit = await importLimiter.check(ip);
        if (!limit.success) return rateLimitResponse(limit);
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, _repos) => {
            const formData = await request.formData();

            const registerFile = formData.get('register') as File | null;
            const planFile = formData.get('plan') as File | null;

            if (!registerFile || !planFile) {
                return apiError('Both "register" and "plan" CSV files are required', 400);
            }

            // Validate file sizes
            if (registerFile.size > MAX_FILE_SIZE || planFile.size > MAX_FILE_SIZE) {
                return apiError(`Each file must be under ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
            }

            // Read file contents as text
            const registerCSV = await registerFile.text();
            const planCSV = await planFile.text();

            // Import data into the budget
            // Note: importDataFromCSV uses its own db connection - may need transaction support later
            const { default: db } = await import('@/lib/db/client');
            const stats = await importDataFromCSV(budgetId, registerCSV, planCSV, db);

            return NextResponse.json({
                success: true,
                stats,
            });
        });
    } catch (error) {
        logger.error('Error importing data:', error);
        return apiError('Failed to import data. Please check your CSV files.', 500);
    }
}
