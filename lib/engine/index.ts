/**
 * Financial Engine — barrel export.
 *
 * Pure TypeScript library with zero database dependencies.
 * All functions receive plain data and return computed results.
 * All monetary values use the Milliunit branded type (1/1000th of a currency unit).
 */

// Primitives
export type { Milliunit } from './primitives';
export {
    toMilliunits,
    fromMilliunits,
    milliunit,
    unsafeMilliunit,
    ZERO,
    addMilliunits,
    subMilliunits,
    negMilliunits,
    absMilliunits,
    minMilliunits,
    maxMilliunits,
    signMilliunits,
    sumMilliunits,
    multiplyMilliunits,
    divideMilliunits,
} from './primitives';

// Types
export type {
    CategoryBudget,
    CategorySpending,
    OverspendingInput,
    RTAInputs,
    RTABreakdownInputs,
    RTABreakdown,
    AssignmentInput,
    AssignmentResult,
    ValidationResult,
    CCPaymentInput,
    CCPaymentResult,
    OverspendingType,
} from './types';

// Carryforward
export { computeCarryforward } from './carryforward';

// RTA
export { calculateRTA } from './rta';

// RTA Breakdown
export { calculateRTABreakdown } from './rta-breakdown';

// Assignment
export {
    parseLocaleNumber,
    MAX_ASSIGNED_VALUE,
    validateAssignment,
    calculateAssignment,
} from './assignment';

// CC Payment
export {
    calculateFundedAmount,
    calculateTotalFundedSpending,
    calculateCCPaymentAvailable,
} from './cc-payment';

// Overspending
export {
    calculateCashOverspending,
    classifyOverspending,
} from './overspending';

// Activity
export { calculateBudgetAvailable } from './activity';

// Clock
export {
    getCurrentMonth,
    isPastMonth,
    isCurrentMonth,
    isFutureMonth,
} from './clock';
