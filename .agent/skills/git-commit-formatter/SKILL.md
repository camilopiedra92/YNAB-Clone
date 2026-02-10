---
name: git-commit-formatter
description: Professional, zero-loop Git workflow. Enforces Conventional Commits and atomic "Autopilot" execution.
---

# Skill: Git Commit Formatter (Professional Protocol)

## 🎯 THE ONE-TURN AUTOPILOT

To prevent architectural failure (defined as "The Loop of Death"), you MUST use the **Autopilot** script for ALL commit/push requests. This script is the single source of truth for repository state.

### 1. Mandatory Core Command

```bash
# Set Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app
bash .agent/skills/git-commit-formatter/scripts/autopilot.sh "type(scope): message" ["body"] ["footer"]
```

### 2. Forbidden Investigative Commands (The "Loop of Death")

Running any of the following commands in the context of a commit/push task is considered an **Architectural Failure**:

- ❌ `git status`
- ❌ `git log`
- ❌ `git diff`
- ❌ `ls -R` (to find changes)
- ❌ `find . -name ".git"` (to locate repo)

**Why**: If `autopilot.sh` says "SYNCED", the task is complete. If it says "ACTION NEEDED", it will provide the diagnostic you need. Manual investigation is redundant and frustrates the USER.

---

## 🛠️ ARCHITECTURAL PROTOCOL

### 1. The "Success" State

One command MUST lead to the goal. Your turn ends when `autopilot.sh` reports `📊 STATUS: SUCCESS` or `📊 STATUS: SYNCED`.

### 2. The "Cwd" Standard

- **Valid Root**: `/Users/camilopiedra/Documents/YNAB/ynab-app`
- If you are in the workspace root, immediately `cd` (informative) or just set `Cwd` in the tool call.

### 3. Conventional Commitment

Refer to `resources/scope-map.md` for the mandatory `type(scope)` format. Use:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `style`: Changes that do not affect the meaning of the code
- `chore`: Updating build tasks, package manager configs, etc.

---

## 📚 RESOURCES (Diagnostic Only)

- **Scope Map**: `.agent/skills/git-commit-formatter/resources/scope-map.md`
- **Good Examples**: `.agent/skills/git-commit-formatter/examples/good-commits.md`
- **Validator**: `.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh`

**ONE COMMAND. ZERO LOOPS. ARCHITECTURAL EXCELLENCE.**
