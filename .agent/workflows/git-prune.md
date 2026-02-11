---
description: Clean up merged and orphan feature branches (local + remote)
---

# Prune Merged Branches

// turbo-all

1. Preview what would be deleted (dry run):

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && npm run git:prune -- --dry-run
```

2. If the output looks correct, run the actual cleanup:

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && npm run git:prune
```

## What It Does

1. **Prunes stale remote refs** — removes local tracking refs for branches already deleted on GitHub
2. **Deletes merged local branches** — removes branches already merged into `staging`
3. **Deletes gone-remote branches** — removes local branches whose remote was deleted (e.g., after PR merge with `--delete-branch`)

**Protected branches** (`main`, `staging`) are **NEVER** deleted.
