# Contributing — Git Branching Strategy

## Overview

This project uses a **Staging-Based Gitflow** — a branching model with `staging` as the integration branch and `main` as production-only.

```
main    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━►  (production)
                                          ▲
staging ──────────────────────────────────►│           (integration)
         \                        /       │
          feat/my-feature ───────► (PR → staging → PR → main)
```

**Two rules:**

1. `main` is always production-ready and the **GitHub default branch**. Only receives merges from `staging`.
2. `staging` is the integration branch. All feature work merges here first.

> **⚠️ Important:** Since `main` is the GitHub default branch, the web UI will default PRs to target `main`. Always select `staging` as the base branch when creating PRs for feature work.

---

## Quick Reference

| Step               | Command                                                               |
| ------------------ | --------------------------------------------------------------------- |
| Start a feature    | `git checkout staging && git pull && git checkout -b feat/my-feature` |
| Commit work        | `npm run git:sync -- "feat(scope): description"`                      |
| Open PR to staging | `gh pr create --base staging --title "feat: description"`             |
| Check PR status    | `gh pr checks`                                                        |
| After merge        | `git checkout staging && git pull && git branch -d feat/my-feature`   |
| Promote to prod    | `gh pr create --base main --head staging --title "chore: promote"`    |
| Merge PR           | `gh pr merge --merge`                                                 |

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

Always start from an up-to-date `staging`:

```bash
git checkout staging
git pull origin staging
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

**CI runs automatically when you open a PR** for your feature branch — quality-gate + unit-tests (~3 min).

### 3. Open a Pull Request to Staging

Push your branch and create a PR using `gh` CLI or GitHub web:

```bash
git push -u origin feat/my-feature

# Create PR with gh CLI (recommended):
gh pr create --base staging --title "feat: description"

# Or open PR on GitHub web: feat/my-feature → staging
```

The `ci-passed` required check must pass before merge.

### 4. Merge to Staging

After CI passes, merge the PR (squash merge recommended).

```bash
# Merge from CLI:
gh pr merge --merge --delete-branch

# Or merge from GitHub web
```

### 5. Promote to Production

When staging is stable and ready for production:

```bash
# Create PR: staging → main
gh pr create --base main --head staging --title "chore: promote to production"

# Wait for all checks to pass, then merge:
gh pr merge --merge
```

> **⚠️ CRITICAL: NEVER use `--delete-branch` when merging staging → main.** This would delete the `staging` branch.

### 6. Clean Up

Delete the feature branch locally (and remotely if pushed):

```bash
git branch -d feat/my-feature
git push origin --delete feat/my-feature  # if it was pushed
```

---

## CI Pipeline

CI runs **only on `pull_request` events** — no push CI. All code goes through PRs (rulesets enforce it), so push CI is redundant.

| Stage        | Checks                                      | Duration |
| ------------ | ------------------------------------------- | -------- |
| PR → staging | quality-gate → unit-tests + ci-passed       | ~3 min   |
| PR → main    | quality-gate → unit-tests + E2E + ci-passed | ~10 min  |

### CI Architecture

- **`ci-passed` gate:** A summary job that depends on all CI jobs. This is the **only** required check in rulesets. It provides one stable check name regardless of GitHub's internal naming.
- **Concurrency:** `pr-{branch}` — PR updates for the same branch cancel prior CI runs. No wasted minutes.
- **E2E conditional:** E2E tests only run on PRs to `main` (staging → main promotion). PRs to `staging` skip E2E.
- **Job chain:** `unit-tests` depends on `quality-gate` — if lint/typecheck/build fails, unit tests don't run.

---

## When It's OK to Skip (Direct to Staging)

For trivial changes, you can commit directly to `staging`. As a bypass actor on the GATE ruleset, this is allowed without PR.

Acceptable direct-to-staging commits:

- Single-file documentation updates
- `.gitignore` or config tweaks
- Trivial changes (< 5 lines)
- Agent rule/workflow updates

**Rule of thumb:** If it touches application code, use a feature branch.

> **⚠️ Direct pushes to `main` are always blocked.** All code reaches `main` via PR from `staging`.

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

**Q: What if I started working on `staging` by accident?**

Stash your changes, create a branch, and apply them:

```bash
git stash
git checkout -b feat/my-feature
git stash pop
```

**Q: What if my feature branch has conflicts with `staging`?**

Rebase your branch on top of the latest `staging`:

```bash
git checkout feat/my-feature
git rebase staging
# Resolve any conflicts, then continue
git rebase --continue
```

**Q: Should I push feature branches to remote?**

Yes — pushing to a branch with an open PR triggers CI, giving you feedback. Plus it creates a backup.

**Q: Can I have multiple feature branches at once?**

Yes, but try to keep it to 1-2 active branches to avoid merge complexity.

**Q: How do I promote staging to production?**

```bash
gh pr create --base main --head staging --title "chore: promote to production"
# Wait for CI, then:
gh pr merge --merge   # ⚠️ NO --delete-branch!
```
