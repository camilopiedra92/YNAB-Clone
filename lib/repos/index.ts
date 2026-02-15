/**
 * lib/repos/index.ts — Production Singleton Barrel
 *
 * Creates all repository functions bound to the file-based production database
 * and exports them as named exports for direct use in API routes.
 *
 * Architecture:
 *   API Route → import from '@/lib/repos' → Repository → Engine → Repository (Write)
 */
import db from '../db/client';
import { createDbFunctions } from '../db/client';

// Re-export factory for test-helpers and advanced usage
export { createDbFunctions } from '../db/client';

// Domain repo factories (for advanced use / testing)
export { createAccountFunctions } from './accounts';
export { createTransactionFunctions } from './transactions';
export { createBudgetFunctions } from './budget';
export { createBudgetsFunctions } from './budgets';
export { createCategoryFunctions } from './categories';

// Re-export types
export type { TransactionRepoDeps, TransactionRow } from './transactions';
export type { BudgetRepoDeps, BudgetRow } from './budget';

// ====== Production singleton ======
const fns = createDbFunctions(db);

export const {
  // Account repo
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  getAccountType,
  isCreditCardAccount,
  updateAccountBalances,
  getReconciliationInfo,
  reconcileAccount,
  getPayees,
  // Transaction repo
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  toggleTransactionCleared,
  getTransferByTransactionId,
  createTransfer,
  deleteTransfer,
  // Transaction atomic composites
  createTransactionAtomic,
  updateTransactionAtomic,
  deleteTransactionAtomic,
  toggleClearedAtomic,
  reconcileAccountAtomic,
  // Budget repo
  computeCarryforward,
  getBudgetForMonth,
  getReadyToAssign,
  getReadyToAssignBreakdown,
  updateBudgetAssignment,
  updateBudgetActivity,
  refreshAllBudgetActivity,
  getCreditCardPaymentCategory,
  ensureCreditCardPaymentCategory,
  updateCreditCardPaymentBudget,
  batchUpdateAllCCPayments,
  getCashOverspendingForMonth,
  getOverspendingTypes,
  getOverspendingData,
  getBudgetInspectorData,
  getMonthRange,
  // Category repo
  getCategoryGroups,
  getCategories,
  getCategoriesWithGroups,
  updateCategoryName,
  updateCategoryGroupOrder,
  updateCategoryOrder,
  createCategoryGroup,
  createCategory,
  // Budgets (Entity) repo
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  getShares,
  addShare,
  updateShareRole,
  removeShare,
  // User repo
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  updatePassword,
  updateLocale,
} = fns;

