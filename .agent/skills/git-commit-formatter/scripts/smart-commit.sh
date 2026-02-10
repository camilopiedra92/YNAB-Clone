#!/usr/bin/env bash
# smart-commit.sh — Validates and executes a Git commit in one step
#
# Usage:
#   bash smart-commit.sh "feat(scope): description" ["body"] ["footer"]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TMP_DIR="$PROJECT_ROOT/.tmp"
mkdir -p "$TMP_DIR"

VALIDATOR="$SCRIPT_DIR/validate-commit-msg.sh"
MSG_FILE=$(mktemp "$TMP_DIR/commit-msg.XXXXXX")

# 1. Construct Message
HEADER="${1:-}"
BODY="${2:-}"
FOOTER="${3:-}"

if [ -z "$HEADER" ]; then
  echo "❌ Error: Missing commit header."
  echo "Usage: bash smart-commit.sh \"header\" [\"body\"] [\"footer\"]"
  exit 1
fi

echo "$HEADER" > "$MSG_FILE"
[ -n "$BODY" ] && echo -e "\n$BODY" >> "$MSG_FILE"
[ -n "$FOOTER" ] && echo -e "\n$FOOTER" >> "$MSG_FILE"

# 2. Validate
if ! bash "$VALIDATOR" --stdin < "$MSG_FILE"; then
  echo "❌ Validation failed. Commit aborted."
  rm -f "$MSG_FILE"
  exit 1
fi

# 3. Detect Identity (macOS/Agent specific)
AUTHOR_FLAG=""
if ! git config user.name >/dev/null || ! git config user.email >/dev/null; then
  # Default to User identity if git isn't configured in the environment
  AUTHOR_FLAG="--author='Camilo Piedrahita Hernández <camilopiedra@Camilos-MacBook-Pro.local>'"
fi

# 4. Commit
echo "🚀 Executing commit..."
if [ -n "$AUTHOR_FLAG" ]; then
  eval "git commit -F \"$MSG_FILE\" $AUTHOR_FLAG"
else
  git commit -F "$MSG_FILE"
fi

rm -f "$MSG_FILE"
echo "✅ Done!"
