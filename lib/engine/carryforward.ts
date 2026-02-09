/**
 * Carryforward calculation — pure logic.
 *
 * Determines how much "available" carries from the previous month
 * into the current month for a given category.
 *
 * All values are Milliunits (integers).
 */
import type { Milliunit } from './primitives';
import { ZERO } from './primitives';

/**
 * Compute the carryforward for a category from the previous month.
 *
 * Rules:
 * - null/0 → 0  (nothing to carry)
 * - positive → value (surplus carries forward)
 * - negative + CC Payment → value (debt carries forward)
 * - negative + regular → 0 (both cash and credit overspending reset at month boundary)
 *
 * @param prevAvailable  The category's `available` in the previous month, or null if none.
 * @param isCCPaymentCategory  True if the category is linked to a credit card account.
 */
export function computeCarryforward(
    prevAvailable: Milliunit | null,
    isCCPaymentCategory: boolean
): Milliunit {
    if (prevAvailable === null || prevAvailable === 0) return ZERO;
    if (prevAvailable > 0) return prevAvailable;

    // Negative available: only CC Payment categories carry forward debt
    if (isCCPaymentCategory) {
        return prevAvailable;
    }

    // Regular category: ALL overspending resets to 0 at month rollover
    return ZERO;
}
