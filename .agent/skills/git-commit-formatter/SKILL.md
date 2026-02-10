---
name: git-commit-formatter
description: Enforce Conventional Commits specification. Minimize turn count and prevent directory exploration loops.
---

# Skill: Git Commit Formatter (Professional Protocol)

## 🎯 THE ONE-TURN PROTOCOL

To avoid "vueltas" (loops) and frustrating the USER, you MUST use the provided scripts. They are the single source of truth for repository state.

### 1. Mandatory Pre-flight (The ONLY first step)

Before running ANY `git` command, run the health check. This validates your directory and the worktree state in one turn.

```bash
# Set Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app
bash .agent/skills/git-commit-formatter/scripts/check-worktree-health.sh
```

### 2. The Verdict (Strict Obedience)

- **If Verdict is `🛑 [STOP]`**: Immediately report: _"Repo clean and synced. Nothing to commit or push."_ and **STOP**.
- **DO NOT** "double-check" with `git status`, `git log`, or `ls`.
- **DO NOT** look for `.git` in parent folders.

- **If Verdict is `🚀 [PROCEED]`**:
  1. `git add .` (if there are unstaged changes you intended to include).
  2. Execute commit with the smart script (see below).
  3. `git push`.

---

## 🛠️ EXECUTION COMMANDS

Always use absolute paths for scripts or ensure `Cwd` is `/Users/camilopiedra/Documents/YNAB/ynab-app`.

### Smart Commit (Validation + Commit)

```bash
# Usage: bash <path_to_script> "header" ["body"] ["footer"]
bash /Users/camilopiedra/Documents/YNAB/ynab-app/.agent/skills/git-commit-formatter/scripts/smart-commit.sh "feat(ui): add budget summary"
```

---

## 📐 ARCHITECTURAL CONSTRAINTS

### 1. Repository Lockdown

- **Valid Root**: `/Users/camilopiedra/Documents/YNAB/ynab-app`
- **Invalid Root**: `/Users/camilopiedra/Documents/YNAB` (Workspace root)
- If a command fails with `not a git repository`, **change Cwd to the Valid Root**. Do not investigate.

### 2. Message Standards (Conventional Commits)

- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scope**: Required for most commits. Refer to `resources/scope-map.md`.
- **Format**: `type(scope): description` (lowercase, imperative, no period).

### 3. Anti-Patterns (The "Loop of Death")

The following behaviors are considered architectural failures in this skill:

- Running `git status` manually after a script already reported status.
- Checking parent directories for `.git` folders.
- Running `git log` to see if a push is needed (The health check handles this).
- Investigating ignored files instead of trusting `.gitignore`.

---

## 📚 RESOURCES

- **Scope Map**: `.agent/skills/git-commit-formatter/resources/scope-map.md`
- **Good Examples**: `.agent/skills/git-commit-formatter/examples/good-commits.md`
- **Bad Examples**: `.agent/skills/git-commit-formatter/examples/bad-commits.md`
- **Validator**: `.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh`

**TRUST THE SCRIPTS. ONE TURN. NO LOOPS.**
