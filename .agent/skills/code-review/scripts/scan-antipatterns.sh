#!/usr/bin/env bash
# scan-antipatterns.sh — Automated anti-pattern scanner for code reviews
#
# Scans changed files (vs main) or the full codebase for violations of
# project rules. Returns non-zero if any P0/P1 findings are detected.
#
# Usage:
#   bash .agent/skills/code-review/scripts/scan-antipatterns.sh [--help] [--all] [--verbose]
#
# Options:
#   --help      Show this help message
#   --all       Scan the entire codebase (default: only files changed vs main)
#   --verbose   Show matching lines, not just file names

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Parse arguments ────────────────────────────────────────────────
SCAN_ALL=false
VERBOSE=false

for arg in "$@"; do
  case "$arg" in
    --help)
      head -14 "$SCRIPT_PATH" | tail -12
      exit 0
      ;;
    --all)
      SCAN_ALL=true
      ;;
    --verbose)
      VERBOSE=true
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# ─── Determine file list ────────────────────────────────────────────
if [ "$SCAN_ALL" = true ]; then
  FILES=$(find ./app ./hooks ./lib ./components \
    \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | grep -v node_modules | grep -v '.test.' | sort)
else
  FILES=$(git diff --name-only main...HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' | grep -v node_modules || true)
  if [ -z "$FILES" ]; then
    echo "ℹ️  No changed .ts/.tsx files vs main. Use --all to scan everything."
    exit 0
  fi
fi

# ─── Grep helper ────────────────────────────────────────────────────
FINDINGS=0
P0_COUNT=0
P1_COUNT=0
P2_COUNT=0

check() {
  local severity="$1"
  local label="$2"
  local pattern="$3"
  local include="$4"  # file glob filter (e.g., "*.ts" or "route.ts")
  local exclude="${5:-}"

  local grep_flags="-rl"
  [ "$VERBOSE" = true ] && grep_flags="-rn"

  local matches=""
  if [ -n "$include" ]; then
    matches=$(echo "$FILES" | grep -E "$include" | while read -r f; do
      [ -f "$f" ] && grep $grep_flags -E "$pattern" "$f" 2>/dev/null || true
    done | head -20)
  fi

  # Apply exclude filter if provided
  if [ -n "$exclude" ] && [ -n "$matches" ]; then
    matches=$(echo "$matches" | grep -v -E "$exclude" || true)
  fi

  if [ -n "$matches" ]; then
    FINDINGS=$((FINDINGS + 1))
    case "$severity" in
      P0) P0_COUNT=$((P0_COUNT + 1)); icon="🔴" ;;
      P1) P1_COUNT=$((P1_COUNT + 1)); icon="🟠" ;;
      P2) P2_COUNT=$((P2_COUNT + 1)); icon="🟡" ;;
      *)  icon="⚪" ;;
    esac
    echo ""
    echo "$icon [$severity] $label"
    echo "$matches" | sed 's/^/   /'
  fi
}

echo "══════════════════════════════════════════════════════════"
echo "  Anti-Pattern Scanner"
echo "  Scope: $([ "$SCAN_ALL" = true ] && echo "Full codebase" || echo "Changed files vs main")"
echo "══════════════════════════════════════════════════════════"

# ─── P0: Blocking issues ────────────────────────────────────────────

# 1. Inline financial math in routes/hooks/components (not engine)
check "P0" "Inline financial math outside lib/engine/" \
  "(cashBalance|totalAvailable|creditOverspending|fundedSpending)\s*[-+*/]" \
  "(route\.ts|hooks/|components/)" \
  "lib/engine/"

# 2. Missing withBudgetAccess in budget routes
# Custom check: find budget routes that export handlers but DON'T call withBudgetAccess
{
  _missing=""
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -qE 'export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)' "$f" && \
       ! grep -q 'withBudgetAccess' "$f"; then
      _missing="${_missing}${f}\n"
    fi
  done <<< "$(echo "$FILES" | grep -E 'budgets/\[budgetId\].*route\.ts')"
  if [ -n "$_missing" ]; then
    FINDINGS=$((FINDINGS + 1))
    P0_COUNT=$((P0_COUNT + 1))
    echo ""
    echo "🔴 [P0] Budget route missing withBudgetAccess()"
    printf "%b" "$_missing" | sed '/^$/d' | sed 's/^/   /'
  fi
}

