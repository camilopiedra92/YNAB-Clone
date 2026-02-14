#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
#  CI Guard: Validate i18n key parity between locale files
# ──────────────────────────────────────────────────────────
#
#  Ensures es.json and en.json have identical key structures.
#  Missing keys cause t(key) to throw at runtime in tests.
#
#  Usage:  npm run check:i18n-keys
#  Exit:   0 if all keys match, 1 if mismatches found
# ──────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MESSAGES_DIR="$ROOT_DIR/messages"

ES_FILE="$MESSAGES_DIR/es.json"
EN_FILE="$MESSAGES_DIR/en.json"

if [ ! -f "$ES_FILE" ] || [ ! -f "$EN_FILE" ]; then
  echo "❌ Missing locale file(s). Expected: $ES_FILE and $EN_FILE"
  exit 1
fi

# Extract all dot-separated key paths from a JSON file recursively.
# Uses node to handle nested objects correctly.
extract_keys() {
  node -e "
    const data = require('$1');
    const keys = [];
    function walk(obj, prefix) {
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? prefix + '.' + k : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          walk(v, path);
        } else {
          keys.push(path);
        }
      }
    }
    walk(data, '');
    keys.sort().forEach(k => console.log(k));
  "
}

ES_KEYS=$(extract_keys "$ES_FILE")
EN_KEYS=$(extract_keys "$EN_FILE")

# Find keys in es.json but not in en.json
MISSING_IN_EN=$(comm -23 <(echo "$ES_KEYS") <(echo "$EN_KEYS") || true)
# Find keys in en.json but not in es.json
MISSING_IN_ES=$(comm -13 <(echo "$ES_KEYS") <(echo "$EN_KEYS") || true)

VIOLATIONS=0

if [ -n "$MISSING_IN_EN" ]; then
  echo "❌ Keys in es.json but MISSING from en.json:"
  echo "$MISSING_IN_EN" | sed 's/^/   /'
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$MISSING_IN_EN" | wc -l)))
fi

if [ -n "$MISSING_IN_ES" ]; then
  echo "❌ Keys in en.json but MISSING from es.json:"
  echo "$MISSING_IN_ES" | sed 's/^/   /'
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$MISSING_IN_ES" | wc -l)))
fi

echo "──────────────────────────────────────────"
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ Found $VIOLATIONS i18n key parity violation(s)."
  echo ""
  echo "Fix: Add the missing keys to the locale file that lacks them."
  echo "     Both messages/es.json and messages/en.json must have identical key structures."
  exit 1
else
  ES_COUNT=$(echo "$ES_KEYS" | wc -l | tr -d ' ')
  echo "✅ All i18n keys match ($ES_COUNT keys in both locale files)."
  exit 0
fi
