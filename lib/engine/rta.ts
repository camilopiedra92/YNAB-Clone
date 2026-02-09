/**
 * Ready to Assign (RTA) calculation — pure logic.
 *
 * See MEMORY[02-ready-to-assign-calculation.md] for the full specification.
 *
 * All values are Milliunits (integers).
 */
import type { RTAInputs } from './types';
import type { Milliunit } from './primitives';
import { ZERO } from './primitives';

/**
 * Calculate Ready to Assign for a given viewed month.
 *
 * Formula:
 *   RTA = cashBalance + positiveCCBalances − totalAvailable − futureAssigned − creditOverspending
 *
 * Where:
 *   creditOverspending = totalOverspending − cashOverspending
 *
 * Past-month clamping: if RTA < 0 and viewedMonth < currentMonth → 0.
 */
export function calculateRTA(inputs: RTAInputs): Milliunit {
    const {
        cashBalance,
        positiveCCBalances,
        totalAvailable,
        futureAssigned,
        totalOverspending,
        cashOverspending,
        currentMonth,
        viewedMonth,
    } = inputs;

    let rta = cashBalance + positiveCCBalances - totalAvailable;

    // Subtract future assigned (months beyond latest complete, up to viewed month)
    rta -= futureAssigned;

    // Credit overspending correction
    const creditOverspending = totalOverspending - cashOverspending;
    rta -= creditOverspending;

    // Past months always show 0 — RTA is cumulative and only applies to current/future months
    if (viewedMonth < currentMonth) {
        return ZERO;
    }

    return rta as Milliunit;
}
