---
description: Check for unpromoted commits, open PRs, stale branches, and overall pipeline health
---

# Git Status: Pipeline Health Dashboard

Full diagnostic of the Git pipeline — shows unpromoted commits, PR status, branch hygiene, and hook health. Use this to answer: **"Is anything stuck in the pipeline?"**

// turbo-all

## 1. Branch Sync Status

Check which branches are ahead/behind each other.

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && git fetch origin --prune --quiet && echo "" && \
echo "═══════════════════════════════════════════════════" && \
echo "  📊 BRANCH SYNC STATUS" && \
echo "═══════════════════════════════════════════════════" && \
echo "" && \
STAGING_AHEAD=$(git rev-list --count origin/main..origin/staging 2>/dev/null || echo "0") && \
STAGING_BEHIND=$(git rev-list --count origin/staging..origin/main 2>/dev/null || echo "0") && \
if [ "$STAGING_AHEAD" = "0" ] && [ "$STAGING_BEHIND" = "0" ]; then \
  echo "  ✅ staging ↔ main: IN SYNC"; \
elif [ "$STAGING_AHEAD" != "0" ]; then \
  echo "  ⚠️  staging → main: $STAGING_AHEAD commits to promote"; \
fi && \
if [ "$STAGING_BEHIND" != "0" ]; then \
  echo "  ⚠️  staging ← main: $STAGING_BEHIND commits behind (needs pull)"; \
fi && \
echo ""
```

## 2. Unpromoted Commits (staging → main)

Show the actual commits in staging that haven't been promoted to production.

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && \
echo "═══════════════════════════════════════════════════" && \
echo "  📦 UNPROMOTED COMMITS (staging → main)" && \
echo "═══════════════════════════════════════════════════" && \
echo "" && \
COMMITS=$(git log origin/main..origin/staging --oneline 2>/dev/null) && \
if [ -z "$COMMITS" ]; then \
  echo "  ✅ Nothing to promote — staging and main are in sync."; \
else \
  echo "$COMMITS" | while read -r line; do echo "  • $line"; done && \
  echo "" && \
  echo "  💡 To promote: gh pr create --base main --head staging --title \"chore: promote to production\""; \
fi && \
echo ""
```

## 3. Open Pull Requests

Check for any PRs awaiting review or CI.

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && \
echo "═══════════════════════════════════════════════════" && \
echo "  🔀 OPEN PULL REQUESTS" && \
echo "═══════════════════════════════════════════════════" && \
echo "" && \
PRS=$(gh pr list --state open --json number,title,baseRefName,headRefName,statusCheckRollup --template '{{range .}}  #{{.number}} {{.headRefName}} → {{.baseRefName}} | {{.title}}{{"\n"}}{{end}}' 2>/dev/null) && \
if [ -z "$PRS" ]; then \
  echo "  ✅ No open PRs."; \
else \
  echo "$PRS"; \
  echo "" && \
  echo "  💡 Check CI status: gh pr checks <PR_NUMBER>"; \
fi && \
echo ""
```

## 4. Active Feature Branches

List branches that haven't been merged yet.

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && \
echo "═══════════════════════════════════════════════════" && \
echo "  🌿 ACTIVE FEATURE BRANCHES" && \
echo "═══════════════════════════════════════════════════" && \
echo "" && \
BRANCHES=$(git branch -r --no-merged origin/staging 2>/dev/null | grep -v 'HEAD\|main\|staging' | sed 's/origin\//  • /') && \
if [ -z "$BRANCHES" ]; then \
  echo "  ✅ No unmerged feature branches."; \
else \
  echo "$BRANCHES"; \
fi && \
LOCAL=$(git branch --no-merged staging 2>/dev/null | grep -v 'main\|staging' | sed 's/^/  • /') && \
if [ -n "$LOCAL" ]; then \
  echo "" && \
  echo "  📍 Local only (not pushed):" && \
  echo "$LOCAL"; \
fi && \
echo ""
```

## 5. Git Hook Health

Verify that pre-commit and pre-push hooks are installed and executable.

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && \
echo "═══════════════════════════════════════════════════" && \
echo "  🪝 GIT HOOK HEALTH" && \
echo "═══════════════════════════════════════════════════" && \
echo "" && \
for hook in pre-commit pre-push; do \
  if [ -x ".git/hooks/$hook" ]; then \
    echo "  ✅ $hook: installed and executable"; \
  elif [ -f ".git/hooks/$hook" ]; then \
    echo "  ⚠️  $hook: installed but NOT executable (run: chmod +x .git/hooks/$hook)"; \
  else \
    echo "  ❌ $hook: NOT installed (run: npm run git:install-hooks)"; \
  fi; \
done && \
echo ""
```

## 6. Current Branch & Working Tree

Show where you are right now.

```bash
cd /Users/camilopiedra/Documents/YNAB/ynab-app && \
echo "═══════════════════════════════════════════════════" && \
echo "  📍 CURRENT STATE" && \
echo "═══════════════════════════════════════════════════" && \
echo "" && \
echo "  Branch: $(git branch --show-current)" && \
DIRTY=$(git status --porcelain) && \
if [ -z "$DIRTY" ]; then \
  echo "  Tree:   ✅ Clean"; \
else \
  COUNT=$(echo "$DIRTY" | wc -l | tr -d ' ') && \
  echo "  Tree:   ⚠️  $COUNT uncommitted change(s)"; \
fi && \
echo ""
```

---

## Reading the Output

| Symbol | Meaning                                 |
| ------ | --------------------------------------- |
| ✅     | All good — no action needed             |
| ⚠️     | Attention needed — something is pending |
| ❌     | Broken — fix immediately                |
| 💡     | Suggested next action                   |

### Common Scenarios

- **"staging is X commits ahead"** → Create a promotion PR: `gh pr create --base main --head staging`
- **"No open PRs" but staging is ahead** → You forgot to create the promotion PR
- **Hook not installed** → Run `npm run git:install-hooks`
- **Unmerged feature branches** → Either open a PR or delete if abandoned
