# Git Branching Strategy — Staging-Based Gitflow

## 1. The Rule

**`main` is production. `staging` is the integration branch.** All feature work happens on dedicated branches created from `staging`. Direct commits to `main` are **never** acceptable. Direct commits to `staging` are only acceptable for trivial docs/chore changes.

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
main    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━►  (production)
                                          ▲
staging ──────────────────────────────────►│           (integration)
         \\                        /       │
          feat/my-feature ───────► (PR → staging → PR → main)
```

1. **Create branch** from latest `staging` (`/git-branch` workflow)
2. **Develop** — commit freely on the feature branch (CI runs on every push)
3. **PR to staging** — open PR, CI must pass (`quality-gate` + `unit-tests`)
4. **Merge to staging** — full CI runs including E2E tests
5. **PR to main** — promote staging to production, all checks must pass
6. **Delete** — remove the feature branch after merge

## 4. Commit Rules on Feature Branches

- Use `npm run git:sync` — Conventional Commits enforced
- Multiple commits are fine; they'll be squashed on merge
- `sync.sh` blocks direct pushes to `main` and warns on `staging`

## 5. CI Pipeline per Stage

| Stage                | Trigger | Checks                          | Duration |
| -------------------- | ------- | ------------------------------- | -------- |
| Feature branch       | Push    | quality-gate + unit-tests       | ~3 min   |
| PR → staging         | PR      | quality-gate + unit-tests       | ~3 min   |
| Staging (post-merge) | Push    | quality-gate + unit-tests + E2E | ~10 min  |
| PR → main            | PR      | quality-gate + unit-tests + E2E | ~10 min  |
| Main (post-merge)    | Push    | Deploy only                     | ~2 min   |

## 6. When to Skip (Direct-to-Staging)

- Single-file documentation updates
- `.gitignore` or config tweaks
- Trivial changes (< 5 lines)
- Agent rule/workflow updates
