import { describe, it, expect } from 'vitest';
import { toAccountDTO, toReconciliationInfoDTO } from '../dtos/account.dto';
import type { ReconciliationInfo } from '../repos/accounts';
import { toTransactionDTO } from '../dtos/transaction.dto';
import { toBudgetItemDTO } from '../dtos/budget.dto';
import { toCategoryDTO, toCategoryGroupDTO } from '../dtos/category.dto';
import { toShareDTO, toShareInfoDTO } from '../dtos/share.dto';
import type { BudgetShareInfo } from '../repos/budgets';
import type { Milliunit } from '../engine/primitives';

describe('Account DTOs', () => {
  describe('toAccountDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        id: 1, budgetId: 1,
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        clearedBalance: 80000,
        unclearedBalance: 20000,
        note: 'My checking',
        closed: 0,
      };

      const dto = toAccountDTO(row);

      expect(dto).toEqual({
        id: 1, budgetId: 1,
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        clearedBalance: 80000,
        unclearedBalance: 20000,
        note: 'My checking',
        closed: false,
      });
    });

    it('coerces closed=1 to boolean true', () => {
      const row = { id: 2, budgetId: 1, name: 'Old', type: 'savings', balance: 0, clearedBalance: 0, unclearedBalance: 0, note: null, closed: 1 };
      expect(toAccountDTO(row).closed).toBe(true);
    });

    it('defaults missing fields', () => {
      const row = { id: 3, budgetId: 1, name: 'Minimal', type: 'cash' };
      const dto = toAccountDTO(row);
      expect(dto.balance).toBe(0);
      expect(dto.clearedBalance).toBe(0);
      expect(dto.unclearedBalance).toBe(0);
      expect(dto.note).toBeNull();
      expect(dto.closed).toBe(false);
    });
  });

  describe('toReconciliationInfoDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        clearedBalance: 500000,
        reconciledBalance: 400000,
        pendingClearedBalance: 100000,
        pendingClearedCount: 5,
      };

      const dto = toReconciliationInfoDTO(row);

      expect(dto).toEqual({
        clearedBalance: 500000,
        reconciledBalance: 400000,
        pendingClearedBalance: 100000,
        pendingClearedCount: 5,
      });
    });

    it('defaults missing fields to 0', () => {
      const dto = toReconciliationInfoDTO({} as ReconciliationInfo);
      expect(dto.clearedBalance).toBe(0);
      expect(dto.reconciledBalance).toBe(0);
      expect(dto.pendingClearedBalance).toBe(0);
      expect(dto.pendingClearedCount).toBe(0);
    });
  });
});

describe('Transaction DTOs', () => {
  describe('toTransactionDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        id: 42,
        budgetId: 1,
        accountId: 1,
        accountName: 'Checking',
        date: '2025-12-15',
        payee: 'Grocery Store',
        categoryId: 10,
        categoryName: 'Groceries',
        memo: 'Weekly groceries',
        outflow: 150000,
        inflow: 0,
        cleared: 'Cleared',
        transferId: null,
        transferAccountId: null,
        transferAccountName: null,
        isFuture: 0,
        flag: null,
      };

      const dto = toTransactionDTO(row);

      expect(dto).toEqual({
        id: 42,
        budgetId: 1,
        accountId: 1,
        accountName: 'Checking',
        date: '2025-12-15',
        payee: 'Grocery Store',
        categoryId: 10,
        categoryName: 'Groceries',
        memo: 'Weekly groceries',
        outflow: 150000,
        inflow: 0,
        cleared: 'Cleared',
        transferId: null,
        transferAccountId: null,
        transferAccountName: null,
        isFuture: false,
        flag: null,
      });
    });

    it('coerces isFuture=1 to boolean true', () => {
      const row = {
        id: 43,
        budgetId: 1,
        accountId: 1,
        accountName: 'Checking',
        date: '2026-06-01',
        payee: 'Future Payment',
        categoryId: null,
        memo: '',
        outflow: 0,
        inflow: 100000,
        cleared: 'Uncleared',
        isFuture: 1,
      };
      expect(toTransactionDTO(row).isFuture).toBe(true);
    });

    it('handles transfer transactions', () => {
      const row = {
        id: 44,
        budgetId: 1,
        accountId: 1,
        accountName: 'Checking',
        date: '2025-12-20',
        payee: 'Transfer',
        categoryId: null,
        memo: '',
        outflow: 500000,
        inflow: 0,
        cleared: 'Cleared',
        transferId: 45,
        transferAccountId: 2,
        transferAccountName: 'Savings',
        isFuture: 0,
      };

      const dto = toTransactionDTO(row);
      expect(dto.transferId).toBe(45);
      expect(dto.transferAccountId).toBe(2);
      expect(dto.transferAccountName).toBe('Savings');
    });

    it('defaults missing fields', () => {
      const row = { id: 99, budgetId: 1, accountId: 1, date: '2025-01-01', cleared: 'Uncleared' };
      const dto = toTransactionDTO(row);
      expect(dto.accountName).toBe('');
      expect(dto.payee).toBe('');
      expect(dto.categoryId).toBeNull();
      expect(dto.categoryName).toBeNull();
      expect(dto.memo).toBe('');
      expect(dto.outflow).toBe(0);
      expect(dto.inflow).toBe(0);
      expect(dto.transferId).toBeNull();
      expect(dto.transferAccountId).toBeNull();
      expect(dto.transferAccountName).toBeNull();
      expect(dto.isFuture).toBe(false);
      expect(dto.flag).toBeNull();
    });

    it('defaults cleared to Uncleared when missing', () => {
      const row = { id: 100, budgetId: 1, accountId: 1, date: '2025-01-01' }; // no cleared field
      const dto = toTransactionDTO(row);
      expect(dto.cleared).toBe('Uncleared');
    });

    it('throws when row is undefined', () => {
      expect(() => toTransactionDTO(undefined)).toThrow('Transaction not found');
    });
  });
});

