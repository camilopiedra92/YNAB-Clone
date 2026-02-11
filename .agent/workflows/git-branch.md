---
description: Create a feature branch from staging before starting implementation work
---

# Create a Feature Branch

// turbo-all

1. Ensure the worktree is clean and you're on `staging`:

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && git stash --include-untracked 2>/dev/null; git checkout staging && git pull origin staging
```

2. Create and switch to the new branch. Replace `TYPE` and `NAME` with the appropriate values (see `15-git-branching-strategy.md` for naming rules):

```bash
git checkout -b TYPE/NAME
```

**Branch name examples:**

- `feat/recurring-transactions`
- `fix/rta-ghost-entry`
- `refactor/extract-budget-repo`
- `docs/add-contributing-guide`

3. Confirm the branch is active:

```bash
git branch --show-current
```

4. If there were stashed changes in step 1, restore them:

```bash
git stash pop 2>/dev/null || true
```

## After Work Is Complete

When the feature is done and tests pass, push and create a PR to `staging`.

> **Note:** Git hooks run automatically — `pre-commit` (lint + typecheck, ~5s) on commit and `pre-push` (unit tests, ~5–10s) on push. Bypass with `--no-verify` in emergencies.

```bash
# Push the branch
git push -u origin TYPE/NAME

# Create PR with gh CLI (recommended):
gh pr create --base staging --title "type: description"

# Monitor checks:
gh pr checks
```

After the PR is merged, clean up the branch:

```bash
git checkout staging && git pull origin staging
git branch -d TYPE/NAME && git push origin --delete TYPE/NAME 2>/dev/null || true
```

## Promote to Production

When staging is ready for production:

```bash
# Create PR: staging → main
gh pr create --base main --head staging --title "chore: promote to production"

# Monitor checks:
gh pr checks

# Merge commit (⚠️ NEVER use --squash or --delete-branch here!)
gh pr merge --merge
```

> **Merge strategy:** Always use `--merge` (merge commit) for staging → main. Using `--squash` causes staging to permanently show as "ahead" of main.

The `ci-passed` required check gates all PRs. It depends on `quality-gate`, `unit-tests`, and `e2e-tests` (E2E only runs on PRs to main).
