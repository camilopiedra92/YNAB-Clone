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

describe('getUserById', () => {
    it('finds existing user by UUID', async () => {
        const created = await fns.createUser({
            name: 'By Id',
            email: 'byid@test.com',
            passwordHash: 'hashed',
        });
        const found = await fns.getUserById(created.id);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(created.id);
        expect(found!.name).toBe('By Id');
        expect(found!.email).toBe('byid@test.com');
        expect(found!.createdAt).toBeDefined();
    });

    it('does not expose password hash', async () => {
        const created = await fns.createUser({
            name: 'Safe',
            email: 'safe@test.com',
            passwordHash: 'secret_hash',
        });
        const found = await fns.getUserById(created.id);
        expect(found).not.toBeNull();
        // The returned object should NOT have a password field
        expect((found as Record<string, unknown>).password).toBeUndefined();
    });

    it('returns null for non-existent UUID', async () => {
        const found = await fns.getUserById('00000000-0000-0000-0000-000000000000');
        expect(found).toBeNull();
    });
});

describe('updateUser', () => {
    it('updates name only', async () => {
        const user = await fns.createUser({
            name: 'Original',
            email: 'update@test.com',
            passwordHash: 'hashed',
        });
        const updated = await fns.updateUser(user.id, { name: 'New Name' });
        expect(updated).not.toBeNull();
        expect(updated!.name).toBe('New Name');
        expect(updated!.email).toBe('update@test.com'); // unchanged
    });

    it('updates email with lowercase normalization', async () => {
        const user = await fns.createUser({
            name: 'Email Test',
            email: 'old@test.com',
            passwordHash: 'hashed',
        });
        const updated = await fns.updateUser(user.id, { email: 'NEW@Test.COM' });
        expect(updated).not.toBeNull();
        expect(updated!.email).toBe('new@test.com');
    });

    it('rejects duplicate email with error', async () => {
        await fns.createUser({
            name: 'First',
            email: 'taken@test.com',
            passwordHash: 'hashed',
        });
        const second = await fns.createUser({
            name: 'Second',
            email: 'second@test.com',
            passwordHash: 'hashed',
        });
        await expect(
            fns.updateUser(second.id, { email: 'taken@test.com' })
        ).rejects.toThrow('EMAIL_ALREADY_EXISTS');
    });

    it('returns null when no fields provided', async () => {
        const user = await fns.createUser({
            name: 'No Op',
            email: 'noop@test.com',
            passwordHash: 'hashed',
        });
        const result = await fns.updateUser(user.id, {});
        expect(result).toBeNull();
    });
});

describe('updatePassword', () => {
    it('updates the password hash', async () => {
        const user = await fns.createUser({
            name: 'Pwd Test',
            email: 'pwd@test.com',
            passwordHash: 'old_hash',
        });
        await fns.updatePassword(user.id, 'new_hash');
        // Verify by fetching full user row (includes password)
        const found = await fns.getUserByEmail('pwd@test.com');
        expect(found).not.toBeNull();
        expect(found!.password).toBe('new_hash');
    });
});
