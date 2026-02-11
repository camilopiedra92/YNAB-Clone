/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, today } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/helpers';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;
let budgetId: number;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
    budgetId = testDb.defaultBudgetId;
});

// =====================================================================
// Category Groups
// =====================================================================
describe('Category Groups', () => {
    it('creates groups with auto-incrementing sort_order', async () => {
        await fns.createCategoryGroup('First', budgetId);
        await fns.createCategoryGroup('Second', budgetId);
        await fns.createCategoryGroup('Third', budgetId);

        const groups = await fns.getCategoryGroups(budgetId);
        expect(groups).toHaveLength(3);
        expect(groups[0].sortOrder).toBe(1);
        expect(groups[1].sortOrder).toBe(2);
        expect(groups[2].sortOrder).toBe(3);
    });

    it('updates category group order', async () => {
        const r1 = await fns.createCategoryGroup('First', budgetId);
        const r2 = await fns.createCategoryGroup('Second', budgetId);
        const r3 = await fns.createCategoryGroup('Third', budgetId);
        const id1 = r1.id;
        const id2 = r2.id;
        const id3 = r3.id;

        // Reverse order
        await fns.updateCategoryGroupOrder(budgetId, [
            { id: id1, sortOrder: 3 },
            { id: id2, sortOrder: 2 },
            { id: id3, sortOrder: 1 },
        ]);

        const groups = await fns.getCategoryGroups(budgetId);
        // Now Third (sortOrder 1) should be first
        expect(groups[0].name).toBe('Third');
        expect(groups[1].name).toBe('Second');
        expect(groups[2].name).toBe('First');
    });
});

// =====================================================================
// Categories
// =====================================================================
describe('Categories (full coverage)', () => {
    let groupId1: number;
    let groupId2: number;

    beforeEach(async () => {
        const r1 = await fns.createCategoryGroup('Essentials', budgetId);
        const r2 = await fns.createCategoryGroup('Fun', budgetId);
        groupId1 = r1.id;
        groupId2 = r2.id;
    });

    it('getCategories without groupId returns all with group_name', async () => {
        await fns.createCategory({ name: 'Groceries', category_group_id: groupId1 });
        await fns.createCategory({ name: 'Entertainment', category_group_id: groupId2 });

        const allCats = await fns.getCategoriesWithGroups(budgetId);
        expect(allCats).toHaveLength(2);
        // Should have group_name from JOIN
        expect(allCats[0].groupName).toBeDefined();
    });

    it('getCategories with groupId returns only that group', async () => {
        await fns.createCategory({ name: 'Groceries', category_group_id: groupId1 });
        await fns.createCategory({ name: 'Entertainment', category_group_id: groupId2 });

        const cats = await fns.getCategories(budgetId, groupId1);
        expect(cats).toHaveLength(1);
        expect(cats[0].name).toBe('Groceries');
    });

    it('creates categories with auto-incrementing sort_order within group', async () => {
        await fns.createCategory({ name: 'First', category_group_id: groupId1 });
        await fns.createCategory({ name: 'Second', category_group_id: groupId1 });
        await fns.createCategory({ name: 'Third', category_group_id: groupId1 });

        const cats = await fns.getCategories(budgetId, groupId1);
        expect(cats[0].sortOrder).toBe(1);
        expect(cats[1].sortOrder).toBe(2);
        expect(cats[2].sortOrder).toBe(3);
    });

    it('createCategory with linked_account_id sets the FK', async () => {
        const accResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const accountId = accResult.id;

        await fns.createCategory({ name: 'Visa Payment', category_group_id: groupId1, linked_account_id: accountId });

        const cats = await fns.getCategories(budgetId, groupId1);
        expect(cats[0].linkedAccountId).toBe(accountId);
    });

    it('createCategory without linked_account_id leaves it null', async () => {
        await fns.createCategory({ name: 'Groceries', category_group_id: groupId1 });

        const cats = await fns.getCategories(budgetId, groupId1);
        expect(cats[0].linkedAccountId).toBeNull();
    });

    it('updateCategoryOrder reorders within same group', async () => {
        const r1 = await fns.createCategory({ name: 'First', category_group_id: groupId1 });
        const r2 = await fns.createCategory({ name: 'Second', category_group_id: groupId1 });
        const r3 = await fns.createCategory({ name: 'Third', category_group_id: groupId1 });
        const id1 = r1.id;
        const id2 = r2.id;
        const id3 = r3.id;

        await fns.updateCategoryOrder(budgetId, [
            { id: id1, sortOrder: 3 },
            { id: id2, sortOrder: 1 },
            { id: id3, sortOrder: 2 },
        ]);

        const cats = await fns.getCategories(budgetId, groupId1);
        expect(cats[0].name).toBe('Second');
        expect(cats[1].name).toBe('Third');
        expect(cats[2].name).toBe('First');
    });

    it('updateCategoryOrder moves category to different group', async () => {
        const r1 = await fns.createCategory({ name: 'Groceries', category_group_id: groupId1 });
        const catId = r1.id;

        // Move to group 2
        await fns.updateCategoryOrder(budgetId, [
            { id: catId, sortOrder: 1, categoryGroupId: groupId2 },
        ]);

        const group1Cats = await fns.getCategories(budgetId, groupId1);
        const group2Cats = await fns.getCategories(budgetId, groupId2);
        expect(group1Cats).toHaveLength(0);
        expect(group2Cats).toHaveLength(1);
        expect(group2Cats[0].name).toBe('Groceries');
    });

    it('updateCategoryOrder without categoryGroupId only changes sortOrder', async () => {
        const r1 = await fns.createCategory({ name: 'Groceries', category_group_id: groupId1 });
        const catId = r1.id;

        await fns.updateCategoryOrder(budgetId, [
            { id: catId, sortOrder: 99 },
        ]);

        const cats = await fns.getCategories(budgetId, groupId1);
        expect(cats[0].sortOrder).toBe(99);
        expect(cats[0].categoryGroupId).toBe(groupId1);
    });
});
