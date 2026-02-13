#!/usr/bin/env bash
# check-future-date-filter.sh — CI Guard for MEMORY §4D
#
# Ensures every financial transaction query in lib/repos/ that performs
# monetary aggregation (SUM) on the transactions table also includes
# the notFutureDate() filter.
#
# Display queries (getTransactions, getPayees) don't use SUM and are
# correctly excluded.
#
# Exit code: 0 = pass, 1 = violation found
# Usage: npm run check:future-filter

REPOS_DIR="lib/repos"
VIOLATIONS=0

printf "🔍 Checking future-date filter compliance (MEMORY §4D)...\n\n"

for file in "$REPOS_DIR"/*.ts; do
  [ -f "$file" ] || continue

  # Get line numbers of "FROM.*transactions" (excluding comments)
  LINES=$(grep -n 'FROM.*transactions' "$file" 2>/dev/null | grep -v '^\s*//' | cut -d: -f1 || true)

  for line in $LINES; do
    [ -z "$line" ] && continue
    START=$((line > 10 ? line - 10 : 1))
    END=$((line + 10))
    WINDOW=$(sed -n "${START},${END}p" "$file")

    # Only check financial queries (those with SUM — the monetary aggregation marker)
    if echo "$WINDOW" | grep -q 'SUM('; then
      if ! echo "$WINDOW" | grep -q 'notFutureDate'; then
        printf "  ✗ %s:%s — Financial query (SUM) missing notFutureDate()\n" "$file" "$line"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi
  done
done

printf "\n"
if [ "$VIOLATIONS" -gt 0 ]; then
  printf "✗ FAILED: Found %d financial query/queries without notFutureDate() filter.\n" "$VIOLATIONS"
  printf "Fix: Add \${notFutureDate(transactions.date)} to the WHERE clause.\n"
  printf "See: MEMORY §4D — Future transactions EXCLUDED from ALL financial calculations.\n"
  exit 1
else
  printf "✓ All financial transaction queries include notFutureDate() filter.\n"
  exit 0
fi
