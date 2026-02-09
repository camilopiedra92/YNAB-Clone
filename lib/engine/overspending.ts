/**
 * Overspending detection and classification — pure logic.
 *
 * Determines whether category overspending is cash-based (red) or credit-based (yellow).
 * See MEMORY[02-ready-to-assign-calculation.md] §5 and MEMORY[03-credit-card-rta-logic.md] §8.
 *
 * All monetary values are Milliunits (integers).
 */
import type { OverspendingInput, OverspendingType } from './types';
import { type Milliunit } from './primitives';

/**
 * Compute total cash overspending across multiple categories.
 *
 * For each overspent category:
 *   cashOverspending = MIN(|available|, cashSpending)
 *
 * @param categories  Array of overspent regular (non-CC-payment, non-income) categories.
 */
export function calculateCashOverspending(categories: OverspendingInput[]): Milliunit {
    let total = 0;

    for (const cat of categories) {
        if (cat.available >= 0) continue; // Not overspent
        if (cat.linkedAccountId !== null) continue; // CC Payment category — skip

        const totalOverspent = Math.abs(cat.available);
        const cashOverspending = Math.min(totalOverspent, cat.cashSpending);
        total += cashOverspending;
    }

    return total as Milliunit;
}

/**
 * Classify a single category's overspending type.
 *
 * Rules:
 * - available ≥ 0 → null (not overspent)
 * - linked to CC account → 'credit' (CC Payment underfunding)
 * - pure cash overspending → 'cash' (red)
 * - pure credit overspending → 'credit' (yellow)
 * - mixed → 'cash' takes priority (more urgent for UI)
 */
export function classifyOverspending(input: OverspendingInput): OverspendingType {
    if (input.available >= 0) return null;

    // CC Payment categories always classify as 'credit'
    if (input.linkedAccountId !== null) return 'credit';

    const totalOverspent = Math.abs(input.available);
    const cashOverspending = Math.min(totalOverspent, input.cashSpending);

    // cashOverspending + creditOverspending = totalOverspent > 0 (guaranteed by line above),
    // so at least one must be > 0. Cash takes priority (more urgent for UI).
    if (cashOverspending > 0) return 'cash';
    return 'credit';
}
