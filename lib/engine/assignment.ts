/**
 * Budget assignment calculation — pure logic.
 *
 * Handles validation, delta computation, ghost entry detection,
 * and locale-aware number parsing.
 *
 * All monetary values are Milliunits (integers).
 */
import type { AssignmentInput, AssignmentResult, ValidationResult } from './types';
import type { Milliunit } from './primitives';
import { ZERO } from './primitives';

/** Safety cap: 100 billion (in milliunits = 100_000_000_000_000). */
export const MAX_ASSIGNED_VALUE: Milliunit = 100_000_000_000_000 as Milliunit;

/**
 * Locale-aware number parser.
 *
 * Handles European (1.234,56) and US (1,234.56) formats.
 * Returns a DECIMAL number (not milliunits) — the caller must convert.
 *
 * Returns 0 for unparseable or non-finite values.
 */
export function parseLocaleNumber(value: string): number {
    let clean = value.replace(/[^\d.,-]/g, '');

    if (/,\d{1,2}$/.test(clean)) {
        // European: comma as decimal separator (e.g., "1.234,56")
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
        const dotCount = (clean.match(/\./g) || []).length;
        if (dotCount > 1) {
            // Multiple dots → treat dots as thousands, comma as decimal
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (dotCount === 1 && /\.\d{3}/.test(clean)) {
            // Single dot followed by 3 digits → thousands separator
            clean = clean.replace('.', '');
        }
    }

    const result = parseFloat(clean);
    return isFinite(result) ? result : 0;
}

/**
 * Validate an assigned value (in milliunits).
 *
 * - Non-finite → invalid, clamped to 0
 * - |value| > MAX_ASSIGNED_VALUE → valid but clamped
 */
export function validateAssignment(value: Milliunit): ValidationResult {
    if (!isFinite(value)) {
        return { valid: false, clamped: ZERO };
    }

    if (Math.abs(value) > MAX_ASSIGNED_VALUE) {
        return { valid: true, clamped: (Math.sign(value) * MAX_ASSIGNED_VALUE) as Milliunit };
    }

    return { valid: true, clamped: value };
}

/**
 * Compute the result of changing a budget assignment.
 *
 * Determines:
 * - The delta between old and new assigned
 * - The new available value
 * - Whether the row should be deleted (ghost prevention)
 * - Whether a new row should be created (INSERT vs UPDATE)
 * - Whether the operation should be skipped entirely
 */
export function calculateAssignment(input: AssignmentInput): AssignmentResult {
    const { existing, carryforward, newAssigned } = input;

    if (existing) {
        const oldAssigned = existing.assigned;
        const delta = (newAssigned - oldAssigned) as Milliunit;
        const newAvailable = (existing.available + delta) as Milliunit;

        // Ghost entry detection: if the row becomes all zeros, it should be deleted
        const activity = existing.available - existing.assigned - carryforward;
        const shouldDelete = newAssigned === 0 && activity === 0 && newAvailable === 0;

        return {
            delta,
            newAvailable,
            shouldDelete,
            shouldCreate: false,
            shouldSkip: false,
        };
    }

    // No existing row
    if (newAssigned === 0) {
        // Don't create ghost entries
        return {
            delta: ZERO,
            newAvailable: ZERO,
            shouldDelete: false,
            shouldCreate: false,
            shouldSkip: true,
        };
    }

    // Create new row
    return {
        delta: newAssigned,
        newAvailable: (carryforward + newAssigned) as Milliunit,
        shouldDelete: false,
        shouldCreate: true,
        shouldSkip: false,
    };
}
