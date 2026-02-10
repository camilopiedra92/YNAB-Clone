---
name: git-commit-formatter
description: Formats and validates git commit messages according to the Conventional Commits specification. Use when making commits, writing commit messages, or reviewing commit history. Enforces type, scope, description, body, and footer conventions.
---

# Skill: Git Commit Formatter

Use this skill **every time you write a git commit message**. It enforces the [Conventional Commits](https://www.conventionalcommits.org/) specification with automated validation.

## 📂 Directory Protocol (MANDATORY)

The project has a nested structure. You **MUST** verify your location before running any Git command:

- **Workspace Root:** `/Users/camilopiedra/Documents/YNAB`
- **Project/Git Root:** `/Users/camilopiedra/Documents/YNAB/ynab-app`

### The Rule of Thumb:

All Git commands (`git status`, `git add`, `git commit`, `git push`) **MUST** be run with:
`Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app`

---

## 🚀 Turbo Flow (Primary Path)

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

### A. Context Verification (The "Fatal" Rule)

If you see `fatal: not a git repository`:

1.  **Stop and Reflect**: You are likely at the workspace root instead of the project root.
2.  **Immediate Fix**: Switch to `Cwd: /Users/camilopiedra/Documents/YNAB/ynab-app`.
3.  **Proactive Check**: Before running any Git command, check if `.git` exists in the current directory.

### B. Command Efficiency (The "One-Turn" Rule)

To avoid "giving many turns" (looping unnecessarily):

1.  **Batch Actions**: If you have multiple files to stage, use `git add .` or list them all in one command.
2.  **Combine Check & Commit**: If the status is already known from previous tool outputs, skip redundant `git status` calls and move straight to commit.
3.  **Smart Status**: Use `git status -s` for a concise overview that is easier to parse in one glance.

### B. Gitignore Awareness (The "Stuck" Rule)

If a file won't stage or `git status` doesn't show it:

1.  Check if it's ignored: `git check-ignore -v <path>`
2.  If ignored but needs tracking, update `.gitignore` first.
3.  Use `git status -uno` to clear the noise if there are hundreds of untracked files.

### C. Atomic Edits (The "Newline" Rule)

When editing `.gitignore` or similar files:

1.  **Avoid `echo "..." >> .gitignore`**: This often introduces incorrect characters or formatting.
2.  **Use `replace_file_content`**: It's more reliable for maintaining correct line breaks and ensuring the file doesn't end up with values like `\n# DB backup`.

### D. Identity Management

If Git complains about local identity:

- Use `git commit -m "..." --author="Camilo Piedrahita Hernández <camilopiedra@Camilos-MacBook-Pro.local>"` if you need to fix a commit author, or just follow the user's lead if they've already set it up.

## 9. The "Nothing to Commit" Short-Circuit (Stop the Vueltas)

If the user asks to commit/push but your initial check shows a clean state:

1.  **Trust `git status`**: If `ynab-app` is clean and has no untracked files of interest, **STOP**.
2.  **Check Unpushed Commits**: Run `git log @{u}..` to see if there are commits waiting to be pushed.
3.  **Fast-Fail Message**: If there are no changes AND no unpushed commits, inform the user immediately:
    > "El repositorio está limpio y sincronizado. No hay cambios pendientes ni commits por subir."
4.  **No Investigation**: Do NOT run `ls -R`, `find`, or check parent directories unless the user explicitly mentions a file that you can't find.

## Resources

| File                                                             | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [scripts/validate-commit-msg.sh](scripts/validate-commit-msg.sh) | Commit message validator script              |
| [examples/good-commits.md](examples/good-commits.md)             | Good commit message examples (YNAB-specific) |
| [examples/bad-commits.md](examples/bad-commits.md)               | Anti-pattern examples with explanations      |
| [resources/scope-map.md](resources/scope-map.md)                 | Directory → scope mapping table              |
