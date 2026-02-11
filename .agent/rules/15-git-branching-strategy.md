# Git Branching Strategy — GitHub Flow (Solo Developer)

## 1. The Rule

**`main` is always stable.** All feature work, bug fixes, and refactors happen on dedicated branches. Direct commits to `main` are only acceptable for trivial docs/chore changes.

## 2. Branch Naming Convention

Branch prefix MUST match Conventional Commits type:

| Prefix      | Use Case                        |
| ----------- | ------------------------------- |
| `feat/`     | New features                    |
| `fix/`      | Bug fixes                       |
| `refactor/` | Code restructuring              |
| `docs/`     | Documentation changes           |
| `chore/`    | Maintenance, dependency updates |
| `test/`     | Test additions or fixes         |

**Format:** `type/short-kebab-description` (e.g., `feat/recurring-transactions`, `fix/rta-ghost-entry`)

## 3. Workflow

```
main ──────────────────────────────────────►
       \                          /
        feat/my-feature ─────────► (squash merge → delete branch)
```

1. **Create branch** from latest `main` (`/git-branch` workflow)
2. **Develop** — commit freely on the feature branch
3. **Merge** — squash merge back to `main` when complete and tests pass
4. **Delete** — remove the branch after merge

## 4. Commit Rules on Feature Branches

- Use `npm run git:sync` (same as on `main`) — Conventional Commits enforced
- Multiple commits are fine; they'll be squashed on merge
- `sync.sh` shows a warning when committing to `main` as a reminder

## 5. When to Skip (Direct-to-Main)

- Single-file doc updates
- `.gitignore` or config tweaks
- Trivial chore changes (< 5 lines)
