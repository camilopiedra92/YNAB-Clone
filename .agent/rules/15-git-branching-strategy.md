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

## 5. CI Pipeline — Two-Workflow Architecture

CI is split into **two independent workflow files** to eliminate push/PR concurrency conflicts:

### `ci.yml` — Gatekeeper (pull_request only)

| Stage        | Checks                                      | Duration |
| ------------ | ------------------------------------------- | -------- |
| PR → staging | quality-gate + unit-tests + ci-passed       | ~3 min   |
| PR → main    | quality-gate + unit-tests + E2E + ci-passed | ~10 min  |

- **Trigger:** `pull_request` to staging or main
- **Concurrency:** `pr-{branch}` (PR updates cancel prior PR run)
- **Produces `ci-passed`** — the ONLY required check in GitHub rulesets
- Feature branches get CI **only through PRs** (no push CI)

### `ci-post-merge.yml` — Post-Merge Validation (push only)

| Stage                | Checks                          | Duration |
| -------------------- | ------------------------------- | -------- |
| Staging (post-merge) | quality-gate + unit-tests + E2E | ~10 min  |

- **Trigger:** `push` to staging only
- **Concurrency:** `post-merge-staging` (new push cancels prior run)
- **Does NOT produce `ci-passed`** — rulesets never depend on this workflow
- Validates the merged result (catches merge conflicts, env issues)

### Why Two Workflows?

When push and PR share a single workflow, concurrency cancellation marks ALL jobs as "cancelled" — including `ci-passed`. A cancelled `ci-passed (push)` blocks PR merges even though `ci-passed (pull_request)` passed. Separate workflow files have **completely independent** concurrency groups — zero interference.

### `ci-passed` Summary Gate

Lives in `ci.yml` only. Depends on quality-gate, unit-tests, and e2e-tests. Provides a single stable required check for rulesets.

- `quality-gate` and `unit-tests` MUST succeed (`!= "success"` → fail)
- `e2e-tests` may be skipped (PRs to staging) but must not fail or cancel
- **Rulesets must require ONLY:** `ci-passed`

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

### ⚠️ Merge Safety (CRITICAL — Staging Protection)

**`staging` must NEVER be deleted.** Three layers protect it:

1. **GitHub setting:** `delete_branch_on_merge = false` (prevents auto-deletion after PR merge)
2. **GitHub Ruleset:** "Staging — Integration" has "Restrict deletions" rule
3. **Agent enforcement:** All merge commands below explicitly prohibit `--delete-branch` for staging

```bash
# Feature → staging: --delete-branch is OK (cleans up the feature branch)
gh pr merge --merge --delete-branch

# Staging → main: ⚠️ NEVER use --delete-branch (would delete staging!)
gh pr merge --merge
```

If staging is accidentally deleted, restore it immediately:

```bash
git checkout main && git checkout -b staging && git push -u origin staging
```

## 8. When to Skip (Direct-to-Staging)

- Single-file documentation updates
- `.gitignore` or config tweaks
- Trivial changes (< 5 lines)
- Agent rule/workflow updates
