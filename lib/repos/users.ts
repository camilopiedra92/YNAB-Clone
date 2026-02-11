import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { type DrizzleDB } from '../db/helpers';

/** Placeholder for future cross-repo dependency injection (matches TransactionRepoDeps / BudgetRepoDeps pattern). */
export type UserRepoDeps = Record<string, never>;



export function createUserFunctions(database: DrizzleDB, _deps: UserRepoDeps) {
  async function getUserByEmail(email: string) {
    const rows = await database.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
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

  return { getUserByEmail, createUser };
}
