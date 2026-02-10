#!/usr/bin/env bash
# validate-commit-msg.sh — Validates a commit message against Conventional Commits
#
# Checks: header format, allowed types, subject length, body line width,
#          BREAKING CHANGE footer format, blank line separators.
#
# Usage:
#   bash validate-commit-msg.sh "feat(scope): description"
#   echo "feat: description" | bash validate-commit-msg.sh --stdin
#   bash validate-commit-msg.sh --help
#
# Exit codes:
#   0 = valid
#   1 = invalid (errors printed to stderr)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"

# ─── Configuration ──────────────────────────────────────────────────
MAX_HEADER_LENGTH=72
MAX_BODY_LINE_LENGTH=100

ALLOWED_TYPES=(
  feat fix docs style refactor perf test build ci chore revert
)

# ─── Parse arguments ────────────────────────────────────────────────
MSG=""
FROM_STDIN=false

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      head -15 "$SCRIPT_PATH" | tail -13
      echo ""
      echo "Allowed types: ${ALLOWED_TYPES[*]}"
      echo "Max header length: $MAX_HEADER_LENGTH chars"
      echo "Max body line length: $MAX_BODY_LINE_LENGTH chars"
      exit 0
      ;;
    --stdin)
      FROM_STDIN=true
      ;;
    *)
      MSG="$arg"
      ;;
  esac
done

if [ "$FROM_STDIN" = true ]; then
  MSG=$(cat)
fi

if [ -z "$MSG" ]; then
  echo "❌ Error: No commit message provided." >&2
  echo "   Usage: bash validate-commit-msg.sh \"type(scope): description\"" >&2
  echo "   Or:    echo \"message\" | bash validate-commit-msg.sh --stdin" >&2
  exit 1
fi

# ─── Split message into parts ──────────────────────────────────────
HEADER=$(echo "$MSG" | head -1)
BODY=""
FOOTER=""

# Parse body and footer (separated by blank lines)
LINE_NUM=0
IN_BODY=false
IN_FOOTER=false
FOUND_BODY_SEPARATOR=false
LAST_BLANK=false

while IFS= read -r line; do
  LINE_NUM=$((LINE_NUM + 1))
  [ $LINE_NUM -eq 1 ] && continue  # skip header

  if [ $LINE_NUM -eq 2 ]; then
    if [ -z "$line" ]; then
      FOUND_BODY_SEPARATOR=true
      IN_BODY=true
    else
      IN_BODY=true
      BODY="$line"
    fi
    continue
  fi

  if [ "$IN_BODY" = true ] && [ -z "$line" ] && [ "$LAST_BLANK" = false ]; then
    LAST_BLANK=true
    continue
  fi

  if [ "$LAST_BLANK" = true ]; then
    # Check if this looks like a footer (token: value or BREAKING CHANGE:)
    if echo "$line" | grep -qE '^(BREAKING CHANGE|[A-Za-z-]+):\s'; then
      IN_FOOTER=true
      IN_BODY=false
      FOOTER="$line"
      LAST_BLANK=false
      continue
    else
      # Not a footer, it's still body
      BODY="${BODY}${BODY:+$'\n'}${line}"
      LAST_BLANK=false
      continue
    fi
  fi

  LAST_BLANK=false

  if [ "$IN_FOOTER" = true ]; then
    FOOTER="${FOOTER}${FOOTER:+$'\n'}${line}"
  elif [ "$IN_BODY" = true ]; then
    BODY="${BODY}${BODY:+$'\n'}${line}"
  fi
done <<< "$MSG"

# ─── Validation ─────────────────────────────────────────────────────
ERRORS=()
WARNINGS=()

# --- 1. Header format ---
# Pattern: type(scope)!: description  OR  type!: description  OR  type(scope): description  OR  type: description
HEADER_REGEX='^(revert: |Merge )'
CONVENTIONAL_REGEX='^([a-z]+)(\([a-z0-9._/ -]+\))?(!)?: (.+)$'

if echo "$HEADER" | grep -qE "$HEADER_REGEX"; then
  # Revert or merge commit — skip strict header validation
  :
