#!/usr/bin/env bash
# check-worktree-health.sh — Pre-flight check for Git commits
#
# Detects common noise files (untracked) and provides a summary for the agent.

set -euo pipefail

# Common junk patterns to flag
JUNK_PATTERNS=("tsx-" ".DS_Store" "node_modules" "npm-debug.log" ".tmp/" "backup_")

echo "🔍 Checking Worktree Health..."

# 1. Detect Untracked Junk
UNTRACKED=$(git ls-files --others --exclude-standard)
JUNK_FOUND=()

if [ -n "$UNTRACKED" ]; then
  for pattern in "${JUNK_PATTERNS[@]}"; do
    if echo "$UNTRACKED" | grep -q "$pattern"; then
      JUNK_FOUND+=("$pattern")
    fi
  done
fi

if [ ${#JUNK_FOUND[@]} -gt 0 ]; then
  echo "⚠️  Flagged untracked files found:"
  for junk in "${JUNK_FOUND[@]}"; do
    echo "   • Matches pattern: $junk"
  done
  echo ""
  echo "💡 Advice: Consider updating .gitignore or staging these if they are relevant."
else
  echo "✅ No major worktree noise detected."
fi

# 2. Diff Summary for Scope Inference
echo ""
echo "📝 Staged Changes Summary:"
if git diff --cached --quiet; then
  echo "   (Nothing staged for commit)"
else
  git diff --cached --stat | sed 's/^/   /'
fi

echo ""
echo "📝 Unstaged Changes (Potential misses):"
if git diff --quiet; then
  echo "   (No unstaged changes)"
else
  git diff --stat | sed 's/^/   /'
fi

echo ""
echo "🚀 Next Step: Choose your type(scope) based on the stats above."
