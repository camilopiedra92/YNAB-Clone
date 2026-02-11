#!/usr/bin/env bash
# scripts/install-hooks.sh
# Installs git hooks from scripts/hooks/ into .git/hooks/
# Run automatically via `npm prepare` on install/clone.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_SRC="$REPO_ROOT/scripts/hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_SRC" ]; then
    echo "⚠️  No hooks directory found at $HOOKS_SRC"
    exit 0
fi

for hook in "$HOOKS_SRC"/*; do
    [ -f "$hook" ] || continue
    hook_name=$(basename "$hook")
    cp "$hook" "$HOOKS_DST/$hook_name"
    chmod +x "$HOOKS_DST/$hook_name"
    echo "✅ Installed hook: $hook_name"
done
