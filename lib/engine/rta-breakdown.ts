/**
 * RTA Breakdown calculation — pure logic.
 *
 * Matches YNAB's web-only "Ready to Assign Breakdown" popup.
 *
 * All values are Milliunits (integers).
 */
import type { RTABreakdownInputs, RTABreakdown } from './types';
import type { Milliunit } from './primitives';

/**
 * Calculate the RTA breakdown components.
 *
 * The `leftOver` is back-calculated from the RTA and other components:
 *   leftOver = RTA − inflowThisMonth − positiveCCBalances + assignedThisMonth + cashOverspending
 *
 * Note: assignedInFuture is informational only — NOT part of the per-month RTA equation.
 */
export function calculateRTABreakdown(inputs: RTABreakdownInputs): RTABreakdown {
    const {
        rta,
        inflowThisMonth,
        positiveCCBalances,
        assignedThisMonth,
        cashOverspendingPreviousMonth,
        assignedInFuture,
    } = inputs;

    const leftOver = (rta
        - inflowThisMonth
        - positiveCCBalances
        + assignedThisMonth
        + cashOverspendingPreviousMonth) as Milliunit;

    return {
        readyToAssign: rta,
        leftOverFromPreviousMonth: leftOver,
        inflowThisMonth,
        positiveCCBalances,
        cashOverspendingPreviousMonth,
        assignedThisMonth,
        assignedInFuture,
    };
}
