# Git Branching Strategy — Staging-Based Gitflow

## 1. The Rule

**`main` is production and the GitHub default branch. `staging` is the integration branch.** All feature work happens on dedicated branches created from `staging`. Direct commits to `main` are **never** acceptable. Direct commits to `staging` are only acceptable for trivial docs/chore changes.

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
3. **PR to staging** — open PR, CI must pass (`ci-passed` gate)
4. **Merge to staging** — full CI runs including E2E tests
5. **PR to main** — promote staging to production, all checks must pass
6. **Delete** — remove the feature branch after merge

## 4. Commit Rules on Feature Branches

- Use `npm run git:sync` — Conventional Commits enforced
- Multiple commits are fine; they'll be squashed on merge
- `sync.sh` blocks direct pushes to `main` (error + exit)
- Direct pushes to `staging` are allowed (bypass actor) for trivial changes

## 5. CI Pipeline per Stage

| Stage                | Trigger | Checks                          | Duration |
| -------------------- | ------- | ------------------------------- | -------- |
| Feature branch       | Push    | quality-gate + unit-tests       | ~3 min   |
| PR → staging         | PR      | quality-gate + unit-tests       | ~3 min   |
| Staging (post-merge) | Push    | quality-gate + unit-tests + E2E | ~10 min  |
| PR → main            | PR      | quality-gate + unit-tests + E2E | ~10 min  |
| Main (post-merge)    | Push    | Deploy only                     | ~2 min   |

### Concurrency Deduplication

The CI workflow uses `concurrency.group: ci-${{ github.head_ref || github.ref_name }}` with `cancel-in-progress: true`. If a push CI is running and a PR is created for the same branch, the push run is **auto-cancelled** — no duplicate CI runs.

- `github.head_ref` = branch name for `pull_request` events
- `github.ref_name` = branch name for `push` events
- Both resolve to the same value → shared concurrency group → dedup

### `ci-passed` Summary Gate

A `ci-passed` job depends on all 3 CI jobs and provides a **single stable check name** for rulesets. GitHub appends `(push)`/`(pull_request)` to individual job names, which breaks ruleset matching. The `ci-passed` gate solves this.

- `quality-gate` and `unit-tests` MUST succeed (`!= "success"` → fail)
- `e2e-tests` may be skipped (conditional job) but must not fail or cancel
- **Rulesets must require ONLY:** `ci-passed` (the job ID, not `CI / ci-passed`)

## 6. GitHub Rulesets Configuration

Three rulesets protect the repository:

### Main — Production

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Target branches | `main`                                                                  |
| Rules           | Restrict deletions, Require PR, Require `ci-passed`, Block force pushes |
| Bypass actors   | None                                                                    |

### Staging — Integration

| Field           | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Target branches | `staging`                                                   |
| Rules           | Restrict deletions, Require `ci-passed`, Block force pushes |
| Bypass actors   | Owner (for direct-to-staging trivial changes)               |

### Feature Branches

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Target branches | `feat/**`, `fix/**`, `refactor/**`, `docs/**`, `chore/**`, `test/**` |
| Rules           | Restrict deletions, Block force pushes                               |
| Required checks | **NONE** (checks run but don't block push; they gate the PR instead) |

### ⚠️ Critical Ruleset Rules

1. **Required check name:** Use `ci-passed` (the job ID). Do NOT use `CI / ci-passed` or any name with `(push)`/`(pull_request)` suffix.
2. **Select from autocomplete:** When adding checks in the ruleset UI, type `ci-` and select from the dropdown. This links the correct integration source.
3. **Never add checks to feature branch rulesets:** Pushes would be rejected because the checks haven't run yet (chicken-and-egg).

## 7. GitHub CLI (`gh`)

`gh` is installed and authenticated for `camilopiedra92`. Use it for PR operations:

```bash
# Create PR
gh pr create --base staging --head feat/my-feature --title "feat: description"

# Promote staging to production
gh pr create --base main --head staging --title "chore: promote to production"

# Check PR status
gh pr checks <PR_NUMBER>

# Merge PR (⚠️ NEVER use --delete-branch for staging → main)
gh pr merge --merge
```

### ⚠️ Merge Safety

- **Feature → staging:** `gh pr merge --merge --delete-branch` ← OK (deletes feature branch)
- **Staging → main:** `gh pr merge --merge` ← **NO --delete-branch** (would delete staging!)

## 8. When to Skip (Direct-to-Staging)

- Single-file documentation updates
- `.gitignore` or config tweaks
- Trivial changes (< 5 lines)
- Agent rule/workflow updates
