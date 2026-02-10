---
name: git-commit-formatter
description: Professional, zero-loop Git workflow. Enforces Conventional Commits and atomic "Autopilot" execution.
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

## 🛠️ ARCHITECTURAL PROTOCOL

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

## 📚 RESOURCES (Diagnostic Only)

- **Scope Map**: `.agent/skills/git-commit-formatter/resources/scope-map.md`
- **Validator**: `.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh`

**ONE COMMAND. ZERO LOOPS. ARCHITECTURAL EXCELLENCE.**
