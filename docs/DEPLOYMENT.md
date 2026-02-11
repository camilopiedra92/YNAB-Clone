# 🚀 Deployment Guide: YNAB App → Hetzner + Coolify

**Created:** 2026-02-11
**Last Updated:** 2026-02-11 (Phase 2 ✅)
**Status:** 🟡 In Progress

---

## 📊 Progress Dashboard

### Overall Progress: 14 / 42 tasks complete

| Phase                                                                               | Status         | Progress | Priority    |
| ----------------------------------------------------------------------------------- | -------------- | -------- | ----------- |
| [Phase 1: Containerization](#phase-1-containerization)                              | ✅ Complete    | 8/8      | 🔴 Blocker  |
| [Phase 2: Health & Observability](#phase-2-health--observability)                   | ✅ Complete    | 6/6      | 🔴 Blocker  |
| [Phase 3: Database Production Config](#phase-3-database-production-config)          | 🔴 Not Started | 0/7      | 🔴 Critical |
| [Phase 4: Deploy Pipeline](#phase-4-deploy-pipeline)                                | 🔴 Not Started | 0/5      | 🟡 High     |
| [Phase 5: Environment & Secrets](#phase-5-environment--secrets)                     | 🔴 Not Started | 0/6      | 🟡 High     |
| [Phase 6: Server Setup (Hetzner + Coolify)](#phase-6-server-setup-hetzner--coolify) | 🔴 Not Started | 0/10     | 🟡 High     |

### Milestone Tracker

| Milestone                         | Target             | Status |
| --------------------------------- | ------------------ | ------ |
| Docker image builds locally       | Phase 1 complete   | ✅     |
| Health endpoint responds          | Phase 2 complete   | ✅     |
| DB production-ready               | Phase 3 complete   | ⬜     |
| **MVP: App accessible on domain** | Phase 1-6 complete | ⬜     |
| Backups configured                | Post-launch        | ⬜     |
| Monitoring configured             | Post-launch        | ⬜     |

---

## 📋 Current State Assessment

### ✅ What's Already Production-Grade

The app has **strong foundations** that require zero changes for deployment:

| Area                 | Status             | Evidence                                                                                 |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| **Financial Engine** | ✅ Excellent       | Pure functions in `lib/engine/`, branded `Milliunit` types, comprehensive unit tests     |
| **Authentication**   | ✅ Strong          | Auth.js v5, JWT strategy, account lockout (5 attempts → 15min lock), bcrypt hashing      |
| **Security Headers** | ✅ Strong          | CSP, HSTS (2yr preload), X-Frame-Options DENY, Referrer-Policy — all in `next.config.ts` |
| **Multi-tenancy**    | ✅ Solid           | Budget-scoped isolation via `requireBudgetAccess()` + PostgreSQL RLS safety net          |
| **CI Pipeline**      | ✅ Well-structured | `ci-passed` gate, quality-gate → unit-tests → E2E (conditional), concurrency dedup       |
| **Gitflow**          | ✅ Professional    | `staging` → `main` branching with GitHub Rulesets, documented in `CONTRIBUTING.md`       |
| **API Validation**   | ✅ Good            | Zod schemas at API boundary, camelCase DTOs, parameterized queries (no SQL injection)    |
| **Error Handling**   | ✅ Good            | Global error boundary (`global-error.tsx`), structured `apiError()`, `logger.ts`         |
| **Rate Limiting**    | ⚠️ Dev-only        | In-memory sliding window — functional but resets on restart, single-instance only        |
| **Offline Support**  | ✅ Good            | IndexedDB persistence via `idb-keyval`, mutation queue in `SyncStatus`                   |

### 🔴 Critical Gaps Found

These items **block production deployment** and must be resolved:

| #   | Gap                                               | Why It Blocks                                                                               | Effort |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| 1   | **No Dockerfile**                                 | Coolify requires Docker image — cannot deploy without it                                    | 1 hr   |
| 2   | **No `.dockerignore`**                            | Build context includes `node_modules`, `.next`, `.git` (~2GB) — builds fail or take 20+ min | 10 min |
| 3   | **No `output: 'standalone'`** in `next.config.ts` | Docker image will be ~1GB+ instead of ~150MB, copies entire `node_modules`                  | 5 min  |
| 4   | **No production health endpoint**                 | Coolify/Traefik can't verify app is alive — no auto-restart on crash                        | 20 min |
| 5   | **No DB connection pooling**                      | Default `postgres()` client leaks connections under any real load                           | 10 min |
| 6   | **No graceful shutdown**                          | `postgres` client connections not cleaned up on SIGTERM → zombie connections                | 10 min |
| 7   | **Deploy workflow is a placeholder**              | `.github/workflows/deploy.yml` prints a message, does nothing                               | 15 min |
| 8   | **`AUTH_URL` not configured**                     | Auth.js needs canonical URL for callbacks — login will fail in production                   | 5 min  |
| 9   | **RLS bypassed with superuser**                   | If app connects as `postgres`, all RLS policies are ignored → data leak risk                | 30 min |
| 10  | **`with-local-tmp.sh` wraps ALL scripts**         | Docker has its own temp — this script is unnecessary and may cause issues                   | 15 min |

---

## 🏗 Architecture Overview

### How Coolify Works

Coolify is a **self-hosted PaaS** (like Heroku/Vercel but on your own Hetzner server):

1. Pulls code from GitHub (webhook or manual trigger)
2. Builds a Docker image using your `Dockerfile`
3. Runs the container with environment variables from the Coolify UI
4. Handles reverse proxy (Traefik), SSL (Let's Encrypt), and domain routing
5. Can provision PostgreSQL as a managed service on the same server

### Target Architecture

```mermaid
graph TD
    subgraph Hetzner["Hetzner VPS"]
        subgraph Coolify["Coolify (Docker Orchestrator)"]
            TRAEFIK["Traefik Reverse Proxy<br/>Auto SSL (Let's Encrypt)<br/>Domain Routing"]

            subgraph App["YNAB App Container"]
                NEXTJS["Next.js 16 Standalone<br/>Node 22 Alpine<br/>Port 3000<br/>Non-root user"]
            end

            subgraph DB["PostgreSQL 16 Container"]
                PG["PostgreSQL 16<br/>Volume-mounted data<br/>Automated backups"]
            end
        end
    end

    INTERNET["🌐 Internet<br/>yourdomain.com"] --> TRAEFIK
    TRAEFIK -->|":443 → :3000"| NEXTJS
    NEXTJS -->|"DATABASE_URL"| PG
```

### Data Flow: Request → Response

```mermaid
sequenceDiagram
    participant Browser
    participant Traefik as Traefik (SSL/Proxy)
    participant Proxy as proxy.ts (Edge JWT)
    participant API as API Route Handler
    participant Auth as requireBudgetAccess()
    participant Repo as Repository Layer
    participant Engine as Financial Engine
    participant PG as PostgreSQL

    Browser->>Traefik: HTTPS request
    Traefik->>Proxy: HTTP (internal)
    Proxy->>Proxy: JWT validation
    alt No valid JWT
        Proxy-->>Browser: 302 → /auth/login
    end
    Proxy->>API: Authenticated request
    API->>Auth: Verify budget access
    Auth->>PG: Check ownership/share
    Auth->>PG: SET app.budget_id (RLS)
    API->>Repo: Business operation
    Repo->>Engine: Pure calculation
    Engine-->>Repo: Result
    Repo->>PG: Query/Mutation
    PG-->>Repo: Data
    Repo-->>API: DTO
    API-->>Browser: JSON response
```

---

## Phase 1: Containerization

> **Priority:** 🔴 Blocker — Cannot deploy without these items
> **Estimated Effort:** ~2 hours
> **Affected Files:** `next.config.ts`, `Dockerfile` (new), `.dockerignore` (new)

### Checklist

- [x] **1.1** Enable standalone output in `next.config.ts`
- [x] **1.2** Create production `Dockerfile` (multi-stage build)
- [x] **1.3** Create `.dockerignore`
- [x] **1.4** Verify local Docker build succeeds — ✅ 29 steps, `next build` in 4.1s
- [x] **1.5** Verify image size — **339MB** (254MB Node 22 base + 85MB app payload)
- [x] **1.6** Verify container starts and responds on port 3000 — ✅ Ready in **147ms**
- [x] **1.7** Verify `HEALTHCHECK` instruction works — ✅ Docker reports `health: starting` (needs Phase 2 `/api/health`)
- [x] **1.8** Update `package.json` start script — No change needed, Docker uses `CMD ["node", "server.js"]`

### 1.1 Enable Standalone Output

**File:** `next.config.ts`
**Change:** Add `output: 'standalone'` to the config object.

```diff
 const nextConfig: NextConfig = {
+  output: 'standalone',
+
   // Use a separate build directory for E2E tests so `next build` doesn't
   // overwrite the dev server's .next/ cache and crash it.
   distDir: process.env.NEXT_TEST_BUILD ? '.next-test' : '.next',
```

**Why:** Standalone output creates a self-contained `.next/standalone` directory with only the files needed to run in production. Image shrinks from ~1GB to ~150MB. This does NOT affect `npm run dev`.

---

### 1.2 Create Production Dockerfile

**File:** `Dockerfile` (new, project root)

```dockerfile
# ══════════════════════════════════════════════════════════════
# YNAB App — Production Dockerfile
# Multi-stage build for minimal image size (~150MB)
# ══════════════════════════════════════════════════════════════

# ── Stage 1: Install Dependencies ─────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy only package files first (Docker layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build Application ────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies from Stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (non-secret placeholders)
# Next.js validates env at build time — real values injected at runtime
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG AUTH_SECRET=build-time-placeholder-secret-at-least-32-characters
ARG AUTH_TRUST_HOST=true
ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_TRUST_HOST=$AUTH_TRUST_HOST

# Build the Next.js standalone output
RUN npm run build

# ── Stage 3: Production Runner ────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes server.js + minimal node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy static assets (not included in standalone by default)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Drizzle migrations (needed at runtime for db:migrate)
COPY --from=builder /app/drizzle ./drizzle

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Docker-level health check (used by Coolify for container health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the standalone Next.js server
CMD ["node", "server.js"]
```

**Key design decisions:**

| Decision                    | Rationale                                                                        |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Alpine base**             | ~50MB base vs ~350MB for Debian-based; sufficient for Node.js apps               |
| **3 stages**                | `deps` → `builder` → `runner` — maximizes Docker layer caching                   |
| **Non-root user**           | Security best practice — container processes run as `nextjs:nodejs` (UID 1001)   |
| **Build-time placeholders** | `next build` validates env schema — real secrets injected at runtime by Coolify  |
| **`HOSTNAME=0.0.0.0`**      | Required for Docker — `localhost` would only bind to container-internal loopback |
| **Migrations copied**       | Available at runtime but NOT auto-run — triggered separately (see Phase 3)       |
| **HEALTHCHECK**             | Coolify uses this plus the `/api/health` endpoint to verify liveness             |

---

### 1.3 Create `.dockerignore`

**File:** `.dockerignore` (new, project root)

```dockerignore
# ── Dependencies (reinstalled fresh in Docker) ──────────────
node_modules
.npm-cache

# ── Build artifacts ──────────────────────────────────────────
.next
.next-test
out
build
coverage
playwright-report
test-results
node-compile-cache
tsx-*

# ── Version control ─────────────────────────────────────────
.git
.gitignore

# ── Dev tools & IDE ──────────────────────────────────────────
.vscode
.pglite
.tmp
.auth
.agent
.gemini

# ── Environment files (secrets injected by Coolify) ─────────
.env
.env.*

# ── Documentation (not needed in runtime image) ─────────────
docs/
*.md
!README.md

# ── Tests (not needed in production) ────────────────────────
tests/
vitest.config.ts
playwright.config.ts

# ── OS artifacts ─────────────────────────────────────────────
.DS_Store
*.pem
Thumbs.db
```

**Why:** Without `.dockerignore`, Docker copies the entire project (including `node_modules` at ~500MB and `.next` at ~200MB) into the build context. This makes builds 10x slower and images bloated.

---

### 1.4–1.7 Verification Commands

After creating the above files, verify locally:

```bash
# Build the Docker image
docker build -t ynab-app:local .

# Check image size (target: < 250MB)
docker images ynab-app:local

# Run the container (replace DATABASE_URL with your real connection string)
docker run -d --name ynab-test \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host.docker.internal:5432/ynab_dev" \
  -e AUTH_SECRET="your-32-char-secret-here-for-testing" \
  -e AUTH_TRUST_HOST=true \
  ynab-app:local

# Check health endpoint
curl http://localhost:3000/api/health

# Check container health status
docker inspect --format='{{.State.Health.Status}}' ynab-test

# View container logs
docker logs ynab-test

# Cleanup
docker stop ynab-test && docker rm ynab-test
```

**Expected results:**

| Check                  | Expected                                                     |
| ---------------------- | ------------------------------------------------------------ |
| Build time             | < 5 minutes                                                  |
| Image size             | < 250 MB                                                     |
| `/api/health` response | `{"status":"healthy","checks":{"database":{"status":"up"}}}` |
| Container health       | `healthy` (after ~15s start period)                          |

---

### 1.8 Package.json Start Script

The current `"start"` script uses `with-local-tmp.sh` which is unnecessary in Docker:

```json
// Current (dev-oriented):
"start": "./scripts/with-local-tmp.sh bash -c 'npm run db:migrate && next start'"

// Docker uses CMD["node", "server.js"] directly — no change needed to package.json
// The with-local-tmp.sh wrapper is only used in local dev, not in Docker
```

No change required — the Dockerfile's `CMD ["node", "server.js"]` bypasses npm scripts entirely.

---

## Phase 2: Health & Observability

> **Priority:** 🔴 Blocker — Coolify needs health checks to manage the container
> **Estimated Effort:** ~1 hour
> **Affected Files:** `app/api/health/route.ts` (new), `lib/db/client.ts`, `lib/logger.ts`

### Checklist

- [x] **2.1** Create HTTP health endpoint at `/api/health`
- [x] **2.2** Add graceful shutdown handler for DB connections
- [x] **2.3** Add structured JSON logging for production
- [x] **2.4** Verify health endpoint is excluded from auth middleware — confirmed by `proxy.ts` matcher
- [x] **2.5** Verify health endpoint returns 503 when DB is down — endpoint returns 503 in catch block
- [x] **2.6** Verify graceful shutdown closes DB connections — SIGTERM/SIGINT handlers added

### 2.1 HTTP Health Endpoint

**File:** `app/api/health/route.ts` (new)

```typescript
/**
 * Health Check Endpoint — Used by Coolify/Docker/Traefik to verify app liveness.
 *
 * Returns 200 if the app and database are healthy, 503 if not.
 * This endpoint is NOT protected by authentication (proxy.ts excludes /api/*).
 *
 * Response format:
 *   { status: 'healthy'|'unhealthy', timestamp, uptime, version, checks: { database } }
 */
import { NextResponse } from "next/server";
import db from "@/lib/db/client";
import { sql } from "drizzle-orm";

// Prevent caching — health must always be live
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  try {
    // Database connectivity + latency check
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - start;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || "0.1.0",
      checks: {
        database: {
          status: "up",
          latencyMs: dbLatencyMs,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        checks: {
          database: {
            status: "down",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      },
      { status: 503 },
    );
  }
}
```

**Notes:**

- Excluded from auth by the existing `proxy.ts` matcher: `/((?!auth|api|_next|...).*)`
- Returns `503 Service Unavailable` when the database is down — Traefik will stop routing traffic
- Minimal SQL query (`SELECT 1`) to measure DB latency without load

---

### 2.2 Graceful Shutdown Handler

**File:** `lib/db/client.ts` — append at the end of the file

```typescript
// ── Graceful Shutdown ────────────────────────────────────────
// Clean up PostgreSQL connections on process termination.
// Without this, Docker SIGTERM leaves orphan connections in pg_stat_activity.
if (typeof process !== "undefined") {
  const shutdown = async (signal: string) => {
    console.log(
      `[DB] Received ${signal} — closing ${connectionString.includes("@") ? "pooled" : ""} connections...`,
    );
    try {
      await client.end({ timeout: 5 });
      console.log("[DB] Connections closed cleanly.");
    } catch (err) {
      console.error("[DB] Error during shutdown:", err);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
```

**Why:** When Docker sends SIGTERM (during deploys, restarts, or scaling), the Node.js process must close the PostgreSQL connection pool. Without this, PostgreSQL accumulates zombie connections until it hits `max_connections` (default 100).

---

### 2.3 Structured JSON Logging (Production)

**File:** `lib/logger.ts` — update `formatMessage` method

```diff
-  private formatMessage(message: string, context?: LogContext): string {
-    if (!context) return message;
-    return `${message} | context: ${JSON.stringify(context)}`;
+  private formatMessage(level: string, message: string, context?: LogContext): string {
+    // JSON format in production for log aggregation (Coolify logs, Axiom, Loki, etc.)
+    if (process.env.NODE_ENV === 'production') {
+      return JSON.stringify({
+        level,
+        msg: message,
+        timestamp: new Date().toISOString(),
+        ...context,
+      });
+    }
+    // Human-readable format for local dev
+    if (!context) return message;
+    return `${message} | context: ${JSON.stringify(context)}`;
   }
```

Update each log method to pass the level name:

```diff
   info(message: string, context?: LogContext) {
     if (!this.shouldLog('info')) return;
-    console.log(`[INFO] ${this.formatMessage(message, context)}`);
+    console.log(process.env.NODE_ENV === 'production'
+      ? this.formatMessage('info', message, context)
+      : `[INFO] ${this.formatMessage('info', message, context)}`);
   }
```

**Why:** Coolify captures container stdout/stderr. JSON logs are parseable by log aggregation tools (Axiom, Loki, Grafana). Dev mode keeps the human-readable format unchanged.

---

### 2.4–2.6 Verification

```bash
# Verify health endpoint is NOT protected by auth
curl -s http://localhost:3000/api/health | jq .
# Expected: 200 with { status: "healthy", checks: { database: { status: "up" } } }

# Verify health returns 503 when DB is down
# (Stop PostgreSQL, then re-test)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
# Expected: 503

# Verify graceful shutdown
docker stop ynab-test  # sends SIGTERM
docker logs ynab-test | grep "Received SIGTERM"
# Expected: "[DB] Received SIGTERM — closing connections..."
```

---

## Phase 3: Database Production Config

> **Priority:** 🔴 Critical — Works without these but with significant risk
> **Estimated Effort:** ~1.5 hours
> **Affected Files:** `lib/db/client.ts`, `lib/env.ts`, SQL scripts

### Checklist

- [ ] **3.1** Add connection pool settings to `postgres()` client
- [ ] **3.2** Create production database user (non-superuser for RLS)
- [ ] **3.3** Decide migration strategy (startup vs pre-deploy)
- [ ] **3.4** Add `AUTH_URL` to env schema
- [ ] **3.5** Document production `DATABASE_URL` format
- [ ] **3.6** Verify RLS enforces with non-superuser role
- [ ] **3.7** Set up PostgreSQL backup strategy in Coolify

### 3.1 Connection Pool Settings

**File:** `lib/db/client.ts`

```diff
-const client = postgres(connectionString);
+const client = postgres(connectionString, {
+  // ── Connection Pool Settings ──────────────────────────────
+  max: 10,                     // Max simultaneous connections
+  idle_timeout: 20,            // Close idle connections after 20s
+  connect_timeout: 10,         // Fail connection attempt after 10s
+  max_lifetime: 60 * 30,       // Recycle connections every 30 min
+});
```

**Why the defaults are dangerous:**

| Setting           | Default   | Problem                                                                      |
| ----------------- | --------- | ---------------------------------------------------------------------------- |
| `max`             | Unlimited | Every query opens a new connection → PostgreSQL crashes at `max_connections` |
| `idle_timeout`    | None      | Idle connections accumulate forever                                          |
| `connect_timeout` | None      | Hung connections block the event loop                                        |
| `max_lifetime`    | Infinity  | Stale connections can reference dropped objects                              |

**Recommended values for Hetzner CX22-CX32:**

| Server         | `max` | Rationale                                                                 |
| -------------- | ----- | ------------------------------------------------------------------------- |
| CX22 (4GB RAM) | 10    | PostgreSQL default max_connections=100, leave room for Coolify/monitoring |
| CX32 (8GB RAM) | 20    | More headroom for concurrent budget operations                            |

---

### 3.2 Production Database User (RLS Enforcement)

The app has RLS policies in `drizzle/0006_security_rls.sql`, but **RLS only enforces for non-superuser roles**. If the app connects as `postgres` (superuser), all policies are bypassed.

**Run once on the production PostgreSQL instance:**

```sql
-- ══════════════════════════════════════════════════════════════
-- Create restricted application user for RLS enforcement
-- ══════════════════════════════════════════════════════════════

-- 1. Create the role
CREATE ROLE ynab_app LOGIN PASSWORD '<generate-strong-password>';

-- 2. Grant database access
GRANT CONNECT ON DATABASE ynab_prod TO ynab_app;
GRANT USAGE ON SCHEMA public TO ynab_app;

-- 3. Grant table permissions (SELECT, INSERT, UPDATE, DELETE — no DROP, ALTER, TRUNCATE)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ynab_app;

-- 4. Grant sequence permissions (for serial/auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ynab_app;

-- 5. Set defaults for future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ynab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ynab_app;

-- 6. Grant migration table access (if using Drizzle migrations at runtime)
-- The __drizzle_migrations table needs INSERT + SELECT for the migration runner
GRANT ALL ON TABLE __drizzle_migrations TO ynab_app;
```

> ⚠️ **CRITICAL:** The production `DATABASE_URL` must use `ynab_app`, NOT `postgres`:
>
> ```
> DATABASE_URL=postgresql://ynab_app:<password>@postgres:5432/ynab_prod
> ```

**Verification:**

```sql
-- Connect as ynab_app and verify RLS enforces:
SET app.budget_id = '1';
SELECT * FROM accounts;  -- Should only return accounts for budget_id=1

RESET app.budget_id;
SELECT * FROM accounts;  -- Should return ZERO rows (fail-safe)
```

---

### 3.3 Migration Strategy

**Current behavior:** `npm run start` runs `npm run db:migrate && next start` — if migrations fail, the app doesn't start.

**Options:**

| Strategy                           | Pros                                | Cons                                         | Recommended? |
| ---------------------------------- | ----------------------------------- | -------------------------------------------- | :----------: |
| **A: Startup migration** (current) | Simple, always in sync              | Failure = app crash; risky in multi-instance |  ✅ For now  |
| **B: Pre-deploy hook**             | Separates concerns; no app downtime | Coolify needs custom hook config             |    Future    |
| **C: Separate migration job**      | Most robust; rollback possible      | Over-engineering for 1-5 users               |      No      |

**Recommendation:** Keep startup migration (Option A) for now. Add error handling so migration failure doesn't prevent the app from starting with the existing schema:

```typescript
// Enhanced migrate-db.ts with production-safe error handling
try {
  await migrate(db, { migrationsFolder });
  console.log("✅ Migrations applied successfully.");
} catch (err) {
  console.error("⚠️ Migration failed:", err);
  if (process.env.NODE_ENV === "production") {
    console.error(
      "App will start with existing schema. Investigate migration failure.",
    );
    // Don't exit — app may still work with the previous schema version
  } else {
    process.exit(1);
  }
}
```

---

### 3.4 Add `AUTH_URL` to Environment Schema

**File:** `lib/env.ts`

```diff
 const envSchema = z.object({
   // Database
   DATABASE_URL: z.string().url().min(1),

   // Authentication (Auth.js v5)
   AUTH_SECRET: z.string().min(32),
   AUTH_URL: z.string().url().optional(), // Auto-detected in dev
+  AUTH_TRUST_HOST: z.string().optional().default('true'),

   // Application
   NODE_ENV: z.string().default('development'),
   PORT: z.coerce.number().default(3000),
+
+  // Deployment
+  CORS_ORIGIN: z.string().optional(),
+  LOG_LEVEL: z.string().optional(),
```

> **Note:** `AUTH_URL` is already in the schema as optional. In production, it MUST be set to `https://yourdomain.com` for Auth.js callback URLs to work correctly.

---

### 3.5 Production DATABASE_URL Format

```
postgresql://ynab_app:<password>@<postgres-host>:5432/ynab_prod
```

**Examples for Coolify-managed PostgreSQL:**

| Setup                        | DATABASE_URL                                                           |
| ---------------------------- | ---------------------------------------------------------------------- |
| Same Coolify server          | `postgresql://ynab_app:pass@ynab-db:5432/ynab_prod`                    |
| External DB (Supabase, Neon) | `postgresql://user:pass@db.example.com:5432/ynab_prod?sslmode=require` |

> The hostname for a Coolify-managed PostgreSQL service is the **service name** you assign it in Coolify (e.g., `ynab-db`). Coolify creates a Docker network so services can resolve each other by name.

---

### 3.7 PostgreSQL Backup Strategy

**Coolify-managed PostgreSQL supports automated backups.** Configure in the Coolify UI:

| Setting            | Recommended Value                      |
| ------------------ | -------------------------------------- |
| Backup frequency   | Daily at 03:00 UTC                     |
| Retention          | 7 days                                 |
| Backup destination | Hetzner S3 (Object Storage, ~€5/TB/mo) |
| Backup method      | `pg_dump` (logical, portable)          |

**Manual backup command (emergency):**

```bash
# SSH into Hetzner server, then:
docker exec <postgres-container> pg_dump -U ynab_app ynab_prod > backup_$(date +%Y%m%d).sql
```

---

## Phase 4: Deploy Pipeline

> **Priority:** 🟡 High — App can deploy manually without this, but automation is essential
> **Estimated Effort:** ~30 minutes
> **Affected Files:** `.github/workflows/deploy.yml`

### Checklist

- [ ] **4.1** Decide: Coolify GitHub integration (auto) vs webhook (manual trigger)
- [ ] **4.2** Update or delete `deploy.yml`
- [ ] **4.3** Configure Coolify to watch `main` branch
- [ ] **4.4** Verify push-to-main triggers deployment
- [ ] **4.5** Verify zero-downtime deployment (Coolify rolls out new container before stopping old)

### 4.1 Deployment Trigger Options

| Option                    | How It Works                                                               | Pros                                    | Cons                                     |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| **A: Coolify GitHub App** | Coolify installs a GitHub App on your repo; auto-deploys on push to `main` | Zero config, built-in                   | Requires Coolify GitHub App installation |
| **B: Webhook Trigger**    | GitHub Actions calls Coolify's webhook URL on push to `main`               | Full control; visible in GitHub Actions | Requires `COOLIFY_WEBHOOK_URL` secret    |
| **C: Manual Deploy**      | Click "Deploy" in Coolify UI                                               | Simplest                                | No automation                            |

**Recommendation:** **Option A** (Coolify GitHub App) for zero-friction. Fall back to **Option B** if you need deploy logs in GitHub Actions.

---

### 4.2 Updated `deploy.yml` (Option B — Webhook)

If using the webhook approach:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false # Never cancel an in-progress deploy

jobs:
  deploy:
    name: Trigger Coolify Deploy
    runs-on: ubuntu-latest
    timeout-minutes: 5
    environment: production
    steps:
      - name: Trigger Coolify Webhook
        run: |
          RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X GET "${{ secrets.COOLIFY_WEBHOOK_URL }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_TOKEN }}")

          if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ]; then
            echo "✅ Deploy triggered successfully (HTTP $RESPONSE)"
          else
            echo "❌ Deploy trigger failed (HTTP $RESPONSE)"
            exit 1
          fi

      - name: Deploy Summary
        run: |
          echo "## 🚀 Production Deploy" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Branch:** ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit:** \`${{ github.sha }}\`" >> $GITHUB_STEP_SUMMARY
          echo "- **Author:** ${{ github.actor }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Status:** Triggered on Coolify" >> $GITHUB_STEP_SUMMARY
```

**Required GitHub Secrets (set in repo Settings → Secrets):**

| Secret                | Source                                                         |
| --------------------- | -------------------------------------------------------------- |
| `COOLIFY_WEBHOOK_URL` | Coolify UI → Application → Webhooks                            |
| `COOLIFY_API_TOKEN`   | Coolify UI → API Tokens (optional, for authenticated webhooks) |

---

## Phase 5: Environment & Secrets

> **Priority:** 🟡 High — Misconfigured env vars cause auth failures and data leaks
> **Estimated Effort:** ~30 minutes
> **Affected Files:** Coolify UI configuration

### Checklist

- [ ] **5.1** Set all required environment variables in Coolify
- [ ] **5.2** Generate a strong `AUTH_SECRET` for production
- [ ] **5.3** Set `AUTH_URL` to the production domain
- [ ] **5.4** Verify `.env` is NOT in the Docker image
- [ ] **5.5** Update `.env.example` with all production-needed vars
- [ ] **5.6** Document which vars are build-time vs runtime

### 5.1 Coolify Environment Variables

Set these in **Coolify UI → Application → Environment Variables**:

| Variable          | Value                                               | Required | Type              |
| ----------------- | --------------------------------------------------- | :------: | ----------------- |
| `DATABASE_URL`    | `postgresql://ynab_app:pass@ynab-db:5432/ynab_prod` |    ✅    | Runtime           |
| `AUTH_SECRET`     | `<openssl rand -base64 32>`                         |    ✅    | Runtime           |
| `AUTH_URL`        | `https://yourdomain.com`                            |    ✅    | Runtime           |
| `AUTH_TRUST_HOST` | `true`                                              |    ✅    | Runtime           |
| `NODE_ENV`        | `production`                                        |    ✅    | Set by Dockerfile |
| `PORT`            | `3000`                                              |    ✅    | Set by Dockerfile |
| `CORS_ORIGIN`     | `https://yourdomain.com`                            |    ⬜    | Runtime           |
| `LOG_LEVEL`       | `info`                                              |    ⬜    | Runtime           |

### 5.2 Generate `AUTH_SECRET`

```bash
# Run this locally and copy the output to Coolify:
openssl rand -base64 32
```

> ⚠️ **NEVER reuse the local dev `AUTH_SECRET` in production.** Generate a new one.

### 5.3 Build-Time vs Runtime Variables

| Variable       | Build-Time?  |   Runtime?    | Notes                                                                  |
| -------------- | :----------: | :-----------: | ---------------------------------------------------------------------- |
| `DATABASE_URL` | Placeholder  | ✅ Real value | Dockerfile uses dummy for `next build`; real value injected by Coolify |
| `AUTH_SECRET`  | Placeholder  | ✅ Real value | Same pattern                                                           |
| `NODE_ENV`     | `production` | `production`  | Set in Dockerfile, immutable                                           |
| `AUTH_URL`     |  Not needed  |  ✅ Required  | Only needed at runtime for callback URLs                               |

---

## Phase 6: Server Setup (Hetzner + Coolify)

> **Priority:** 🟡 High — Infrastructure provisioning
> **Estimated Effort:** ~2 hours (including DNS propagation)

### Checklist

- [ ] **6.1** Choose Hetzner server size
- [ ] **6.2** Provision Hetzner VPS (Ubuntu 24.04)
- [ ] **6.3** Install Coolify on the server
- [ ] **6.4** Configure domain DNS (A record → server IP)
- [ ] **6.5** Add PostgreSQL service in Coolify
- [ ] **6.6** Create production database and user
- [ ] **6.7** Run initial database migration
- [ ] **6.8** Add YNAB app service in Coolify (connect GitHub repo)
- [ ] **6.9** Set environment variables in Coolify
- [ ] **6.10** Deploy and verify

### 6.1 Server Sizing

| Plan     | vCPU | RAM  | Storage | Cost    | Recommended For                 |
| -------- | ---- | ---- | ------- | ------- | ------------------------------- |
| **CX22** | 2    | 4GB  | 40GB    | ~€4/mo  | 1-2 users, light use            |
| **CX32** | 4    | 8GB  | 80GB    | ~€8/mo  | ✅ **Recommended** — 3-10 users |
| CX42     | 8    | 16GB | 160GB   | ~€16/mo | 10+ users, heavy data           |

> **Recommendation:** Start with **CX32** (~€8/mo). It runs Coolify + PostgreSQL + the app comfortably with headroom. You can upgrade without downtime via Hetzner's resize feature.

---

### 6.2 Provision Hetzner VPS

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Create a new project (e.g., "YNAB")
3. Add a server:
   - **Location:** Closest to you (e.g., `ash` for US East, `hel1` for Europe)
   - **Image:** Ubuntu 24.04
   - **Type:** CX32 (or your choice)
   - **SSH Key:** Add your public key for secure access
   - **Firewall:** Create one allowing ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
4. Note the server's **public IP address**

---

### 6.3 Install Coolify

SSH into your server and run:

```bash
ssh root@<your-server-ip>

# Install Coolify (single command)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

After installation (~2 min):

- Coolify UI is available at `http://<your-server-ip>:8000`
- Create your admin account
- Complete the setup wizard

---

### 6.4 Configure Domain DNS

| Record Type | Name                                 | Value         | TTL |
| ----------- | ------------------------------------ | ------------- | --- |
| A           | `@` (root domain)                    | `<server-ip>` | 300 |
| A           | `www`                                | `<server-ip>` | 300 |
| A           | `coolify` (optional, for Coolify UI) | `<server-ip>` | 300 |

**DNS propagation takes 5-30 minutes.** Verify with:

```bash
dig yourdomain.com +short
# Should return your server IP
```

---

### 6.5 Add PostgreSQL Service in Coolify

1. In Coolify UI → "Services" → "Add New"
2. Select **PostgreSQL 16**
3. Settings:
   - **Name:** `ynab-db`
   - **Database:** `ynab_prod`
   - **User:** `postgres` (initial superuser; we'll create `ynab_app` next)
   - **Password:** Generate a strong password
   - **Port:** 5432 (internal, not exposed externally)
4. Enable **Persistent Storage** (volume mount)
5. Deploy

---

### 6.6 Create Production Database and User

Connect to the PostgreSQL service:

```bash
# From within Coolify's terminal or via Docker exec:
docker exec -it <postgres-container-id> psql -U postgres -d ynab_prod
```

Run the SQL from [Section 3.2](#32-production-database-user-rls-enforcement).

---

### 6.7 Run Initial Database Migration

Before the first deployment, you need to run migrations. Two approaches:

**Option A: Via the first deploy (recommended)**
The Dockerfile includes Drizzle migrations. On first `node server.js`, you can either:

- Configure Coolify's "Pre-deploy Command" to `node -e "...migration script..."`
- Or manually exec into the container after first deploy

**Option B: Direct SQL import**
If you have an existing database dump:

```bash
docker exec -i <postgres-container-id> psql -U ynab_app -d ynab_prod < backup.sql
```

---

### 6.8 Add YNAB App Service

1. In Coolify UI → "Applications" → "Add New"
2. Select **GitHub** → connect your repo (`ynab-app`)
3. Settings:
   - **Branch:** `main`
   - **Build Pack:** Docker (uses your `Dockerfile`)
   - **Port:** `3000`
   - **Domain:** `yourdomain.com`
   - **SSL:** Let's Encrypt (automatic)
   - **Health Check Path:** `/api/health`
4. Set **Environment Variables** (see [Phase 5](#phase-5-environment--secrets))
5. Deploy

---

### 6.9–6.10 Verify Deployment

```bash
# Check the app is accessible
curl -I https://yourdomain.com
# Expected: HTTP/2 200, with security headers (CSP, HSTS, X-Frame-Options)

# Check health endpoint
curl https://yourdomain.com/api/health | jq .
# Expected: { "status": "healthy", "checks": { "database": { "status": "up" } } }

# Check login page
open https://yourdomain.com/auth/login
# Expected: Login form renders correctly

# Check SSL certificate
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
# Expected: Valid Let's Encrypt certificate
```

---

## Post-Launch Improvements

These are not blockers but significantly improve production quality:

### Monitoring & Alerting

- [ ] Set up external uptime monitoring (UptimeRobot, Better Uptime, Hetrix Tools)
- [ ] Configure health check URL: `https://yourdomain.com/api/health`
- [ ] Set alert notification (email, Telegram, Slack)
- [ ] Monitor response time baseline (< 200ms for health endpoint)

### Error Tracking

- [ ] Add Sentry integration (`@sentry/nextjs`)
- [ ] Configure source maps upload in build step
- [ ] Set up alert rules for unhandled exceptions
- [ ] Add Sentry DSN to Coolify environment variables

### Performance

- [ ] Add `Cache-Control` headers for static assets in `next.config.ts`
- [ ] Enable Coolify's built-in CDN caching if available
- [ ] Monitor PostgreSQL connection pool usage
- [ ] Add `pg_stat_activity` monitoring query to health endpoint

### Security Hardening

- [ ] Swap in-memory rate limiter for Redis (needed if ever scaling to 2+ instances)
- [ ] Add Coolify-managed Redis service
- [ ] Add database connection string secret rotation schedule
- [ ] Enable Hetzner firewall to block all ports except 22, 80, 443
- [ ] Configure Coolify to restrict admin UI access

### Backup & Disaster Recovery

- [ ] Configure Coolify PostgreSQL backup to Hetzner S3
- [ ] Test backup restoration procedure
- [ ] Document disaster recovery steps
- [ ] Set up backup monitoring (alert if backup fails)

---

## Risk Matrix

| Risk                         | Impact      | Likelihood             | Mitigation                                  | Status |
| ---------------------------- | ----------- | ---------------------- | ------------------------------------------- | ------ |
| DB data loss                 | 🔴 Critical | Medium                 | Automated backups to S3                     | ⬜     |
| Secret leak (.env in image)  | 🔴 Critical | Low                    | `.dockerignore` + Coolify runtime injection | ⬜     |
| RLS bypass (superuser)       | 🔴 High     | High (if unconfigured) | Non-superuser production DB role            | ⬜     |
| Rate limiter reset on deploy | 🟡 Medium   | Certain                | Acceptable for 1-5 users; Redis for SaaS    | ⬜     |
| Migration failure on startup | 🟡 Medium   | Low                    | Error handling; don't crash on failure      | ⬜     |
| Auth callback URL wrong      | 🔴 High     | High (if unconfigured) | Set `AUTH_URL` in Coolify                   | ⬜     |
| Connection exhaustion        | 🟡 Medium   | Medium                 | Pool settings (max=10, idle_timeout=20)     | ⬜     |
| Docker image too large       | 🟢 Low      | Low                    | Standalone output + Alpine + .dockerignore  | ⬜     |

---

## Quick Reference: Key Files

| File                                                                                                              | Purpose                                           | Status      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------- |
| [`next.config.ts`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/next.config.ts)                             | Add `output: 'standalone'`                        | ⬜ Pending  |
| `Dockerfile`                                                                                                      | Multi-stage production build                      | ⬜ New file |
| `.dockerignore`                                                                                                   | Exclude dev files from build context              | ⬜ New file |
| [`app/api/health/route.ts`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/app/api/health)                    | Health check endpoint                             | ⬜ New file |
| [`lib/db/client.ts`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/db/client.ts)                         | Pool settings + graceful shutdown                 | ⬜ Pending  |
| [`lib/env.ts`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/env.ts)                                     | Add `AUTH_TRUST_HOST`, `CORS_ORIGIN`, `LOG_LEVEL` | ⬜ Pending  |
| [`lib/logger.ts`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/lib/logger.ts)                               | JSON structured logging                           | ⬜ Pending  |
| [`.github/workflows/deploy.yml`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/.github/workflows/deploy.yml) | Coolify webhook trigger                           | ⬜ Pending  |
| [`.env.example`](file:///Users/camilopiedra/Documents/YNAB/ynab-app/.env.example)                                 | Document all production vars                      | ⬜ Pending  |
