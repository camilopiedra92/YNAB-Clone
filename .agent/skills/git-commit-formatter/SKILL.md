---
name: git-commit-formatter
description: Enforce the Conventional Commits specification for all Git commits in this project. Proactively manage staged changes, validate messages, and prevent redundant investigation cycles.
---

# Skill: Git Commit Formatter (Conventional Commits)

## 🚨 THE GOLDEN RULE OF LOCATION (MANDATORY)

The project has a nested structure. You **MUST** verify your location before running any Git command. If you ignore this, you will waste turns and frustrate the user.

- **Workspace Root (FORBIDDEN for Git):** `/Users/camilopiedra/Documents/YNAB`
- **Project/Git Root (REQUIRED for Git):** `/Users/camilopiedra/Documents/YNAB/ynab-app`

### Actionable Rule:

All Git commands (`git status`, `git add`, `git commit`, `git push`) and the health check script **MUST** be run with:
`Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app`

---

## 🛑 Step 0: Mandatory Pre-flight Short-Circuit

**BEFORE you do anything else (no `git status`, no `ls`, nothing):**

1.  **Run Health Check**: Execute `bash /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/check-worktree-health.sh`.
2.  **Obey the Verdict**:
    - If the verdict is `🛑 [STOP]`, immediately inform the user: _"El repositorio está limpio y sincronizado. No hay cambios pendientes ni commits por subir."_ and **END THE TURN IMMEDIATELY**.
    - If you see `❌ Error: .git directory not found`, you are in the wrong directory. Go to `/Users/camilopiedra/Documents/YNAB/ynab-app`.
    - **CRITICAL**: Do **NOT** run `git status` or check parent directories if the script tells you where you are or if everything is clean.

---

## 🚀 Turbo Flow (Standard Path)

Always try this automated sequence first. It reduces manual verification steps.

### Step 1: Pre-flight Health Check

Run the health check to detect junk files and see a summary of changes:

```bash
# Path: /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/check-worktree-health.sh
bash /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/check-worktree-health.sh
```

- **Action:** If junk files are flagged (e.g., `tsx-*`), update `.gitignore` before proceeding.
- **Action:** Ensure all intended changes are **staged** (`git add`).

### Step 2: Atomic Commit & Validate

Execute the commit with built-in validation. Use absolute paths:

```bash
# Path: /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/smart-commit.sh
bash /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/smart-commit.sh "type(scope): description" "body" "footer"
```

- This script automatically:
  1.  Validates the message format.
  2.  Sets the correct `--author` if git isn't configured.
  3.  Executes `git commit`.

---

## 1. Allowed Types

(Same as before: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert)

## 2. Scope Inference (Quick lookup)

(Same as before: engine, repo, api, hooks, ui, test, db, schema, skills, rules, workflows, scripts, docs)

---

## 3. Manual Fallback & Rules (If scripts fail)

If you cannot run the automated scripts, follow this manual sequence:

### Step 1: Analyze Diff

```bash
git diff --cached --stat        # staged files summary
```

### Step 2: Write Message & Validate

```bash
# Validate (Absolute Path)
echo "feat(engine): add function" | bash /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh --stdin
```

### Step 3: Commit

```bash
git commit -m "<header>" -m "<body>"
```

## 4. Splitting Commits

**Split** when:

- Changes span unrelated features (e.g., bug fix + new feature)
- A refactor enables a feature — commit refactor first, then feature
- Test additions are separate from the code they test (debatable — colocate if small)

**Don't split** when:

- A feature naturally touches engine + repo + hook + component (one logical change)
- A fix requires updating tests for the same bug

## 5. Special Cases

### Breaking Changes

```
feat(api)!: change budget response format to v2

Migrate the budget API response from flat structure to nested
category groups. All clients must update their parsers.

BREAKING CHANGE: /api/budgets/:id response shape changed.
Old: { categories: [...] }
New: { categoryGroups: [{ categories: [...] }] }
```

Note the `!` after the scope — this is an alternative to the footer for simple breaks.

### Reverting Commits

```
revert: revert "feat(auth): implement login with google"

This reverts commit abc1234def5678.
Reason: OAuth provider rate limiting causing login failures.
```