describe('Budget DTOs', () => {
  describe('toBudgetItemDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        id: 100,
        categoryId: 5,
        categoryName: 'Groceries',
        groupName: 'Everyday Expenses',
        categoryGroupId: 2,
        groupHidden: 0,
        month: '2025-12',
        assigned: 500000 as Milliunit,
        activity: -350000 as Milliunit,
        available: 150000 as Milliunit,
        linkedAccountId: null,
        overspendingType: null,
      };

      const dto = toBudgetItemDTO(row);

      expect(dto).toEqual({
        id: 100,
        categoryId: 5,
        categoryName: 'Groceries',
        groupName: 'Everyday Expenses',
        categoryGroupId: 2,
        groupHidden: false,
        month: '2025-12',
        assigned: 500000,
        activity: -350000,
        available: 150000,
        linkedAccountId: null,
        overspendingType: null,
      });
    });

    it('coerces group_hidden=1 to boolean true', () => {
      const row = {
        id: 101,
        categoryId: 6,
        categoryName: 'Hidden Cat',
        groupName: 'Hidden Group',
        categoryGroupId: 3,
        groupHidden: 1,
        month: '2025-12',
        assigned: 0 as Milliunit,
        activity: 0 as Milliunit,
        available: 0 as Milliunit,
      };
      expect(toBudgetItemDTO(row).groupHidden).toBe(true);
    });

    it('handles overspending types correctly', () => {
      const cashRow = {
        id: 102,
        categoryId: 7,
        groupName: 'Test',
        categoryGroupId: 1,
        groupHidden: 0,
        month: '2025-12',
        assigned: 0 as Milliunit,
        activity: -100 as Milliunit,
        available: -100 as Milliunit,
        overspendingType: 'cash' as const,
      };
      expect(toBudgetItemDTO(cashRow).overspendingType).toBe('cash');

      const creditRow = { ...cashRow, overspendingType: 'credit' as const };
      expect(toBudgetItemDTO(creditRow).overspendingType).toBe('credit');
    });

    it('defaults missing fields', () => {
      const row = { categoryGroupId: 1, groupName: 'G', month: '2025-12' };
      const dto = toBudgetItemDTO(row);
      expect(dto.id).toBeNull();
      expect(dto.categoryId).toBeNull();
      expect(dto.categoryName).toBeNull();
      expect(dto.assigned).toBe(0);
      expect(dto.activity).toBe(0);
      expect(dto.available).toBe(0);
      expect(dto.linkedAccountId).toBeNull();
      expect(dto.overspendingType).toBeNull();
    });

    it('defaults group_name to empty string when undefined', () => {
      const row = { categoryGroupId: 1, month: '2025-12' }; // group_name is undefined
      const dto = toBudgetItemDTO(row);
      expect(dto.groupName).toBe('');
    });

    it('maps linked_account_id when present', () => {
      const row = {
        id: 200,
        categoryId: 15,
        categoryName: 'Visa Payment',
        groupName: 'CC',
        categoryGroupId: 5,
        groupHidden: 0,
        month: '2025-12',
        assigned: 0 as Milliunit,
        activity: 500 as Milliunit,
        available: 500 as Milliunit,
        linkedAccountId: 42,
      };
      const dto = toBudgetItemDTO(row);
      expect(dto.linkedAccountId).toBe(42);
    });
  });
});

