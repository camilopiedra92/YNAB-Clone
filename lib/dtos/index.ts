/**
 * DTO Barrel — re-exports all DTOs and mapper functions.
 *
 * Part of Phase 5: Standardized DTOs.
 * Decouples DB schema from API contract.
 */
export { toAccountDTO, toReconciliationInfoDTO } from './account.dto';
export type { AccountDTO, ReconciliationInfoDTO } from './account.dto';

export { toTransactionDTO } from './transaction.dto';
export type { TransactionDTO } from './transaction.dto';

export { toBudgetItemDTO } from './budget.dto';
export type { BudgetItemDTO, BudgetResponseDTO, InspectorDataDTO } from './budget.dto';

export { toCategoryDTO, toCategoryGroupDTO } from './category.dto';
export type { CategoryDTO, CategoryGroupDTO } from './category.dto';
