import { eq, and, ne, sql } from 'drizzle-orm';
import { users } from '../db/schema';
import { type DrizzleDB, queryRows } from '../db/helpers';

/** Placeholder for future cross-repo dependency injection (matches TransactionRepoDeps / BudgetRepoDeps pattern). */
export type UserRepoDeps = Record<string, never>;



export function createUserFunctions(database: DrizzleDB, _deps: UserRepoDeps) {
  async function getUserByEmail(email: string) {
    // Use privileged RPC to bypass RLS (needed for Login & Sharing lookups)
    // queryRows normalizes the driver result (PGlite returns { rows: [] }, postgres-js returns T[])
    const rows = await queryRows<typeof users.$inferSelect>(database, sql`SELECT * FROM get_user_by_email_privileged(${email.toLowerCase()})`);
    
    return rows[0] || null;
  }

  /** Get user by UUID. Returns safe projection (never the password hash). */
  async function getUserById(id: string) {
    const rows = await database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async function createUser(data: { name: string; email: string; passwordHash: string }) {
    const [newUser] = await database.insert(users)
      .values({
        name: data.name,
        email: data.email.toLowerCase(),
        password: data.passwordHash,
      })
      .returning({ id: users.id, email: users.email, name: users.name });
    return newUser;
  }

  /** Update user name and/or email. Validates email uniqueness (excluding own row). */
  async function updateUser(id: string, data: { name?: string; email?: string }) {
    const updateData: Partial<{ name: string; email: string }> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase();
      // Check uniqueness (excluding the user's own row)
      const existing = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, normalizedEmail), ne(users.id, id)))
        .limit(1);
      if (existing.length > 0) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
      updateData.email = normalizedEmail;
    }

    if (Object.keys(updateData).length === 0) return null;

    const [updated] = await database
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, email: users.email });
    return updated || null;
  }

  /** Update the password hash for a user. Caller is responsible for bcrypt verification. */
  async function updatePassword(id: string, newHash: string) {
    await database.update(users).set({ password: newHash }).where(eq(users.id, id));
  }

  return { getUserByEmail, getUserById, createUser, updateUser, updatePassword };
}
