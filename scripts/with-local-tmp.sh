#!/usr/bin/env bash
# Ensures all processes use a project-local temp directory (.tmp/).
# Needed in sandboxed dev environments where /var/folders is inaccessible.
# Harmless in production — just uses .tmp/ instead of system temp.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
mkdir -p "$PROJECT_ROOT/.tmp"
export TMPDIR="$PROJECT_ROOT/.tmp"
export PATH="$PROJECT_ROOT/node_modules/.bin:$PATH"
exec "$@"
