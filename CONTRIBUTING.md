# Contributing — Git Branching Strategy

## Overview

This project uses **GitHub Flow** — a simple branching model optimized for solo development with clean history.

```
main ──────────────────────────────────────────────────────►
       \                                    /
        feat/recurring-transactions ───────► (squash merge)
```

**One rule:** `main` is always stable. All work happens on feature branches.

---

## Quick Reference

| Step             | Command                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Start a feature  | `git checkout main && git pull && git checkout -b feat/my-feature` |
| Commit work      | `npm run git:sync -- "feat(scope): description"`                   |
| Finish & merge   | `git checkout main && git merge --squash feat/my-feature`          |
| Commit the merge | `npm run git:sync -- "feat(scope): summary of feature"`            |
| Clean up         | `git branch -d feat/my-feature`                                    |

---

## Branch Naming

Branch prefixes match [Conventional Commits](https://www.conventionalcommits.org/) types:

| Prefix      | When to use                             | Example                        |
| ----------- | --------------------------------------- | ------------------------------ |
| `feat/`     | New functionality                       | `feat/recurring-transactions`  |
| `fix/`      | Bug fixes                               | `fix/rta-ghost-entry`          |
| `refactor/` | Code restructuring (no behavior change) | `refactor/extract-budget-repo` |
| `docs/`     | Documentation only                      | `docs/add-api-reference`       |
| `chore/`    | Maintenance, deps, config               | `chore/update-dependencies`    |
| `test/`     | Test additions or fixes                 | `test/add-cc-payment-coverage` |

**Format:** `type/short-kebab-case-description`

- ✅ `feat/add-recurring-transactions`
- ✅ `fix/rta-negative-balance`
- ❌ `feature/multi-tenancy` (wrong prefix)
- ❌ `my-cool-feature` (no prefix)
- ❌ `feat/Add_Recurring` (not kebab-case)

---

## The Full Workflow

### 1. Create a Feature Branch

Always start from an up-to-date `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature
```

Or use the agent workflow: `/git-branch`

### 2. Develop & Commit

Work normally on the feature branch. Commit as often as you want — these intermediate commits will be squashed later.

```bash
# Make changes, then:
npm run git:sync -- "feat(scope): add transaction form"

# Keep working...
npm run git:sync -- "fix(scope): handle empty state"

# Multiple commits are fine on feature branches!
```

### 3. Verify Before Merging

**CI runs automatically** on every push and PR to `main` via GitHub Actions. The pipeline runs the full QA suite (audit → lint → typecheck → build → unit tests → E2E tests). Branch protection requires all checks to pass before merge.

To verify locally before pushing (optional — CI will catch issues too):

```bash
npm test                # Unit tests
npm run test:e2e        # E2E tests
npm run typecheck       # Type check
```

### 4. Squash Merge to Main

Squash merging collapses all branch commits into a single clean commit on `main`:

```bash
git checkout main
git pull origin main
git merge --squash feat/my-feature
npm run git:sync -- "feat(scope): add recurring transactions"
```

**Why squash?** The branch had 15 commits like "wip", "fix typo", "actually fix it". Main gets one clean commit that describes the whole feature.

### 5. Clean Up

Delete the branch locally (and remotely if pushed):

```bash
git branch -d feat/my-feature
git push origin --delete feat/my-feature  # if it was pushed
```

---

## When It's OK to Skip (Direct to Main)

For trivial changes, you can commit directly to `main`. The `sync.sh` script will show a warning as a reminder, but won't block you.

Acceptable direct-to-main commits:

- Single-file documentation updates
- `.gitignore` or config tweaks
- Trivial changes (< 5 lines)
- Agent rule/workflow updates

**Rule of thumb:** If it touches application code, use a branch.

---

## Commit Message Format

All commits use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

- **Max 72 characters** for the header line
- See `.agent/skills/git-commit-formatter/resources/scope-map.md` for scope mapping
- Always commit via `npm run git:sync` — it validates the format automatically

### Examples

```bash
# Feature
npm run git:sync -- "feat(budget): add monthly rollover support"

# Bug fix
npm run git:sync -- "fix(rta): correct ghost entry calculation"

# Refactor
npm run git:sync -- "refactor(repo): extract account queries"

# With body for extra context
npm run git:sync -- "feat(cc-payment): add funded spending calc" \
  "- Implements calculateFundedAmount in engine
- Adds CC payment deduction query
- Updates budget repo orchestration"
```

---

## FAQ

**Q: What if I started working on `main` by accident?**

Stash your changes, create a branch, and apply them:

```bash
git stash
git checkout -b feat/my-feature
git stash pop
```

**Q: What if my feature branch has conflicts with `main`?**

Rebase your branch on top of the latest `main`:

```bash
git checkout feat/my-feature
git rebase main
# Resolve any conflicts, then continue
git rebase --continue
```

**Q: Should I push feature branches to remote?**

Optional. Pushing gives you a backup, but for short-lived branches it's not necessary. If a branch lives for more than a day, push it.

**Q: Can I have multiple feature branches at once?**

Yes, but try to keep it to 1-2 active branches to avoid merge complexity.