elif echo "$HEADER" | grep -qE "$CONVENTIONAL_REGEX"; then
  # Extract parts
  TYPE=$(echo "$HEADER" | sed -E "s/$CONVENTIONAL_REGEX/\1/")
  SCOPE=$(echo "$HEADER" | sed -E "s/$CONVENTIONAL_REGEX/\2/" | tr -d '()')
  BANG=$(echo "$HEADER" | sed -E "s/$CONVENTIONAL_REGEX/\3/")
  DESCRIPTION=$(echo "$HEADER" | sed -E "s/$CONVENTIONAL_REGEX/\4/")

  # --- 2. Check type ---
  TYPE_VALID=false
  for t in "${ALLOWED_TYPES[@]}"; do
    if [ "$TYPE" = "$t" ]; then
      TYPE_VALID=true
      break
    fi
  done

  if [ "$TYPE_VALID" = false ]; then
    ERRORS+=("Type '$TYPE' is not allowed. Allowed: ${ALLOWED_TYPES[*]}")
  fi

  # --- 3. Check description ---
  if [ -z "$DESCRIPTION" ]; then
    ERRORS+=("Description is empty.")
  fi

  # Check imperative mood — first word should not end in -ed, -ing, -ion
  FIRST_WORD=$(echo "$DESCRIPTION" | awk '{print $1}')
  if echo "$FIRST_WORD" | grep -qE '(ed|ing|ion)$'; then
    WARNINGS+=("Description might not use imperative mood: '$FIRST_WORD'. Use 'add' not 'added', 'fix' not 'fixing'.")
  fi

  # Check lowercase start
  if echo "$DESCRIPTION" | grep -qE '^[A-Z]'; then
    WARNINGS+=("Description should start with lowercase: '$DESCRIPTION'")
  fi

  # Check trailing period
  if echo "$DESCRIPTION" | grep -qE '\.$'; then
    ERRORS+=("Description should NOT end with a period.")
  fi

  # --- 4. Check header length ---
  HEADER_LEN=${#HEADER}
  if [ "$HEADER_LEN" -gt "$MAX_HEADER_LENGTH" ]; then
    ERRORS+=("Header is $HEADER_LEN chars (max $MAX_HEADER_LENGTH): '$HEADER'")
  fi

  # --- 5. Check for ! with BREAKING CHANGE footer ---
  if [ -n "$BANG" ] && [ -z "$FOOTER" ]; then
    WARNINGS+=("Header has '!' but no BREAKING CHANGE footer. Consider adding one for clarity.")
  fi

else
  ERRORS+=("Header does not match Conventional Commits format: '$HEADER'")
  ERRORS+=("Expected: type(scope): description")
fi

# --- 6. Check blank line after header ---
if [ -n "$BODY" ] && [ "$FOUND_BODY_SEPARATOR" = false ]; then
  ERRORS+=("Missing blank line between header and body.")
fi

# --- 7. Check body line lengths ---
if [ -n "$BODY" ]; then
  BODY_LINE_NUM=0
  while IFS= read -r bline; do
    BODY_LINE_NUM=$((BODY_LINE_NUM + 1))
    BLINE_LEN=${#bline}
    if [ "$BLINE_LEN" -gt "$MAX_BODY_LINE_LENGTH" ]; then
      WARNINGS+=("Body line $BODY_LINE_NUM is $BLINE_LEN chars (max $MAX_BODY_LINE_LENGTH)")
    fi
  done <<< "$BODY"
fi

# --- 8. Check BREAKING CHANGE footer format ---
if [ -n "$FOOTER" ]; then
  while IFS= read -r fline; do
    if echo "$fline" | grep -qiE '^breaking.change'; then
      if ! echo "$fline" | grep -qE '^BREAKING CHANGE: .+'; then
        ERRORS+=("BREAKING CHANGE footer must be exactly: 'BREAKING CHANGE: <description>' (uppercase, space, colon, space)")
      fi
    fi
  done <<< "$FOOTER"
fi

# ─── Output ─────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  Conventional Commits Validator"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  Header: $HEADER"
[ -n "$BODY" ] && echo "  Body:   $(echo "$BODY" | head -1)$([ "$(echo "$BODY" | wc -l)" -gt 1 ] && echo " ...")"
[ -n "$FOOTER" ] && echo "  Footer: $FOOTER"
echo ""

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "  ❌ ERRORS (must fix):"
  for err in "${ERRORS[@]}"; do
    echo "     • $err"
  done
  echo ""
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "  ⚠️  WARNINGS (should fix):"
  for warn in "${WARNINGS[@]}"; do
    echo "     • $warn"
  done
  echo ""
fi

if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  echo "  ✅ Commit message is valid!"
fi

echo "══════════════════════════════════════════════════════════"

# Exit code
if [ ${#ERRORS[@]} -gt 0 ]; then
  exit 1
fi

exit 0
