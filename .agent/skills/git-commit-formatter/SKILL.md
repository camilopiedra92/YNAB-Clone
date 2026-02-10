---
name: git-commit-formatter
description: Formats and validates git commit messages according to the Conventional Commits specification. Use when making commits, writing commit messages, or reviewing commit history. Enforces type, scope, description, body, and footer conventions.
---

# Skill: Git Commit Formatter

Use this skill **every time you write a git commit message**. It enforces the [Conventional Commits](https://www.conventionalcommits.org/) specification with project-specific scope conventions.

## Commit Message Format

```
<type>(<scope>): <description>
                                    ← blank line
[optional body]
                                    ← blank line
[optional footer(s)]
```

### Header Rules (Mandatory)

| Part            | Rule                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| **type**        | Must be from the allowed list (see §1)                                          |
| **scope**       | Encouraged — infer from changed files (see [scope map](resources/scope-map.md)) |
| **description** | Imperative mood, lowercase start, no trailing period, max 72 chars              |
| **full header** | `type(scope): description` ≤ 72 characters total                                |

### Body Rules (Optional)

- Separated from header by **one blank line**
- Wrap lines at **100 characters**
- Explain **why**, not what — the diff shows what changed
- Use bullet lists (`-`) for multiple points
- Reference rule files (e.g., "per rule `05-financial-engine-architecture.md`") when relevant

### Footer Rules (Optional)

- Separated from body by **one blank line**
- `BREAKING CHANGE: <description>` — **required** for any API/behavior change that breaks existing consumers
- `Refs: #<issue>` — link to GitHub issues
- `Closes: #<issue>` — auto-close issues on merge
- Multiple footers OK, one per line

## 1. Allowed Types

| Type         | Purpose                                                  | Example                                                    |
| ------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| **feat**     | New feature or capability                                | `feat(engine): add calculateCCPaymentAvailable function`   |
| **fix**      | Bug fix                                                  | `fix(rta): exclude ghost entries from latest month query`  |
| **docs**     | Documentation changes only                               | `docs(rules): add credit card RTA interaction rules`       |
| **style**    | Formatting, whitespace — no logic change                 | `style(budget): fix indentation in budget table component` |
| **refactor** | Code restructuring — no feature or fix                   | `refactor(api): extract DTO mappers from route handlers`   |
| **perf**     | Performance improvement                                  | `perf(db): add index on transactions(account_id, date)`    |
| **test**     | Adding or correcting tests                               | `test(e2e): add CC payment flow test`                      |
| **build**    | Build system, dependencies, bundler config               | `build: update next.config.ts for turbopack`               |
| **ci**       | CI/CD pipeline configuration                             | `ci: add Playwright E2E step to GitHub Actions`            |
| **chore**    | Maintenance tasks, tooling, configs that don't touch src | `chore: update .gitignore for .tmp directory`              |
| **revert**   | Revert a previous commit (reference the reverted hash)   | `revert: revert feat(auth) commit abc1234`                 |

## 2. Scope Inference — Decision Tree

Use the [resources/scope-map.md](resources/scope-map.md) for the full directory→scope mapping. Quick rules:

```
Changed only ynab-app/lib/engine/*?   → scope: engine
Changed only ynab-app/lib/repos/*?    → scope: repo
Changed only ynab-app/app/api/*?      → scope: api
Changed only ynab-app/hooks/*?        → scope: hooks
Changed only ynab-app/components/*?   → scope: ui
Changed only *.spec.ts / *.test.ts?   → scope: test or e2e
Changed only ynab-app/db/*?           → scope: db or schema
Changed only .agent/*?                → scope: skills or rules
Changed audit/reports/docs?           → scope: audit or docs
Changed dev tools/scripts?            → scope: dx or scripts
Changed many areas for one feature?   → scope: feature-name (e.g., cc-payment)
Changed everything / config only?     → omit scope
```

**Note:** Always use the relative path inside `ynab-app/` as the scope (e.g., `ynab-app/hooks/` → `hooks`).

**When in doubt**, use the feature name as scope (e.g., `rta`, `auth`, `transactions`).

## 3. Agent Workflow — Step by Step

When the user asks to commit, follow this sequence:

### Step 1: Analyze the Diff

```bash
git diff --cached --stat        # staged files summary
git diff --cached               # full staged diff
```

If nothing is staged, stage all changes first (ask user if unsure).

### Step 2: Determine Type

Ask yourself:

1. Does this add new functionality the user can interact with? → `feat`
2. Does this fix a bug or incorrect behavior? → `fix`
3. Does this only change docs/comments? → `docs`
4. Does this restructure without changing behavior? → `refactor`
5. Does this improve speed/efficiency? → `perf`
6. Is it only tests? → `test`
7. Is it build/CI config? → `build` or `ci`
8. Everything else (tooling, housekeeping) → `chore`

### Step 3: Determine Scope

Look at the file paths in the diff. Use [resources/scope-map.md](resources/scope-map.md) to map directories to scopes.

- **Single directory** → use that scope
- **Multiple directories, one feature** → use the feature name
- **Config/root files only** → omit scope

### Step 4: Write the Description

- Start with a **verb in imperative mood**: add, fix, remove, update, implement, extract, refactor
- **Lowercase** first letter (the type provides the sentence start)
- **No period** at the end
- Be specific: `add milliunit branded type` not `update types`
- Max 72 chars total for `type(scope): description`

### Step 5: Write Body (if needed)

Include a body when:

- The _why_ isn't obvious from the description
- Multiple things changed and need explanation
- A bug fix needs context on the root cause
- Breaking changes need migration notes

### Step 6: Write Footer (if needed)

Include footers for:

- `BREAKING CHANGE:` — any API/schema/behavior change (REQUIRED, never skip)
- `Refs: #123` — related issues
- `Closes: #456` — issues this commit resolves

### Step 7: Validate (Crucial: Use Absolute Path)

Run the validation script before committing. **Always use the absolute path** to ensure it works from any subdirectory (e.g., `ynab-app/`):

```bash
# Path: /Users/camilopiedra/Documents/YNAB/.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh
echo "<your commit message>" | bash /Users/camilopiedra/Documents/YNAB/.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh --stdin
```

### Step 8: Commit

```bash
git commit -m "<header>" -m "<body>" -m "<footer>"
# or for multi-line:
git commit -F- <<'EOF'
<full message>
EOF
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

## Resources

| File                                                             | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [scripts/validate-commit-msg.sh](scripts/validate-commit-msg.sh) | Commit message validator script              |
| [examples/good-commits.md](examples/good-commits.md)             | Good commit message examples (YNAB-specific) |
| [examples/bad-commits.md](examples/bad-commits.md)               | Anti-pattern examples with explanations      |
| [resources/scope-map.md](resources/scope-map.md)                 | Directory → scope mapping table              |
