import { NextResponse } from 'next/server';
import { getBudgetForMonth, getReadyToAssign, getReadyToAssignBreakdown, getOverspendingTypes, getBudgetInspectorData, refreshAllBudgetActivity } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

        // Refresh stale activity values from scheduled transactions that are now current
        refreshAllBudgetActivity(month);

        const budget = getBudgetForMonth(month);
        const readyToAssign = getReadyToAssign(month);
        const rtaBreakdown = getReadyToAssignBreakdown(month);
        const overspendingTypes = getOverspendingTypes(month);
        const inspectorData = getBudgetInspectorData(month);
        return NextResponse.json({ budget, readyToAssign, rtaBreakdown, overspendingTypes, inspectorData });
    } catch (error) {
        console.error('Error fetching budget:', error);
        return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { categoryId, month, assigned } = body;

        // Server-side validation
        if (!categoryId || !month || typeof assigned !== 'number') {
            return NextResponse.json(
                { error: 'Missing or invalid fields: categoryId, month, assigned required' },
                { status: 400 }
            );
        }

        if (!isFinite(assigned)) {
            return NextResponse.json(
                { error: 'Assigned value must be a finite number' },
                { status: 400 }
            );
        }

        const MAX_ASSIGNED = 100_000_000_000; // 100 billion safety cap
        if (Math.abs(assigned) > MAX_ASSIGNED) {
            return NextResponse.json(
                { error: `Assigned value exceeds maximum allowed (${MAX_ASSIGNED})` },
                { status: 400 }
            );
        }

        const { updateBudgetAssignment } = await import('@/lib/db');
        updateBudgetAssignment(categoryId, month, assigned);

        // Return the full recalculated budget data so the client can
        // immediately update its cache with accurate server-calculated values
        // (especially RTA, which depends on cumulative cross-month data).
        const budget = getBudgetForMonth(month);
        const readyToAssign = getReadyToAssign(month);
        const rtaBreakdown = getReadyToAssignBreakdown(month);
        const overspendingTypes = getOverspendingTypes(month);
        const inspectorData = getBudgetInspectorData(month);

        return NextResponse.json({ success: true, budget, readyToAssign, rtaBreakdown, overspendingTypes, inspectorData });
    } catch (error) {
        console.error('Error updating budget:', error);
        return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
    }
}
