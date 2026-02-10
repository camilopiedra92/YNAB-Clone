/**
 * Auth.js v5 Configuration — Central auth config.
 *
 * Uses Credentials Provider (email + password) with JWT sessions.
 * No OAuth providers — matching YNAB's email/password auth model.
 *
 * Security features:
 * - Account lockout after MAX_LOGIN_ATTEMPTS failed attempts
 * - Lock duration of LOCKOUT_DURATION_MS (15 minutes)
 * - Failed attempts counter resets on successful login
 *
 * Exports: auth, signIn, signOut, handlers
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import db from './repos/client';
import { users } from './db/schema';
import { LoginSchema } from './schemas/auth';

/** Maximum failed login attempts before lockout */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout duration in milliseconds (15 minutes) */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/auth/login',
  },

  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) return null;

        // ── Account Lockout Check ──────────────────────────────────
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          // Account is currently locked — reject even if password is correct
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          // ── Increment failed attempts ────────────────────────────
          const newAttempts = user.failedLoginAttempts + 1;
          const updateData: { failedLoginAttempts: number; lockedUntil?: Date | null } = {
            failedLoginAttempts: newAttempts,
          };

          if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
            // Lock the account
            updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          }

          await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, user.id));

          return null;
        }

        // ── Successful login — reset lockout counters ──────────────
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await db
            .update(users)
            .set({
              failedLoginAttempts: 0,
              lockedUntil: null,
            })
            .where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

