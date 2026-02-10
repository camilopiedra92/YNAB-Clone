#!/usr/bin/env bash
# scripts/sync.sh
# Atomic Git Sync: Staging -> Validate -> Commit -> Push

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

echo "📝 Committing: $HEADER"
# Use git commit directly
if ! git commit -m "$HEADER"; then
    echo "❌ ERROR: Commit failed."
    exit 1
fi

echo "🚀 Pushing to remote..."
if ! git push; then
    echo "❌ ERROR: Push failed. Check your internet or git status."
    exit 1
fi

echo "🚀🚀🚀 REMOTE SYNCED!"
echo "📊 STATUS: SUCCESS"
