/**
 * Budget activity calculation — pure logic.
 *
 * Simple formula: available = carryforward + assigned + activity
 *
 * All values are Milliunits (integers).
 */
import type { Milliunit } from './primitives';

/**
 * Compute the `available` value for a budget category in a given month.
 *
 * This is the core cumulative formula used by `updateBudgetActivity`.
 */
export function calculateBudgetAvailable(
    carryforward: Milliunit,
    assigned: Milliunit,
    activity: Milliunit
): Milliunit {
    return (carryforward + assigned + activity) as Milliunit;
}
