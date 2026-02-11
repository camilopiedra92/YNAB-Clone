---
name: git-commit-formatter
description: "MANDATORY for any git commit, push, save, subir, or enviar request. Executes npm run git:sync as a single atomic command — zero exploration, zero loops. Enforces Conventional Commits format."
---

# Skill: Git Commit Formatter (Professional Protocol)

## 🛑 THE SHORT-CIRCUIT PROTOCOL (MANDATORY)

To prevent architectural failure (defined as "The Loop of Death"), you MUST use the **Autopilot** script as your **FIRST AND ONLY** tool call whenever a user mentions "commit", "subir", "envía", "push", or "save".

### 1. The Golden Rule of Location

**NEVER** use `git status` or `ls` to find the Git root.

- **The Repo root is ALWAYS**: `/Users/camilopiedra/Documents/YNAB/ynab-app`
- **The Protocol is ALWAYS**: Run `npm run git:sync -- "type(scope): message"` with `Cwd` set to that root.

### 2. Forbidden Investigative Commands

Running any of these is an **Architectural Failure**:

- ❌ `git status`, `git log`, `git diff`, `git branch`
- ❌ `ls -R`, `find`, or exploring parent directories for `.git`
- ❌ Asking "What should I commit?" if you just finished a task.

---

## 🎯 THE ONE-TURN AUTOPILOT

```bash
# MANDATORY: Set Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app
npm run git:sync -- "type(scope): message" ["body"] ["footer"]
```

### 1. The "No Second Opinion" Rule

If `npm run git:sync` returns `📊 STATUS: SYNCED` or `📊 STATUS: SUCCESS`:

- You are **FORBIDDEN** from running any secondary commands to "verify".
- The script is the final authority. Even if you _think_ there should be changes, trust the script.
- **Immediate Termination**: Inform the user of the status and STOP.

### 2. Verification Fatigue (Detection)

If you find yourself thinking: _"Let me just check if it really pushed..."_ -> **STOP.** You are entering the Loop of Death. Trust the `SUCCESS` status.

---

## 📏 HEADER LENGTH LIMIT (72 CHARACTERS MAX)

The validator enforces a **maximum of 72 characters** for the entire header line (`type(scope): description`). This is a hard limit — the commit will be rejected if exceeded.

### Practical Guidance

- The `type(scope): ` prefix uses ~15–20 chars, leaving **~52–57 chars** for the description.
- **Keep descriptions short and punchy.** Summarize the _what_, not every detail.
- Use the **body** argument for additional context (100 chars/line limit).

### Examples

```bash
# ❌ TOO LONG (75 chars) — REJECTED
npm run git:sync -- "refactor(audit): extract TransactionModal form hook, fix TMPDIR config, complete audit phases"

# ✅ CONCISE (48 chars) — ACCEPTED
npm run git:sync -- "refactor(audit): extract form hook and fix test config"

# ✅ WITH BODY for details (header short, body has context)
npm run git:sync -- "refactor(audit): extract form hook and fix test config" "- Extract useTransactionForm from TransactionModal
- Add TMPDIR override in vitest.config.ts"
```

### Rule of Thumb

If the description has commas or "and" connecting 3+ items, it's too long. Pick the most important change for the header and put the rest in the body.

---

## 🛠️ ARCHITECTURAL PROTOCOL

### 0. Branch Awareness (Critical)

`sync.sh` **blocks** direct pushes to `main`. If the user is on `main`, you MUST first switch to a feature branch (from `staging`) or to `staging` directly before committing. Direct pushes to `staging` are allowed for trivial changes (the user is a bypass actor on the GATE ruleset).

### 1. The "Success" State

One command MUST lead to the goal. Your turn ends when `npm run git:sync` reports `📊 STATUS: SUCCESS` or `📊 STATUS: SYNCED`.

### 2. Conventional Commitment

Refer to `resources/scope-map.md` for the mandatory `type(scope)` format.

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation only
- `refactor`: Code change
- `chore`: Maintenance/Sync

---

## 🔀 POST-SYNC: PR Operations (via `gh` CLI)

After a successful sync, the user may ask to create a PR or merge. Use `gh` CLI:

```bash
# Create PR to staging
gh pr create --base staging --title "type: description"

# Create PR to promote staging to production
gh pr create --base main --head staging --title "chore: promote to production"

# Check PR status
gh pr checks

# Merge PR (feature → staging: OK with --delete-branch)
gh pr merge --merge --delete-branch

# Merge PR (staging → main: ⚠️ NEVER use --delete-branch)
gh pr merge --merge
```

### 🛑 Merge Safety Rule (CRITICAL — Staging Protection)

**`staging` must NEVER be deleted.** Three layers protect it:

1. **GitHub:** `delete_branch_on_merge = false` (prevents auto-deletion)
2. **Ruleset:** "Restrict deletions" on staging
3. **Agent:** Commands below explicitly prohibit `--delete-branch` for staging

- **Feature → staging:** `--delete-branch` is OK (cleans up the feature branch)
- **Staging → main:** **NEVER** pass `--delete-branch` — it deletes `staging`!

**Recovery if staging is accidentally deleted:**

```bash
git checkout main && git checkout -b staging && git push -u origin staging
```

---

## 📚 RESOURCES (Diagnostic Only)

- **Scope Map**: `.agent/skills/git-commit-formatter/resources/scope-map.md`
- **Validator**: `.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh`

**ONE COMMAND. ZERO LOOPS. ARCHITECTURAL EXCELLENCE.**
