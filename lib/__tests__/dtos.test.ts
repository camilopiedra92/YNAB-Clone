import { describe, it, expect } from 'vitest';
import { toAccountDTO, toReconciliationInfoDTO } from '../dtos/account.dto';
import { toTransactionDTO } from '../dtos/transaction.dto';
import { toBudgetItemDTO } from '../dtos/budget.dto';
import { toCategoryDTO, toCategoryGroupDTO } from '../dtos/category.dto';
import type { Milliunit } from '../engine/primitives';

describe('Account DTOs', () => {
  describe('toAccountDTO', () => {
    it('converts snake_case row to camelCase DTO', () => {
      const row = {
        id: 1,
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
        id: 1,
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
      const row = { id: 2, name: 'Old', type: 'savings', balance: 0, clearedBalance: 0, unclearedBalance: 0, note: null, closed: 1 };
      expect(toAccountDTO(row).closed).toBe(true);
    });

    it('defaults missing fields', () => {
      const row = { id: 3, name: 'Minimal', type: 'cash' };
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
      const dto = toReconciliationInfoDTO({});
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
      const row = { id: 99, accountId: 1, date: '2025-01-01', cleared: 'Uncleared' };
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
      const row = { id: 100, accountId: 1, date: '2025-01-01' }; // no cleared field
      const dto = toTransactionDTO(row);
      expect(dto.cleared).toBe('Uncleared');
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
        id: 10,
        name: 'Groceries',
        categoryGroupId: 2,
        groupName: 'Everyday Expenses',
      };

      const dto = toCategoryDTO(row);

      expect(dto).toEqual({
        id: 10,
        name: 'Groceries',
        categoryGroupId: 2,
        groupName: 'Everyday Expenses',
        sortOrder: 0,
        linkedAccountId: null,
      });
    });

    it('defaults group_name to empty string when undefined', () => {
      const row = { id: 11, name: 'Test', categoryGroupId: 1 };
      const dto = toCategoryDTO(row);
      expect(dto.groupName).toBe('');
    });

    it('maps sort_order and linked_account_id when present', () => {
      const row = {
        id: 12,
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
        id: 2,
        name: 'Everyday Expenses',
        isIncome: 0,
        hidden: 0,
      };

      const dto = toCategoryGroupDTO(row);

      expect(dto).toEqual({
        id: 2,
        name: 'Everyday Expenses',
        isIncome: false,
        hidden: false,
        sortOrder: 0,
      });
    });

    it('coerces is_income=1 and hidden=1 to boolean true', () => {
      const row = { id: 1, name: 'Inflow', isIncome: 1, hidden: 1 };
      const dto = toCategoryGroupDTO(row);
      expect(dto.isIncome).toBe(true);
      expect(dto.hidden).toBe(true);
    });
  });
});
