/**
 * Credit Card Payment calculation — pure logic.
 *
 * Computes the CC Payment category's activity and available
 * based on funded spending across categories and CC payments.
 *
 * See MEMORY[03-credit-card-rta-logic.md] for the full specification.
 *
 * All monetary values are Milliunits (integers).
 */
import type { CategorySpending, CCPaymentInput, CCPaymentResult } from './types';
import type { Milliunit } from './primitives';
import { ZERO } from './primitives';

/**
 * Calculate the funded amount for a single category's CC spending.
 *
 * Rules:
 * - Net refund (≤ 0): fully "funded" (money moves back FROM CC Payment TO category)
 * - Net spending (> 0): only the funded portion moves to CC Payment
 *     funded = MIN(MAX(0, availableBefore), netSpending)
 *
 * @param netSpending     outflow − inflow for this category on the CC (Milliunits)
 * @param currentAvailable  the category's current `available` (already reduced by this spending)
 */
export function calculateFundedAmount(
    netSpending: Milliunit,
    currentAvailable: Milliunit
): Milliunit {
    if (netSpending <= 0) {
        // Net refund/return → moves money back from CC Payment
        return netSpending;
    }

    // Reconstruct the available balance BEFORE the spending happened
    const availableBefore = currentAvailable + netSpending;

    // Only the funded portion moves to CC Payment
    return Math.min(Math.max(0, availableBefore), netSpending) as Milliunit;
}

/**
 * Calculate the total funded spending across all categories for a CC account.
 */
export function calculateTotalFundedSpending(
    spending: CategorySpending[],
    categoryAvailables: Map<number, Milliunit>
): Milliunit {
    let total = 0;

    for (const catSpend of spending) {
        const netSpending = (catSpend.outflow - catSpend.inflow) as Milliunit;
        const currentAvailable = categoryAvailables.get(catSpend.categoryId) ?? ZERO;
        total += calculateFundedAmount(netSpending, currentAvailable);
    }

    return total as Milliunit;
}

/**
 * Calculate a CC Payment category's activity and available for one month.
 *
 * Formula:
 *   activity = fundedSpending − ccPayments
 *   available = carryforward + assigned + activity
 */
export function calculateCCPaymentAvailable(input: CCPaymentInput): CCPaymentResult {
    const { spending, categoryAvailables, carryforward, assigned, payments } = input;

    const fundedSpending = calculateTotalFundedSpending(spending, categoryAvailables);
    const activity = (fundedSpending - payments) as Milliunit;
    const available = (carryforward + assigned + activity) as Milliunit;

    return { activity, available, fundedSpending };
}
