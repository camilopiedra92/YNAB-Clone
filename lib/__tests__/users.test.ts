/**
 * Unit tests for the Users repo.
 *
 * Tests user creation and lookup using PGlite.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers';
import type { createDbFunctions } from '../repos';

let fns: ReturnType<typeof createDbFunctions>;

beforeEach(async () => {
    const result = await createTestDb();
    fns = result.fns;
});

describe('createUser', () => {
    it('creates a user with lowercased email', async () => {
        const user = await fns.createUser({
            name: 'Test User',
            email: 'Test@Example.COM',
            passwordHash: 'hashed_password',
        });
        expect(user.name).toBe('Test User');
        expect(user.email).toBe('test@example.com');
        expect(user.id).toBeDefined();
    });
});

describe('getUserByEmail', () => {
    it('finds existing user', async () => {
        await fns.createUser({
            name: 'Find Me',
            email: 'find@test.com',
            passwordHash: 'hashed',
        });
        const found = await fns.getUserByEmail('find@test.com');
        expect(found).not.toBeNull();
        expect(found!.name).toBe('Find Me');
    });

    it('returns null for non-existent email', async () => {
        const found = await fns.getUserByEmail('nobody@test.com');
        expect(found).toBeNull();
    });

    it('performs case-insensitive lookup', async () => {
        await fns.createUser({
            name: 'Case Test',
            email: 'mixed@CASE.com',
            passwordHash: 'hashed',
        });
        // Input is lowercased by getUserByEmail
        const found = await fns.getUserByEmail('MIXED@case.COM');
        expect(found).not.toBeNull();
        expect(found!.name).toBe('Case Test');
    });
});