# 3. Raw SQL in API routes (bypassing repos)
check "P1" "Direct db/SQL access in API routes (use repos)" \
  "(import.*from.*lib/db|db\.select|db\.insert|db\.update|db\.delete|sql\`)" \
  "app/api/.*route\.ts" \
  ""

# 4. Raw DB rows returned without DTO transform
check "P1" "Possible raw DB rows in API response (missing DTO)" \
  "NextResponse\.json\((rows|result|data)\b" \
  "app/api/.*route\.ts" \
  ""

# ─── P1: Architecture violations ────────────────────────────────────

# 5. Raw fetch() for mutations in components/hooks
check "P1" "Raw fetch() for writes in hooks/components (use useMutation)" \
  "fetch\(.*method:\s*['\"]?(POST|PUT|PATCH|DELETE)" \
  "(hooks/|components/)" \
  ""

# 6. Direct toast() in mutation hooks
check "P1" "Direct toast() call in hooks (use meta.errorMessage)" \
  "toast\.(error|success|warning|info)\(" \
  "hooks/use.*Mutation" \
  ""

# 7. Manual Milliunit cast (should use mu() in tests, milliunit() in prod)
# Exclude primitives.ts (defines milliunit()), schema.ts (DB type), engine/ (internal casts)
check "P1" "Manual 'as Milliunit' cast (use mu()/milliunit())" \
  "as\s+Milliunit" \
  "\.(ts|tsx)$" \
  "(primitives\.ts|schema\.ts|lib/engine/)"

# 8. DB imports in engine (engine must be pure)
check "P0" "DB/HTTP/React dependency in engine (must be pure)" \
  "(import.*from.*lib/db|import.*from.*lib/repos|import.*from.*react|import.*fetch)" \
  "lib/engine/" \
  ""

# ─── P2: Style issues ──────────────────────────────────────────────

# 9. Missing mutationKey — compare counts of useMutation vs mutationKey per file
{
  _no_key=""
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    _mut_count=$(grep -c 'useMutation(' "$f" 2>/dev/null || true)
    _mut_count=${_mut_count:-0}
    _key_count=$(grep -c 'mutationKey' "$f" 2>/dev/null || true)
    _key_count=${_key_count:-0}
    if [ "$_mut_count" -gt "$_key_count" ]; then
      _no_key="${_no_key}${f} (${_mut_count} mutations, ${_key_count} keys)\n"
    fi
  done <<< "$(echo "$FILES" | grep -E 'hooks/use.*Mutation')"
  if [ -n "$_no_key" ]; then
    FINDINGS=$((FINDINGS + 1))
    P2_COUNT=$((P2_COUNT + 1))
    echo ""
    echo "🟡 [P2] useMutation without mutationKey"
    printf "%b" "$_no_key" | sed '/^$/d' | sed 's/^/   /'
  fi
}

# 10. console.log left in production code
check "P2" "console.log in production code (use console.error for errors)" \
  "console\.log\(" \
  "\.(ts|tsx)$" \
  "(test|spec|scripts/|\.test\.|logger\.ts)" \

# 11. Snake_case in API payloads (should be camelCase)
check "P2" "Possible snake_case in API payload (use camelCase)" \
  "(account_id|category_id|budget_id|created_at|updated_at)" \
  "(hooks/|components/)" \
  "(dto|schema)" \

# ─── Summary ────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
if [ $FINDINGS -eq 0 ]; then
  echo "  ✅ No anti-patterns detected!"
else
  echo "  Found: 🔴 $P0_COUNT P0  🟠 $P1_COUNT P1  🟡 $P2_COUNT P2"
  echo "  Total: $FINDINGS finding(s)"
fi
echo "══════════════════════════════════════════════════════════"

# Exit non-zero if blocking findings exist
[ $P0_COUNT -eq 0 ] && [ $P1_COUNT -eq 0 ] || exit 1
