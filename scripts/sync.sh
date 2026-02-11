#!/usr/bin/env bash
# scripts/sync.sh
# Atomic Git Sync: Stage → Validate → Commit → Push
# Enforces branching strategy: blocks main, warns staging

set -euo pipefail

# Config
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VALIDATOR="$REPO_ROOT/.agent/skills/git-commit-formatter/scripts/validate-commit-msg.sh"

cd "$REPO_ROOT"

# Check for .git because of multi-folder workspaces
if [ ! -d .git ]; then
    echo "❌ ERROR: Not in a git repository."
    echo "Current directory: $(pwd)"
    echo "💡 ACTION: Change Cwd to /Users/camilopiedra/Documents/YNAB/ynab-app"
    exit 1
fi

echo "🔍 Checking for pending changes..."
if [ -z "$(git status --porcelain)" ]; then
    echo "📊 STATUS: SYNCED (No changes to commit)"
    echo "✅ Success: Repository is already up to date with origin."
    exit 0
fi

# Branching strategy enforcement
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "🚫 ERROR: Direct pushes to main are NOT allowed."
    echo "   main only receives code via PR from staging."
    echo ""
    echo "   To fix:"
    echo "   1. git stash"
    echo "   2. git checkout staging && git pull"
    echo "   3. git checkout -b feat/your-feature"
    echo "   4. git stash pop"
    exit 1
fi

# Argument Check
HEADER="${1:-}"
if [ -z "$HEADER" ]; then
    echo "❌ ERROR: No commit message provided."
    echo "Usage: npm run sync \"type(scope): message\""
    exit 1
fi

# Validate message
if [ -f "$VALIDATOR" ]; then
    if ! bash "$VALIDATOR" "$HEADER" > /dev/null 2>&1; then
        echo "❌ ERROR: Invalid commit message format: '$HEADER'"
        echo "   Rule: type(scope): lowercase description (no period)"
        echo "   Types: feat, fix, docs, refactor, chore, test"
        exit 1
    fi
fi

echo "📦 Staging changes..."
git add .

# Build commit message (supports body and footer)
BODY="${2:-}"
FOOTER="${3:-}"

TMP_DIR="$REPO_ROOT/.tmp"
mkdir -p "$TMP_DIR"
MSG_FILE=$(mktemp "$TMP_DIR/commit-msg.XXXXXX")

echo "$HEADER" > "$MSG_FILE"
[ -n "$BODY" ] && echo -e "\n$BODY" >> "$MSG_FILE"
[ -n "$FOOTER" ] && echo -e "\n$FOOTER" >> "$MSG_FILE"

echo "📝 Committing: $HEADER"
if ! git commit -F "$MSG_FILE"; then
    rm -f "$MSG_FILE"
    echo "❌ ERROR: Commit failed."
    exit 1
fi
rm -f "$MSG_FILE"

echo "🚀 Pushing to remote..."
if ! git push; then
    echo "❌ ERROR: Push failed. Check your internet or git status."
    exit 1
fi

echo "🚀🚀🚀 REMOTE SYNCED!"

# Lightweight auto-prune: remove stale remote tracking refs
git fetch --prune --quiet 2>/dev/null || true

echo "📊 STATUS: SUCCESS"