describe('Category DTOs', () => {
  describe('toCategoryDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        id: 10, budgetId: 1,
        name: 'Groceries',
        categoryGroupId: 2,
        groupName: 'Everyday Expenses',
      };

      const dto = toCategoryDTO(row);

      expect(dto).toEqual({
        id: 10, budgetId: 1,
        name: 'Groceries',
        categoryGroupId: 2,
        groupName: 'Everyday Expenses',
        sortOrder: 0,
        linkedAccountId: null,
      });
    });

    it('defaults group_name to empty string when undefined', () => {
      const row = { id: 11, budgetId: 1, name: 'Test', categoryGroupId: 1 };
      const dto = toCategoryDTO(row);
      expect(dto.groupName).toBe('');
    });

    it('maps sort_order and linked_account_id when present', () => {
      const row = {
        id: 12, budgetId: 1,
        name: 'Visa Payment',
        categoryGroupId: 3,
        groupName: 'CC',
        sortOrder: 5,
        linkedAccountId: 42,
      };
      const dto = toCategoryDTO(row);
      expect(dto.sortOrder).toBe(5);
      expect(dto.linkedAccountId).toBe(42);
    });
  });

  describe('toCategoryGroupDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        id: 2, budgetId: 1,
        name: 'Everyday Expenses',
        isIncome: 0,
        hidden: 0,
      };

      const dto = toCategoryGroupDTO(row);

      expect(dto).toEqual({
        id: 2, budgetId: 1,
        name: 'Everyday Expenses',
        isIncome: false,
        hidden: false,
        sortOrder: 0,
      });
    });

    it('coerces is_income=1 and hidden=1 to boolean true', () => {
      const row = { id: 1, budgetId: 1, name: 'Inflow', isIncome: 1, hidden: 1 };
      const dto = toCategoryGroupDTO(row);
      expect(dto.isIncome).toBe(true);
      expect(dto.hidden).toBe(true);
    });
  });
});

describe('Share DTOs', () => {
  describe('toShareDTO', () => {
    it('converts a ShareRow to ShareDTO with Date createdAt', () => {
      const date = new Date('2025-12-15T10:30:00.000Z');
      const row = {
        id: 1,
        budgetId: 5,
        userId: 'user-abc-123',
        role: 'editor',
        createdAt: date,
      };

      const dto = toShareDTO(row);

      expect(dto).toEqual({
        id: 1,
        budgetId: 5,
        userId: 'user-abc-123',
        role: 'editor',
        createdAt: '2025-12-15T10:30:00.000Z',
      });
    });

    it('converts null createdAt to null string', () => {
      const row = {
        id: 2,
        budgetId: 5,
        userId: 'user-xyz-456',
        role: 'viewer',
        createdAt: null,
      };

      const dto = toShareDTO(row);

      expect(dto.createdAt).toBeNull();
    });

    it('preserves all field values exactly', () => {
      const row = {
        id: 999,
        budgetId: 42,
        userId: 'long-user-id-with-dashes',
        role: 'owner',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      };

      const dto = toShareDTO(row);

      expect(dto.id).toBe(999);
      expect(dto.budgetId).toBe(42);
      expect(dto.userId).toBe('long-user-id-with-dashes');
      expect(dto.role).toBe('owner');
      expect(dto.createdAt).toBe('2020-01-01T00:00:00.000Z');
    });
  });

  describe('toShareInfoDTO', () => {
    it('converts a BudgetShareInfo to ShareInfoDTO with Date createdAt', () => {
      const date = new Date('2025-06-01T14:00:00.000Z');
      const row: BudgetShareInfo = {
        id: 10,
        budgetId: 3,
        userId: 'user-info-1',
        userName: 'Jane Doe',
        userEmail: 'jane@example.com',
        role: 'editor',
        createdAt: date,
      };

      const dto = toShareInfoDTO(row);

      expect(dto).toEqual({
        id: 10,
        budgetId: 3,
        userId: 'user-info-1',
        userName: 'Jane Doe',
        userEmail: 'jane@example.com',
        role: 'editor',
        createdAt: '2025-06-01T14:00:00.000Z',
      });
    });

    it('converts null createdAt to null string', () => {
      const row: BudgetShareInfo = {
        id: 11,
        budgetId: 3,
        userId: 'user-info-2',
        userName: 'John Smith',
        userEmail: 'john@example.com',
        role: 'viewer',
        createdAt: null,
      };

      const dto = toShareInfoDTO(row);

      expect(dto.createdAt).toBeNull();
    });

    it('includes user name and email fields', () => {
      const row: BudgetShareInfo = {
        id: 12,
        budgetId: 7,
        userId: 'user-info-3',
        userName: 'María García',
        userEmail: 'maria@ejemplo.com',
        role: 'owner',
        createdAt: new Date('2024-03-15T08:30:00.000Z'),
      };

      const dto = toShareInfoDTO(row);

      expect(dto.userName).toBe('María García');
      expect(dto.userEmail).toBe('maria@ejemplo.com');
    });
  });
});
