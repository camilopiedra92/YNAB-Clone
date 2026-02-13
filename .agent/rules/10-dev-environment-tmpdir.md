---
description: Mandatory local temp directory, npm cache, and script execution rules for sandboxed dev environments.
---

# Dev Environment: Local Temp Directory, npm Cache & Script Execution

**This rule is MANDATORY.** The development environment (Antigravity sandbox) blocks access to system temp directories (`/var/folders/`, `/tmp/`) and the global npm cache (`~/.npm/_cacache`). All processes MUST use the project-local `.tmp/` directory.

## 1. The Centralized Wrapper: `scripts/with-local-tmp.sh`

All npm scripts in `package.json` use `./scripts/with-local-tmp.sh` to:

1. Create `.tmp/` in the project root (`mkdir -p`)
2. Export `TMPDIR=<project>/.tmp` (redirects temp files)
3. Export `npm_config_cache=<project>/.tmp/npm-cache` (redirects npm's cache)
4. Execute the actual command via `exec "$@"`

**This wrapper is the SINGLE SOURCE OF TRUTH for temp directory AND npm cache handling.** Do not inline these exports anywhere.

## 2. Rules for Running Commands

### ✅ Always Use `npm run <script>`

```bash
# ✅ CORRECT — goes through the wrapper automatically
npm run test
npm run build
npm run db:migrate
npm run health:check
```

### ❌ Never Run Scripts Directly Without the Wrapper

```bash
# ❌ WRONG — will fail with EPERM in sandboxed environments
npx tsx scripts/debug-rta.ts
node --env-file=.env --import tsx/esm scripts/health-check.ts
npx vitest run

# ✅ CORRECT — use the npm script entry
npm run db:debug-rta
npm run health:check
npm run test
```

### ✅ Ad-hoc Commands That Need Temp or npm Cache

If you must run a one-off command NOT in `package.json`, prefix it with the wrapper:

```bash
# Ad-hoc scripts
./scripts/with-local-tmp.sh node --env-file=.env some-script.ts

# Ad-hoc npm/npx commands (audit, outdated, depcheck, madge, etc.)
./scripts/with-local-tmp.sh npm audit --audit-level=moderate
./scripts/with-local-tmp.sh npm outdated
./scripts/with-local-tmp.sh npx -y depcheck
./scripts/with-local-tmp.sh npx -y madge --circular --extensions ts,tsx lib/
```

> **CRITICAL:** Commands like `npm audit`, `npm outdated`, `npx depcheck`, and `npx madge` access the global npm cache (`~/.npm/_cacache`). In the Antigravity sandbox this directory is inaccessible, causing `EPERM: operation not permitted` errors. **ALWAYS** prefix these with the wrapper or use `npm run` scripts.

## 3. Rules for Adding New Scripts

When adding a new script to `package.json`:

1. **Always prefix** with `./scripts/with-local-tmp.sh`
2. **Use `node --env-file=.env`** for scripts that need environment variables
3. **Use `bash -c '...'`** for compound commands (pipelines with `&&`)

```json
// ✅ Simple command
"my-script": "./scripts/with-local-tmp.sh node --env-file=.env --import tsx/esm scripts/my-script.ts"

// ✅ Compound command
"my-pipeline": "./scripts/with-local-tmp.sh bash -c 'npm run db:migrate && next dev'"
```

## 4. What NOT to Do

- ❌ **Never inline** `mkdir -p .tmp && TMPDIR=.tmp` in `package.json` — use the wrapper
- ❌ **Never remove** the wrapper prefix from existing scripts
- ❌ **Never write to system temp** (`/tmp/`, `/var/folders/`) directly in any script or code
- ❌ **Never run `npx`/`node` directly** for project scripts — use `npm run`
- ❌ **Never run bare `npm audit`, `npm outdated`, `npx depcheck`** — always prefix with the wrapper
- ❌ **Never modify** `with-local-tmp.sh` without updating all dependent docs (workflows, rules)
