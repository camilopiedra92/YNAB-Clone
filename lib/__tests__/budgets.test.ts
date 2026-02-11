/**
 * Unit tests for the Budgets (entity) repo.
 *
 * Tests CRUD operations for budget management and shared budget access.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/client';
import * as schema from '../db/schema';

let fns: ReturnType<typeof createDbFunctions>;
let db: DrizzleDB;
let defaultUserId: string;

beforeEach(async () => {
    const result = await createTestDb();
    fns = result.fns;
    db = result.db;
    defaultUserId = result.defaultUserId;
});

describe('getBudgets', () => {
    it('returns owned budgets', async () => {
        const budgets = await fns.getBudgets(defaultUserId);
        expect(budgets).toHaveLength(1);
        expect(budgets[0].role).toBe('owner');
        expect(budgets[0].name).toBe('Default Budget');
    });

    it('returns shared budgets', async () => {
        // Create another user and share the budget
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Other User',
            email: 'other@test.com',
            password: 'password',
        }).returning();

        const [budget] = await db.insert(schema.budgets).values({
            userId: defaultUserId,
            name: 'Shared Budget',
        }).returning();

        await db.insert(schema.budgetShares).values({
            budgetId: budget.id,
            userId: otherUser.id,
            role: 'editor',
        });

        const budgets = await fns.getBudgets(otherUser.id);
        expect(budgets).toHaveLength(1);
        expect(budgets[0].role).toBe('editor');
        expect(budgets[0].name).toBe('Shared Budget');
    });

    it('returns both owned and shared budgets', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Other User',
            email: 'other@test.com',
            password: 'password',
        }).returning();

        // Create a budget owned by otherUser and shared with defaultUser
        const [otherBudget] = await db.insert(schema.budgets).values({
            userId: otherUser.id,
            name: 'Shared From Other',
        }).returning();

        await db.insert(schema.budgetShares).values({
            budgetId: otherBudget.id,
            userId: defaultUserId,
            role: 'viewer',
        });

        const budgets = await fns.getBudgets(defaultUserId);
        expect(budgets).toHaveLength(2);
        const roles = budgets.map(b => b.role).sort();
        expect(roles).toEqual(['owner', 'viewer']);
    });
});

describe('getBudget', () => {
    it('returns owned budget by ID', async () => {
        const budgets = await fns.getBudgets(defaultUserId);
        const budget = await fns.getBudget(budgets[0].id, defaultUserId);
        expect(budget).toBeDefined();
        expect(budget!.role).toBe('owner');
    });

    it('returns undefined for inaccessible budget', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Other User',
            email: 'other@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const budget = await fns.getBudget(budgets[0].id, otherUser.id);
        expect(budget).toBeUndefined();
    });

    it('returns shared budget by ID', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Other User',
            email: 'other@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        await db.insert(schema.budgetShares).values({
            budgetId: budgets[0].id,
            userId: otherUser.id,
            role: 'editor',
        });

        const budget = await fns.getBudget(budgets[0].id, otherUser.id);
        expect(budget).toBeDefined();
        expect(budget!.role).toBe('editor');
    });
});

describe('createBudget', () => {
    it('creates with default currency (COP)', async () => {
        const budget = await fns.createBudget(defaultUserId, { name: 'New Budget' });
        expect(budget.name).toBe('New Budget');
        expect(budget.currencyCode).toBe('COP');
        expect(budget.currencySymbol).toBe('$');
        expect(budget.currencyDecimals).toBe(0);
    });

    it('creates with custom currency params', async () => {
        const budget = await fns.createBudget(defaultUserId, {
            name: 'USD Budget',
            currencyCode: 'USD',
            currencySymbol: 'US$',
            currencyDecimals: 2,
        });
        expect(budget.currencyCode).toBe('USD');
        expect(budget.currencySymbol).toBe('US$');
        expect(budget.currencyDecimals).toBe(2);
    });
});

describe('updateBudget', () => {
    it('updates budget name', async () => {
        const budgets = await fns.getBudgets(defaultUserId);
        const updated = await fns.updateBudget(budgets[0].id, defaultUserId, { name: 'Renamed' });
        expect(updated.name).toBe('Renamed');
    });

    it('returns undefined for unauthorized user', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Other',
            email: 'other@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const updated = await fns.updateBudget(budgets[0].id, otherUser.id, { name: 'Hacked' });
        expect(updated).toBeUndefined();
    });
});

describe('deleteBudget', () => {
    it('deletes owned budget', async () => {
        const budgets = await fns.getBudgets(defaultUserId);
        const deleted = await fns.deleteBudget(budgets[0].id, defaultUserId);
        expect(deleted).toBeDefined();

        const remaining = await fns.getBudgets(defaultUserId);
        expect(remaining).toHaveLength(0);
    });

    it('returns undefined for unauthorized user', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Other',
            email: 'other@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const deleted = await fns.deleteBudget(budgets[0].id, otherUser.id);
        expect(deleted).toBeUndefined();
    });
});

// ── Share Management Tests ──

describe('getShares', () => {
    it('returns empty array when no shares exist', async () => {
        const budgets = await fns.getBudgets(defaultUserId);
        const shares = await fns.getShares(budgets[0].id);
        expect(shares).toHaveLength(0);
    });

    it('returns shares with user info', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Shared User',
            email: 'shared@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        await fns.addShare(budgets[0].id, otherUser.id, 'editor');

        const shares = await fns.getShares(budgets[0].id);
        expect(shares).toHaveLength(1);
        expect(shares[0].userName).toBe('Shared User');
        expect(shares[0].userEmail).toBe('shared@test.com');
        expect(shares[0].role).toBe('editor');
    });
});

describe('addShare', () => {
    it('creates a share entry', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'New Member',
            email: 'member@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const share = await fns.addShare(budgets[0].id, otherUser.id, 'viewer');

        expect(share).toBeDefined();
        expect(share.role).toBe('viewer');
        expect(share.budgetId).toBe(budgets[0].id);
    });

    it('rejects duplicate shares (unique constraint)', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Dup User',
            email: 'dup@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        await fns.addShare(budgets[0].id, otherUser.id, 'editor');

        // Attempt duplicate
        await expect(
            fns.addShare(budgets[0].id, otherUser.id, 'viewer')
        ).rejects.toThrow();
    });

    it('makes the budget visible to the shared user', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Viewer',
            email: 'viewer@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        await fns.addShare(budgets[0].id, otherUser.id, 'editor');

        const otherBudgets = await fns.getBudgets(otherUser.id);
        expect(otherBudgets).toHaveLength(1);
        expect(otherBudgets[0].role).toBe('editor');
    });
});

describe('updateShareRole', () => {
    it('changes role from editor to viewer', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Role Change',
            email: 'role@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const share = await fns.addShare(budgets[0].id, otherUser.id, 'editor');

        const updated = await fns.updateShareRole(share.id, 'viewer');
        expect(updated).toBeDefined();
        expect(updated.role).toBe('viewer');
    });
});

describe('removeShare', () => {
    it('removes a share entry', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'To Remove',
            email: 'remove@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const share = await fns.addShare(budgets[0].id, otherUser.id, 'editor');

        const removed = await fns.removeShare(share.id);
        expect(removed).toBeDefined();

        const shares = await fns.getShares(budgets[0].id);
        expect(shares).toHaveLength(0);
    });

    it('budget is no longer visible to removed user', async () => {
        const [otherUser] = await db.insert(schema.users).values({
            name: 'Removed User',
            email: 'removed@test.com',
            password: 'password',
        }).returning();

        const budgets = await fns.getBudgets(defaultUserId);
        const share = await fns.addShare(budgets[0].id, otherUser.id, 'editor');

        // Verify they can see it
        let otherBudgets = await fns.getBudgets(otherUser.id);
        expect(otherBudgets).toHaveLength(1);

        // Remove and verify
        await fns.removeShare(share.id);
        otherBudgets = await fns.getBudgets(otherUser.id);
        expect(otherBudgets).toHaveLength(0);
    });
});