### Merge Commits

Don't rewrite merge commit messages — leave Git's default format.

### Initial / WIP Commits

- First commit: `chore: initial project setup`
- WIP is discouraged. If you must: `chore(wip): scaffold transaction import flow` — but squash before merging.

## 6. Validation Script (Absolute Path Recommended)

Use [scripts/validate-commit-msg.sh](scripts/validate-commit-msg.sh) to check messages. **Always use the absolute path** if you are inside a subdirectory like `ynab-app/`:

```bash
# Validate a message from stdin (Absolute Path)
echo "feat(engine): add new function" | bash /Users/camilopiedra/Documents/YNAB/.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh --stdin

# Validate a message passed as argument (Absolute Path)
bash /Users/camilopiedra/Documents/YNAB/.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh "feat(engine): add new function"

# Show help
bash .agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh --help
```

## 7. Quick Reference

See [examples/good-commits.md](examples/good-commits.md) for 10+ real-world examples tailored to this codebase.

See [examples/bad-commits.md](examples/bad-commits.md) for anti-patterns and what's wrong with each.

## 8. Common Agent Pitfalls (Lessons Learned)

These are specific rules to avoid common errors when using Git in this environment:

### A. Project Root Lockdown

- **Repo Authority**: The ONLY git repository is at `/Users/camilopiedra/Documents/YNAB/ynab-app`.
- **Never** look for `.git` in parent directories (e.g., `/Users/camilopiedra/Documents/YNAB`).
- If `git status` fails, assume you are in the wrong directory and go to `Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app` immediately.

### B. Command Efficiency (The "One-Turn" Rule)

1.  **Trust the Script**: The `check-worktree-health.sh` is your single source of truth.
2.  **No "Double-Checking"**: If the script says `🛑 [STOP]`, do NOT run `git log`, `git status`, or `ls`. Every extra command is a wasted turn.

### C. Why Agents Fail (The Loop of Death)

**Scenario**: User asks for a commit ➔ Agent runs Health Check ➔ Health Check says `🛑 [STOP]`.

**The Failure Mode (Do NOT do this)**:

- "Let me just check `git status` to be sure..."
- "Wait, is there a `.git` in the parent folder?"
- "Maybe there are unpushed commits? Let me check `git log`..."
- "Are there ignored files that should be tracked?"

**The Result**: 5+ wasted turns to confirm a "Nothing to do" state.

**The Fix**: When you see `🛑 [STOP]`, you **MUST** stop and report. Any attempt to "verify" the stop signal is a violation of this skill.

### D. The Workspace Root Trap

**Scenario**: You are in `/Users/camilopiedra/Documents/YNAB` and try to run `git status`.

**The Error**: `fatal: not a git repository`.

**The Failure Mode**:

- Investigating why there is no repository.
- Running `ls -R` or `find` to find `.git`.
- Guessing where the code is.

**The Fix**: Read the file system! The code is in `/Users/camilopiedra/Documents/YNAB/ynab-app`. Change your `Cwd` and stop investigating.

## 9. The "Nothing to Commit" Short-Circuit (Stop the Vueltas)

If the user asks to commit/push but your initial check shows a clean state:

1.  **Trust `git status`**: If `ynab-app` is clean and has no untracked files of interest, **STOP**.
2.  **Fast-Fail Message**: Inform the user immediately:
    > "El repositorio está limpio y sincronizado. No hay cambios pendientes ni commits por subir."
3.  **No Investigation**: Do NOT run `ls -R`, `find`, or check parent directories.
4.  **Detecting the Trap**: If you run more than 1 `run_command` after a `🛑 [STOP]` verdict, you are in a loop. Break out.

## Resources

| File                                                             | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [scripts/validate-commit-msg.sh](scripts/validate-commit-msg.sh) | Commit message validator script              |
| [examples/good-commits.md](examples/good-commits.md)             | Good commit message examples (YNAB-specific) |
| [examples/bad-commits.md](examples/bad-commits.md)               | Anti-pattern examples with explanations      |
| [resources/scope-map.md](resources/scope-map.md)                 | Directory → scope mapping table              |
