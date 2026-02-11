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

When the feature is done and tests pass, push and open a PR to `staging`:

```bash
git push -u origin TYPE/NAME
# Open PR on GitHub: TYPE/NAME → staging
```

After the PR is merged, clean up the branch:

```bash
git checkout staging && git pull origin staging
git branch -d TYPE/NAME && git push origin --delete TYPE/NAME 2>/dev/null || true
```

## Promote to Production

When staging is ready for production, open a PR on GitHub: `staging → main`. All CI checks (quality-gate + unit-tests + E2E) must pass before merge.
