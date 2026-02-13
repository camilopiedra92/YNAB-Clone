/**
 * Auth.js v5 Configuration — Full Node.js auth config.
 *
 * Extends the edge-compatible `auth.config.ts` with the Credentials
 * provider that requires Node.js-only dependencies (bcrypt, drizzle).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  auth.config.ts  →  Edge runtime (proxy.ts)                 │
 * │  auth.ts          →  Node runtime (API routes, server)      │
 * └──────────────────────────────────────────────────────────────┘
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
import db from './db/client';
import { users } from './db/schema';
import { LoginSchema } from './schemas/auth';
import { authConfig } from './auth.config';
import { logger } from './logger';

/** Maximum failed login attempts before lockout */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout duration in milliseconds (15 minutes) */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // Suppress NextAuth internal error logs during E2E test builds.
  // CredentialsSignin errors are EXPECTED in auth/security tests (wrong password,
  // account lockout). Without this, they pollute the test runner output.
  // Only active when NEXT_TEST_BUILD=1 — zero impact on dev/production.
  ...(process.env.NEXT_TEST_BUILD && {
    logger: {
      error: () => {},
      warn: console.warn,
      debug: () => {},
    },
  }),

  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          logger.debug('Auth: schema validation failed', { issues: parsed.error.issues });
          return null;
        }

        const { email, password } = parsed.data;
        logger.debug('Auth: login attempt', { email });

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) {
          logger.debug('Auth: user not found', { email });
          return null;
        }

        logger.debug('Auth: user found', { email: user.email });

        // ── Account Lockout Check ──────────────────────────────────
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logger.debug('Auth: account locked', { email, lockedUntil: user.lockedUntil });
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          logger.debug('Auth: password mismatch', { email });
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
});
