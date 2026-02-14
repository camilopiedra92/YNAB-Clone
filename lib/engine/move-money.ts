/**
 * Move Money — pure validation logic.
 *
 * Validates whether a move-money operation between two categories is valid.
 * The actual orchestration (adjusting assigned values) is handled by the repo layer.
 *
 * All monetary values are Milliunits (integers).
 */
import type { MoveMoneyInput, MoveMoneyResult } from './types';
import type { Milliunit } from './primitives';
import { ZERO } from './primitives';
import { MAX_ASSIGNED_VALUE } from './assignment';

/**
 * Validate a move-money operation.
 *
 * Rules:
 * - Amount must be positive and finite
 * - Source and target must be different categories
 * - If amount > source available, returns valid=true with a warning
 *   (YNAB allows this — it creates overspending on the source)
 * - Amount is clamped to MAX_ASSIGNED_VALUE
 */
export function validateMoveMoney(input: MoveMoneyInput): MoveMoneyResult {
    const { amount, sourceAvailable, sourceCategoryId, targetCategoryId } = input;

    // Non-finite check
    if (!isFinite(amount)) {
        return { valid: false, error: 'non_finite_amount', clampedAmount: ZERO };
    }

    // Same category check
    if (sourceCategoryId === targetCategoryId) {
        return { valid: false, error: 'same_category', clampedAmount: ZERO };
    }

    // Zero check
    if (amount === 0) {
        return { valid: false, error: 'zero_amount', clampedAmount: ZERO };
    }

    // Negative check
    if (amount < 0) {
        return { valid: false, error: 'negative_amount', clampedAmount: ZERO };
    }

    // Clamp to safety cap
    const clamped = (Math.min(amount, MAX_ASSIGNED_VALUE)) as Milliunit;

    // Exceeds available — valid but warned (YNAB behavior: allows overspending the source)
    if (clamped > sourceAvailable) {
        return { valid: true, warning: 'exceeds_available', clampedAmount: clamped };
    }

    return { valid: true, clampedAmount: clamped };
}
