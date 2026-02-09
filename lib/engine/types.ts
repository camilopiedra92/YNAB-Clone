/**
 * Shared type definitions for the financial engine.
 *
 * All monetary values use the `Milliunit` branded type (1/1000th of a currency unit).
 * Non-monetary values (IDs, booleans, strings) remain plain types.
 *
 * These types are plain data interfaces — no database, no ORM, no environment deps.
 */
import type { Milliunit } from './primitives';

// ──────────────────────────────────────────────────────────────────────
// Budget & Category primitives
// ──────────────────────────────────────────────────────────────────────

/** A single category's budget data for one month (what the DB stores in `budget_months`). */
export interface CategoryBudget {
    categoryId: number;
    month: string;
    assigned: Milliunit;
    activity: Milliunit;
    available: Milliunit;
    linkedAccountId: number | null;
}

/** Per-category spending on a specific credit card for one month. */
export interface CategorySpending {
    categoryId: number;
    outflow: Milliunit;
    inflow: Milliunit;
}

/** Input for per-category overspending classification. */
export interface OverspendingInput {
    categoryId: number;
    available: Milliunit;
    linkedAccountId: number | null;
    /** Net cash spending (outflow − inflow) from non-credit accounts, clamped ≥ 0. */
    cashSpending: Milliunit;
}

// ──────────────────────────────────────────────────────────────────────
// Ready to Assign (RTA)
// ──────────────────────────────────────────────────────────────────────

/** All pre-queried data needed to compute RTA for a single viewed month. */
export interface RTAInputs {
    /** Net balance of all non-credit budget accounts (transactions ≤ today). */
    cashBalance: Milliunit;
    /** Sum of positive per-CC-account balances (cashback/overpayments). */
    positiveCCBalances: Milliunit;
    /** Sum of `available` for all non-income categories in the latest complete month. */
    totalAvailable: Milliunit;
    /** Sum of `assigned` in months > latestCompleteMonth AND ≤ viewedMonth. */
    futureAssigned: Milliunit;
    /** Sum of ABS(available) for overspent regular (non-CC-payment, non-income) categories. */
    totalOverspending: Milliunit;
    /** Cash portion of overspending (from non-credit-account transactions). */
    cashOverspending: Milliunit;
    /** YYYY-MM string of the current calendar month (for past-month clamping). */
    currentMonth: string;
    /** YYYY-MM string of the month the user is viewing. */
    viewedMonth: string;
}

/** All pre-queried data needed to compute the RTA breakdown popup. */
export interface RTABreakdownInputs {
    /** The already-calculated RTA for the viewed month. */
    rta: Milliunit;
    /** Income inflow in the viewed month on cash accounts. */
    inflowThisMonth: Milliunit;
    /** Positive CC balances (same as in RTAInputs). */
    positiveCCBalances: Milliunit;
    /** Total assigned to non-income categories in the viewed month. */
    assignedThisMonth: Milliunit;
    /** Cash overspending from the PREVIOUS month (the "leak"). */
    cashOverspendingPreviousMonth: Milliunit;
    /** Total assigned in months beyond the viewed month. */
    assignedInFuture: Milliunit;
}

/** Output of the RTA breakdown calculation. */
export interface RTABreakdown {
    readyToAssign: Milliunit;
    leftOverFromPreviousMonth: Milliunit;
    inflowThisMonth: Milliunit;
    positiveCCBalances: Milliunit;
    cashOverspendingPreviousMonth: Milliunit;
    assignedThisMonth: Milliunit;
    assignedInFuture: Milliunit;
}

// ──────────────────────────────────────────────────────────────────────
// Budget Assignment
// ──────────────────────────────────────────────────────────────────────

/** Input for computing the result of a budget assignment change. */
export interface AssignmentInput {
    /** Current row from budget_months, or null if no row exists. */
    existing: { assigned: Milliunit; available: Milliunit } | null;
    /** Carryforward from the previous month (already computed). */
    carryforward: Milliunit;
    /** The new assigned value the user wants to set. */
    newAssigned: Milliunit;
}

/** Output describing what should happen after an assignment change. */
export interface AssignmentResult {
    /** Delta between new and old assigned (newAssigned − oldAssigned). */
    delta: Milliunit;
    /** The new `available` value for this month's budget_months row. */
    newAvailable: Milliunit;
    /** If true, the row should be deleted (ghost entry prevention). */
    shouldDelete: boolean;
    /** If true, a new row should be created (INSERT instead of UPDATE). */
    shouldCreate: boolean;
    /** If true, the operation should be skipped entirely (assigned=0, no existing row). */
    shouldSkip: boolean;
}

/** Result of validating an assigned value. */
export interface ValidationResult {
    /** Whether the original value was valid (finite and within bounds). */
    valid: boolean;
    /** The value to use (clamped if necessary, 0 if non-finite). */
    clamped: Milliunit;
}

// ──────────────────────────────────────────────────────────────────────
// Credit Card Payment
// ──────────────────────────────────────────────────────────────────────

/** Input for computing a CC Payment category's activity and available. */
export interface CCPaymentInput {
    /** Per-category spending summed from transactions on this CC account. */
    spending: CategorySpending[];
    /** Map of categoryId → current available (from budget_months). */
    categoryAvailables: Map<number, Milliunit>;
    /** Previous month's CC Payment available (the debt carryforward). */
    carryforward: Milliunit;
    /** User-assigned amount to the CC Payment category this month. */
    assigned: Milliunit;
    /** Total CC payments (inflows with category_id IS NULL) this month. */
    payments: Milliunit;
}

/** Output of the CC Payment calculation. */
export interface CCPaymentResult {
    /** Net activity = fundedSpending − ccPayments. */
    activity: Milliunit;
    /** Total available for payment = carryforward + assigned + activity. */
    available: Milliunit;
    /** The funded spending component (sum of funded portions per category). */
    fundedSpending: Milliunit;
}

// ──────────────────────────────────────────────────────────────────────
// Overspending Classification
// ──────────────────────────────────────────────────────────────────────

export type OverspendingType = 'cash' | 'credit' | null;
