# Git Branching Strategy — Staging-Based Gitflow

## 1. The Rule

**`main` is production and the GitHub default branch. `staging` is the integration branch.** All feature work happens on dedicated branches created from `staging`. Direct commits to `main` are **STRICTLY FORBIDDEN** and blocked by a local pre-push hook. Direct commits to `staging` are only acceptable for trivial docs/chore changes.

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
2. **Develop** — commit freely on the feature branch
3. **PR to staging** — open PR, CI runs automatically (`ci-passed` gate must pass)
4. **Merge to staging** — merge the PR after `ci-passed` succeeds
5. **PR to main** — promote staging to production (E2E runs here)
6. **Delete** — remove the feature branch after merge

## 4. Commit Rules on Feature Branches

- Use `npm run git:sync` — Conventional Commits enforced
- Multiple commits are fine; they'll be squashed on merge
- `sync.sh` blocks direct pushes to `main` (error + exit)
- Direct pushes to `staging` are allowed (bypass actor) for trivial changes
- **Git hooks run automatically** — see §5 below

## 5. Local Quality Gates (Git Hooks)

Hooks live in `scripts/hooks/` and are installed to `.git/hooks/` via `npm run git:install-hooks` (also runs automatically on `npm install` via `prepare`).

| Hook         | Trigger            | What it runs                                   | ~Time  |
| ------------ | ------------------ | ---------------------------------------------- | ------ |
| `pre-commit` | Every `git commit` | ESLint (staged files) + TypeScript typecheck   | ~5–8s  |
| `pre-push`   | Every `git push`   | Branch protection (blocks `main`) + Unit tests | ~5–10s |

- **Bypass:** `--no-verify` flag or `SKIP_HOOKS=1` env var
- **CI skip:** Hooks auto-skip when `CI=true` (GitHub Actions sets this)
- These are **Layer 0** — fast local feedback before CI even runs

## 6. CI Pipeline — PR-Only (`ci.yml`)

CI runs **only on `pull_request` events** — no push CI. This is the industry standard: all code goes through PRs (rulesets enforce it), so push CI is redundant.

| Stage        | Checks                                      | Duration |
| ------------ | ------------------------------------------- | -------- |
| PR → staging | quality-gate + unit-tests + ci-passed       | ~3 min   |
| PR → main    | quality-gate + unit-tests + E2E + ci-passed | ~10 min  |

- **Trigger:** `pull_request` to staging or main
- **Concurrency:** `pr-{branch}` — PR updates cancel prior PR run
- **No push CI** — feature branches get CI only through PRs; direct pushes to staging (trivial changes) rely on local validation (`npm test`)

### 6a. `ci-passed` Summary Gate

Depends on quality-gate, unit-tests, and e2e-tests. Provides a single stable required check for rulesets.

- `quality-gate` and `unit-tests` MUST succeed
- `e2e-tests` may be skipped (PRs to staging) but must not fail or cancel
- **Rulesets must require ONLY:** `ci-passed`

## 7. GitHub Rulesets Configuration

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

## 8. GitHub CLI (`gh`)

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

### Merge Strategy Convention

| PR Type            | Merge Method               | Why                                                    |
| ------------------ | -------------------------- | ------------------------------------------------------ |
| `feat/* → staging` | `--squash --delete-branch` | Compresses dev commits. Branch gets deleted.           |
| `staging → main`   | `--merge` (merge commit)   | Preserves history linkage. Both branches stay in sync. |

### ⚠️ Merge Safety (CRITICAL — Staging Protection)

**`staging` must NEVER be deleted.** Three layers protect it:

1. **GitHub setting:** `delete_branch_on_merge = false` (prevents auto-deletion after PR merge)
2. **GitHub Ruleset:** "Staging — Integration" has "Restrict deletions" rule
3. **Agent enforcement:** All merge commands below explicitly prohibit `--delete-branch` for staging

```bash
# Feature → staging: squash + delete branch (clean history)
gh pr merge --squash --delete-branch

# Staging → main: merge commit (⚠️ NEVER use --squash or --delete-branch)
gh pr merge --merge
```

If staging is accidentally deleted, restore it immediately:

```bash
git checkout main && git checkout -b staging && git push -u origin staging
```

## 9. When to Skip (Direct-to-Staging)

- Single-file documentation updates
- `.gitignore` or config tweaks
- Trivial changes (< 5 lines)
- Agent rule/workflow updates
