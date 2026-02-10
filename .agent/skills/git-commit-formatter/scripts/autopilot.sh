#!/usr/bin/env bash
# autopilot.sh — The professional, zero-loop Git workflow.
# Handles: Health Check -> Staging -> Validation -> Commit -> Push

set -euo pipefail

# 1. Resolve Paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-commit-msg.sh"
SMART_COMMIT="$SCRIPT_DIR/smart-commit.sh"
HEALTH_CHECK="$SCRIPT_DIR/check-worktree-health.sh"

echo "🎯 Starting Professional Git Autopilot (Cwd: $(pwd))"

# 2. CWD Guard
if [ ! -d .git ]; then
    echo "❌ ERROR: Not in a git repository."
    echo "Current directory: $(pwd)"
    echo "💡 ACTION: Change Cwd to /Users/camilopiedra/Documents/YNAB/ynab-app"
    exit 1
fi

# 3. Pre-flight Health Check (Internal)
# We run it but handle the status ourselves to avoid double-printing
HEALTH_REPORT=$("$HEALTH_CHECK" || true)

# 4. Determine Action
if echo "$HEALTH_REPORT" | grep -q "🛑 \[STOP\]"; then
    echo "✨ Repo is clean and synced. No action needed."
    echo "📊 STATUS: SYNCED"
    exit 0
fi

# 5. Argument Check
HEADER="${1:-}"
if [ -z "$HEADER" ]; then
    echo "⚠️  WARNING: No commit message provided."
    echo "Usage: bash autopilot.sh \"type(scope): message\" [\"body\"] [\"footer\"]"
    exit 1
fi

# 6. Atomic Execution
echo "📦 Staging changes..."
git add .

echo "📝 Committing..."
if ! bash "$SMART_COMMIT" "$@"; then
    echo "❌ COMMIT FAILED."
    exit 1
fi

echo "🚀 Pushing to remote..."
git push

echo "🚀🚀🚀 REMOTE SYNCED!"
echo "📊 STATUS: SUCCESS"
