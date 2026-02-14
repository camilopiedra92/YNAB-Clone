#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
#  CI Guard: Ensure API error messages are in English
# ──────────────────────────────────────────────────────────────────
#
#  Scans app/api/ for apiError() calls containing non-ASCII characters
#  (accented letters, etc.) which indicate Spanish or other non-English
#  error messages.
#
#  Architectural rule: API errors are machine-facing → always English.
#  The frontend handles user-facing translations via toast meta.
#
#  Usage:  npm run check:api-errors
#  Exit:   0 if all clean, 1 if non-English strings found
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$ROOT_DIR/app/api"

if [ ! -d "$API_DIR" ]; then
  echo "❌ API directory not found: $API_DIR"
  exit 1
fi

# Find apiError() calls containing non-ASCII characters (accented letters)
# This catches Spanish (á, é, í, ó, ú, ñ), French, German, etc.
# Uses LC_ALL=C to make grep treat bytes > 127 as non-matching for [[:print:]]
VIOLATIONS=$(grep -rn "apiError(" "$API_DIR" --include='*.ts' | LC_ALL=C grep '[^[:print:][:space:]]' || true)

echo "──────────────────────────────────────────"
if [ -n "$VIOLATIONS" ]; then
  COUNT=$(echo "$VIOLATIONS" | wc -l | tr -d ' ')
  echo "❌ Found $COUNT API error(s) with non-English characters:"
  echo ""
  echo "$VIOLATIONS" | sed 's/^/   /'
  echo ""
  echo "Fix: API errors are machine-facing and must always be in English."
  echo "     The frontend handles translations via toast meta.errorMessage."
  exit 1
else
  TOTAL=$(grep -rn "apiError(" "$API_DIR" --include='*.ts' | wc -l | tr -d ' ')
  echo "✅ All $TOTAL API error messages are in English."
  exit 0
fi
