#!/usr/bin/env bash
# scripts/prune-branches.sh
# Branch Hygiene: Remove merged/orphan branches safely
# Protected branches (main, staging) are NEVER deleted.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PROTECTED="main|staging"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN — no branches will be deleted"
    echo ""
fi

# ── 1. Prune stale remote tracking refs ──
echo "🌐 Pruning stale remote tracking refs..."
git fetch --prune --quiet

# ── 2. Find local branches merged into staging ──
echo ""
echo "🧹 Local branches merged into staging:"
MERGED=$(git branch --merged staging 2>/dev/null | grep -v -E "^\*|$PROTECTED" || true)

if [ -z "$MERGED" ]; then
    echo "   (none)"
else
    while IFS= read -r branch; do
        branch=$(echo "$branch" | xargs)  # trim whitespace
        [ -z "$branch" ] && continue
        if $DRY_RUN; then
            echo "   would delete: $branch"
        else
            git branch -d "$branch" 2>/dev/null && echo "   ✓ deleted: $branch" || echo "   ✗ skipped: $branch"
        fi
    done <<< "$MERGED"
fi

# ── 3. Find remote branches with no local counterpart (gone) ──
echo ""
echo "🌐 Remote branches already deleted upstream:"
GONE=$(git branch -vv 2>/dev/null | grep ': gone]' | grep -v -E "$PROTECTED" | awk '{print $1}' || true)

if [ -z "$GONE" ]; then
    echo "   (none)"
else
    while IFS= read -r branch; do
        [ -z "$branch" ] && continue
        if $DRY_RUN; then
            echo "   would delete: $branch (remote gone)"
        else
            git branch -D "$branch" 2>/dev/null && echo "   ✓ deleted: $branch (remote gone)" || echo "   ✗ skipped: $branch"
        fi
    done <<< "$GONE"
fi

# ── 4. Summary ──
REMAINING=$(git branch | grep -v -E "^\*|$PROTECTED" | wc -l | xargs)
echo ""
echo "📊 Branch status:"
echo "   Active branch: $(git branch --show-current)"
echo "   Remaining feature branches: $REMAINING"
echo "   Protected: main, staging"
echo ""
echo "✅ Branch hygiene complete"
